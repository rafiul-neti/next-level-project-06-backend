import type { Request, Response } from "express";
import httpStatus from "http-status";
import { idValidationSchema } from "../../../validations";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CategoriesService } from "./categories.service";

// admin only controllers
const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoriesService.createCategory(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Service Category Created Successfully.",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const parsed = idValidationSchema.safeParse({ id: req.params.categoryId });

  if (!parsed.success) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid Category Reference!");
  }

  const result = await CategoriesService.updateCategory(
    req.body,
    parsed.data.id,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Service Category Updated Successfully.",
    data: result,
  });
});

const deleteCategoty = catchAsync(async (req: Request, res: Response) => {
  const parsed = idValidationSchema.safeParse({ id: req.params.categoryId });

  if (!parsed.success) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid Category Reference!");
  }

  const result = await CategoriesService.deleteCategoty(parsed.data.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Service Category Deleted Successfully.",
    data: result,
  });
});

// public controller with constraint
const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  // req.user is only present if a valid token was sent; otherwise undefined
  const result = await CategoriesService.getAllCategories(req.user?.role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Categories retrieved successfully",
    data: result,
  });
});

export const CategoriesController = {
  createCategory,
  updateCategory,
  deleteCategoty,
  getAllCategories,
};
