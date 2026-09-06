import type { Request, Response } from "express";
import httpStatus from "http-status";
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

export const PaymentController = {
  initiatePayment,
  reinitiatePaymentController,
  paymentCallbackController,
};
