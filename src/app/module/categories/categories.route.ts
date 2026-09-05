import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CategoriesController } from "./categories.controller";
import {
  createCategoryPayloadValidationSchema,
  updateCategoryPayloadValidationSchema,
} from "./categories.validation";

const router = Router();

// admin only routes
router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(createCategoryPayloadValidationSchema),
  CategoriesController.createCategory,
);

router.patch(
  "/:categoryId",
  auth(Role.ADMIN),
  validateRequest(updateCategoryPayloadValidationSchema),
  CategoriesController.updateCategory,
);

router.delete(
  "/:categoryId",
  auth(Role.ADMIN),
  CategoriesController.deleteCategoty,
);

// public routes with constraint
router.get(
  "/",
  optionalAuth, // NOT the strict auth() guard — never blocks the request
  CategoriesController.getAllCategories,
);

export const CategoriesRoutes = router;
