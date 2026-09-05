import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { TCreateCategoryPayload } from "./categories.validation";

// admin only route's services
async function createCategory(payload: TCreateCategoryPayload) {
  const isCategoryExists = await prisma.serviceCategory.findUnique({
    where: { name: payload.name },
  });

  if (isCategoryExists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A Category Already Exists With This Name!",
    );
  }

  const createdCategory = await prisma.serviceCategory.create({
    data: { ...payload },
  });

  return createdCategory;
}

export const CategoriesService = { createCategory };
