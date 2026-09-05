import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TechniciansController } from "./technicians.controller";
import { applyAsTechnicianValidationSchema } from "./technicians.validation";

const router = Router();

router.post(
  "/apply",
  auth(Role.CUSTOMER),
  validateRequest(applyAsTechnicianValidationSchema),
  TechniciansController.applyAsTechnician,
);

export const TechniciansRoutes = router;
