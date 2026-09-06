import httpStatus from "http-status";
import PDFDocument from "pdfkit";
import {
  AuditAction,
  PaymentStatus,
  ServiceRequestStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { TInitiatePaymentPayload, TRefundPaymentPayload } from "./payment.validation";

async function initiatePayment(
  payload: TInitiatePaymentPayload,
  user: IRequestUser,
) {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: payload.serviceId },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }

  if (serviceRequest.customerId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to pay for this service request.",
    );
  }

  if (serviceRequest.status !== ServiceRequestStatus.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment can only be initiated for a completed service request.",
    );
  }

  if (!serviceRequest.finalAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This service request has no finalized amount yet.",
    );
  }

  // the bKash payment intent using the REAL fee.
  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Failed to get bkash id_token: getting bkashIdToken from initiatePayment in payment.service.",
    );
  }

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_sandbox_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: user.email,
        callbackURL: `${config.bakend_app_url}/api/v1/payments/callback`,
        amount: serviceRequest.finalAmount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: serviceRequest.id,
      }),
    },
  );

  if (!bkashCreatePaymentResponse.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to create bKash payment intent: in initiatePayment at payment.service",
    );
  }

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  await prisma.payment.create({
    data: {
      serviceId: serviceRequest.id,
      merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
      amount: bkashCreatePaymentResult.amount,
      gatewayResponse: bkashCreatePaymentResult,
      bkashPaymentId: bkashCreatePaymentResult.paymentID,
      payerReference: user.email,
    },
  });

  return { bkashURL: bkashCreatePaymentResult.bkashURL };
}

async function reinitiatePayment(
  payload: TInitiatePaymentPayload,
  user: IRequestUser,
) {
  const { serviceId } = payload;

  const existingPayment = await prisma.payment.findUnique({
    where: {
      serviceId,
    },
  });

  if (!existingPayment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found.");
  }

  const pendingStatuses: PaymentStatus[] = [
    PaymentStatus.PENDING,
    PaymentStatus.FAILED,
  ];

  if (!pendingStatuses.includes(existingPayment.status)) {
    throw new AppError(httpStatus.CONFLICT, "Payment status is already paid!");
  }

  if (!existingPayment.amount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Amount is missing in the payment.",
    );
  }

  // re-create the payment
  const amount = existingPayment.amount.toString();
  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Failed to get bkash id_token: getting bkashIdToken from reinitiatePayment in payment.service.",
    );
  }

  const bkashCreatePaymentResponse = await fetch(
    `${config.bkash_sandbox_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: user.email,
        callbackURL: `${config.bakend_app_url}/api/v1/payments/callback`,
        amount: amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: existingPayment.merchantInvoiceNumber,
      }),
    },
  );

  if (!bkashCreatePaymentResponse.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to create bKash payment intent: in reinitiatePayment at payment.service",
    );
  }

  const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

  await prisma.payment.update({
    where: { id: existingPayment.id },
    data: {
      merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
      gatewayResponse: bkashCreatePaymentResult,
      bkashPaymentId: bkashCreatePaymentResult.paymentID,
    },
  });

  return { bkashURL: bkashCreatePaymentResult.bkashURL };
}

async function paymentCallback(query: Record<string, any>) {
  const paymentId = query.paymentID;
  if (!paymentId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is missing!");
  }

  const status = query.status;
  if (!status) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment status is missing!");
  }

  // The Payment row must already exist — it was created in initiatePayment.
  const existingPayment = await prisma.payment.findUnique({
    where: { bkashPaymentId: paymentId },
    include: {
      service: {
        include: {
          customer: { select: { name: true, email: true } },
          technician: { select: { name: true, email: true } },
          category: { select: { name: true } },
        },
      },
    },
  });

  if (!existingPayment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment record not found.");
  }

  // Not a successful redirect — bKash's own `status` query param tells us
  // cancel vs failure before we even need to call execute.
  if (status === "failure") {
    await prisma.payment.update({
      where: { bkashPaymentId: paymentId },
      data: { status: PaymentStatus.FAILED },
    });

    return {
      redirectURL: `${config.frontend_url}/service-requests/${existingPayment.serviceId}?payment=failure`,
    };
  }

  if (status === "cancel") {
    // No CANCELLED value exists in this project's PaymentStatus enum —
    // a cancelled bKash checkout is treated the same as a failed one.
    await prisma.payment.update({
      where: { bkashPaymentId: paymentId },
      data: { status: PaymentStatus.FAILED },
    });

    return {
      redirectURL: `${config.frontend_url}/service-requests/${existingPayment.serviceId}?payment=cancelled`,
    };
  }

  if (status !== "success") {
    return {
      redirectURL: `${config.frontend_url}/service-requests/${existingPayment.serviceId}?payment=unknown`,
    };
  }

  // status === "success" — confirm with bKash's execute endpoint before
  // trusting it; the redirect status alone is not proof of payment.
  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "BKash Access Token not found!",
    );
  }

  const executedPaymentResponse = await fetch(
    `${config.bkash_sandbox_url}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({ paymentID: paymentId }),
    },
  );

  if (!executedPaymentResponse.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to execute bKash payment: in paymentCallback at payment.service",
    );
  }

  const executedPaymentResult = await executedPaymentResponse.json();

  const isCompleted =
    executedPaymentResult.statusCode === "0000" &&
    executedPaymentResult.transactionStatus === "Completed";

  if (!isCompleted) {
    await prisma.payment.update({
      where: { bkashPaymentId: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: executedPaymentResult,
      },
    });

    return {
      redirectURL: `${config.frontend_url}/service-requests/${existingPayment.serviceId}?payment=failure`,
    };
  }

  // Payment genuinely confirmed by bKash. Update Payment + ServiceRequest atomically.
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { bkashPaymentId: paymentId },
      data: {
        status: PaymentStatus.PAID,
        bkashTrxId: executedPaymentResult.trxID,
        paidAt: executedPaymentResult.paymentExecuteTime,
        gatewayResponse: executedPaymentResult,
      },
    });

    await tx.serviceRequest.update({
      where: { id: existingPayment.serviceId },
      data: { status: ServiceRequestStatus.PAID },
    });

    await tx.auditLog.create({
      data: {
        actorId: existingPayment.service.customerId,
        action: "PAYMENT_UPDATE",
        entityType: "Payment",
        entityId: existingPayment.id,
        serviceRequestId: existingPayment.serviceId,
        metadata: {
          from: PaymentStatus.PENDING,
          to: PaymentStatus.PAID,
          trxID: executedPaymentResult.trxID,
        },
      },
    });
  });

  // Generate the PDF invoice, using fields that actually exist on this schema
  const pdfDocument = new PDFDocument({ margin: 50 });
  const pdfChunks: Buffer[] = [];

  pdfDocument.on("data", (chunk: Buffer) => {
    pdfChunks.push(chunk);
  });

  const pdfReadyPromise = new Promise<Buffer>((resolve) => {
    pdfDocument.on("end", () => {
      resolve(Buffer.concat(pdfChunks));
    });
  });

  const { service } = existingPayment;

  pdfDocument
    .fontSize(20)
    .text("Field Service Management", { align: "center" });
  pdfDocument.fontSize(14).text("Payment Invoice", { align: "center" });
  pdfDocument.moveDown(2);

  pdfDocument.fontSize(12).text(`Customer Name: ${service.customer.name}`);
  pdfDocument.text(`Customer Email: ${service.customer.email}`);
  pdfDocument.moveDown();

  if (service.technician) {
    pdfDocument.text(`Technician Name: ${service.technician.name}`);
    pdfDocument.text(`Technician Email: ${service.technician.email}`);
  }
  pdfDocument.text(`Service Category: ${service.category.name}`);
  pdfDocument.text(`Service Address: ${service.address}`);
  pdfDocument.moveDown();

  pdfDocument.text(`Amount Paid: ${executedPaymentResult.amount} BDT`);
  pdfDocument.text(`Payment Method: bKash`);
  pdfDocument.text(`Transaction ID: ${executedPaymentResult.trxID}`);
  pdfDocument.text(`Paid At: ${executedPaymentResult.paymentExecuteTime}`);

  pdfDocument.end();

  const pdfBuffer = await pdfReadyPromise;

  try {
    await transporter.sendMail({
      from: config.email_sender,
      to: service.customer.email,
      subject: "Your Payment Invoice - Field Service Management",
      text: "Thank you for your payment. Please find your invoice attached.",
      attachments: [
        {
          filename: "invoice.pdf",
          content: pdfBuffer,
        },
      ],
    });
  } catch (emailError) {
    // the payment already succeeded and was recorded;
    // a failed receipt email should not fail the whole callback.
    console.error("Failed to send invoice email:", emailError);
  }

  return {
    executedPaymentResult,
    redirectURL: `${config.frontend_url}/service-requests/${existingPayment.serviceId}?payment=success`,
  };
}

