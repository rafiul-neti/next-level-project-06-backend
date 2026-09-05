import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CategoriesService } from "./categories.service";

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoriesService.createCategory(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Service Category Created Successfully.",
    data: result,
  });
});

export const CategoriesController = { createCategory };
