import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CategoriesController } from "./categories.controller";
import { createCategoryPayloadValidationSchema } from "./categories.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(createCategoryPayloadValidationSchema),
  CategoriesController.createCategory,
);

export const CategoriesRoutes = router;
