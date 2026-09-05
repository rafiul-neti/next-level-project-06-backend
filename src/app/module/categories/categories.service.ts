import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import type { ServiceCategoryUpdateInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  TCreateCategoryPayload,
  TUpdateCategoryPayload,
} from "./categories.validation";

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

async function updateCategory(
  payload: TUpdateCategoryPayload,
  categoryId: string,
) {
  const isCategoryExists = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
  });

  if (!isCategoryExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Category Not Found!");
  }

  const data: ServiceCategoryUpdateInput = {};

  if (payload.name) {
    data.name = payload.name;
  }

  if (payload.description) {
    data.description = payload.description;
  }

  if (payload.isActive) {
    data.isActive = payload.isActive;
  }

  const updatedCategory = await prisma.serviceCategory.update({
    where: {
      id: isCategoryExists.id,
    },
    data,
  });

  return updatedCategory;
}

async function deleteCategoty(categoryId: string) {
  const isCategoryExists = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
  });

  if (!isCategoryExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Category Not Found!");
  }

  const deletedCategoty = await prisma.serviceCategory.update({
    where: { id: isCategoryExists.id },
    data: {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  return deletedCategoty;
}

// services with constraint
async function getAllCategories(requestingUserRole?: Role) {
  const isAdmin = requestingUserRole === Role.ADMIN;

  const categories = await prisma.serviceCategory.findMany({
    where: isAdmin
      ? {} // admin sees everything, active or not
      : { isActive: true }, // everyone else sees only active categories
    orderBy: { name: "asc" },
  });

  return categories;
}

export const CategoriesService = {
  createCategory,
  updateCategory,
  deleteCategoty,
  getAllCategories,
};
