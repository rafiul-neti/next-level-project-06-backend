import type { Request, Response } from "express";
import httpStatus from "http-status";
import { idValidationSchema } from "../../../validations";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.initiatePayment(req.body, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Payment initiated successfully.",
    data: result,
  });
});

const reinitiatePaymentController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PaymentService.reinitiatePayment(req.body, req.user!);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Payment reinitiated successfully.",
      data: result,
    });
  },
);

const paymentCallbackController = catchAsync(
  async (req: Request, res: Response) => {
    const { redirectURL } = await PaymentService.paymentCallback(req.query);

    res.redirect(redirectURL);

    /* 
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Appointment booked! Thank you for being with us.",
      data: executedPaymentResult,
    });
    */
  },
);

const refundPaymentController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({ id: req.params.paymentId });

    if (!parsed.success) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid Payment Reference.");
    }

    const result = await PaymentService.refundPayment(
      parsed.data.id,
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Payment refunded successfully.",
      data: result,
    });
  },
);

const getPaymentByIdController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({ id: req.params.paymentId });

    if (!parsed.success) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid Payment Reference.");
    }

    const result = await PaymentService.getPaymentById(
      parsed.data.id,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Payment retrieved successfully.",
      data: result,
    });
  },
);

const getMyPaymentsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PaymentService.getMyPayments(
      req.user!.userId,
      req.validatedQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Payment history retrieved successfully.",
      data: result.data,
      meta: result.meta,
    });
  },
);

export const PaymentController = {
  initiatePayment,
  reinitiatePaymentController,
  paymentCallbackController,
  refundPaymentController,
  getPaymentByIdController,
  getMyPaymentsController,
};
