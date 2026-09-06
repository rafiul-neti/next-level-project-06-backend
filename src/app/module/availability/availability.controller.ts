import type { Request, Response } from "express";
import httpStatus from "http-status";
import { idValidationSchema } from "../../../validations";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AvailabilityService } from "./availability.service";

const setAvailability = catchAsync(async (req: Request, res: Response) => {
  const result = await AvailabilityService.setAvailability(req.body, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Availability set successfully.",
    data: result,
  });
});

const getAvailabilitySlots = catchAsync(async (req: Request, res: Response) => {
  const result =
    await AvailabilityService.getAllAvailabilitySlotsByTechnicianProfileId(
      req.user!,
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Retrieved all availability slots successfully.",
    data: result,
  });
});

const blockAnAvailability = catchAsync(async (req: Request, res: Response) => {
  const parsed = idValidationSchema.safeParse({
    id: req.params.availabilityId,
  });

  if (!parsed.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid Availability Reference.",
    );
  }

  const result = await AvailabilityService.blockAnAvailability(
    parsed.data.id,
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Blocked an availability successfully.",
    data: result,
  });
});

export const AvailabilityController = {
  setAvailability,
  getAvailabilitySlots,
  blockAnAvailability,
};
