import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TechniciansService } from "./technicians.service";

const applyAsTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechniciansService.applyAsTechnician(
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Application submitted successfully.",
    data: result,
  });
});

const updateTechnicianApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await TechniciansService.updateTechnicianApplicationStatus(
      req.params.userId as string,
      req.body,
      req.user!.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Application status updated successfully.",
      data: result,
    });
  },
);

export const TechniciansController = {
  applyAsTechnician,
  updateTechnicianApplicationStatus,
};
