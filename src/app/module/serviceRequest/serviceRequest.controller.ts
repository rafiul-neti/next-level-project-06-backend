import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ServiceRequestService } from "./serviceRequest.service";

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const requestAttachments = files?.["requestAttachments"] || [];

  const result = await ServiceRequestService.createServiceRequest(
    req.body,
    requestAttachments,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Request received. You will be contacted by a Technician as soon as possible.",
    data: result,
  });
});

export const ServiceRequestController = { createServiceRequest };
