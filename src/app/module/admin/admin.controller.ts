import type { Request, Response } from "express";
import httpStatus from "http-status";
import { idValidationSchema } from "../../../validations";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getDashboardStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Dashboard stats retrieved successfully.",
    data: result,
  });
});

const getAllAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAllAuditLogs(req.validatedQuery);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Audit logs retrieved successfully.",
    data: result.data,
    meta: result.meta,
  });
});

const toggleUserBlock = catchAsync(async (req: Request, res: Response) => {
  const parsed = idValidationSchema.safeParse({ id: req.params.userId });

  if (!parsed.success) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid User Reference");
  }

  const result = await AdminService.toggleUserBlock(
    parsed.data.id,
    req.body,
    req.user!.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: result.isBlocked
      ? "User blocked successfully."
      : "User unblocked successfully.",
    data: result,
  });
});

export const AdminController = {
  getDashboardStats,
  getAllAuditLogs,
  toggleUserBlock,
};
