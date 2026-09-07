import type { Request, Response } from "express";
import httpStatus from "http-status";
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

export const AdminController = {
  getDashboardStats,
  getAllAuditLogs,
};
