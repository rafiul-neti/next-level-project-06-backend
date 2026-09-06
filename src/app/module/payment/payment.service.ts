import httpStatus from "http-status";
import {
  ServiceRequestStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { TInitiatePaymentPayload } from "./payment.validation";

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
      "Failed to get bkash id_token: getting bkashIdToken from bookAppointment in appointment service.",
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
        callbackURL: `${config.bakend_app_url}/api/v1/payments/`,
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

export const PaymentService = { initiatePayment };