async function refundPayment(
  paymentId: string,
  payload: TRefundPaymentPayload,
  actor: IRequestUser,
) {
  const reason = payload.refundReason ?? "Refunded by admin.";

  const existingPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!existingPayment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (existingPayment.status !== PaymentStatus.PAID) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only a PAID payment can be refunded. Current status: ${existingPayment.status}.`,
    );
  }

  if (!existingPayment.bkashPaymentId || !existingPayment.bkashTrxId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This payment is missing bKash transaction details and cannot be refunded automatically.",
    );
  }

  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "BKash Access Token not found!",
    );
  }

  const bkashRefundPaymentResponse = await fetch(
    `${config.bkash_sandbox_url}/tokenized/checkout/payment/refund`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        paymentID: existingPayment.bkashPaymentId,
        trxID: existingPayment.bkashTrxId,
        amount: existingPayment.amount?.toString(),
        sku: `${actor.email}:${existingPayment.serviceId}`,
        reason,
      }),
    },
  );

  if (!bkashRefundPaymentResponse.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Failed to execute bKash refund: in refundPayment at payment.service",
    );
  }

  const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

  const [updatedPayment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundTrxId: bkashRefundPaymentResult.refundTrxID,
        refundedAmount: bkashRefundPaymentResult.amount,
        refundReason: reason,
        refundedAt: bkashRefundPaymentResult.completedTime,
        status: PaymentStatus.REFUNDED,
        gatewayResponse: bkashRefundPaymentResult,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: AuditAction.PAYMENT_UPDATE,
        entityType: "Payment",
        entityId: paymentId,
        serviceRequestId: existingPayment.serviceId,
        metadata: {
          from: PaymentStatus.PAID,
          to: PaymentStatus.REFUNDED,
          refundTrxId: bkashRefundPaymentResult.refundTrxID,
          refundedAmount: bkashRefundPaymentResult.amount,
        },
      },
    }),
  ]);

  return updatedPayment;
}

export const PaymentService = {
  initiatePayment,
  reinitiatePayment,
  paymentCallback,
  refundPayment,
};
