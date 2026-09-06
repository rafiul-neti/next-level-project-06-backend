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

export const PaymentController = { initiatePayment };
