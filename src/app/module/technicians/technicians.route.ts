import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TechniciansController } from "./technicians.controller";
import {
  applyAsTechnicianValidationSchema,
  updateTechnicianApplicationStatusValidationSchema,
} from "./technicians.validation";

const router = Router();

router.post(
  "/apply",
  auth(Role.CUSTOMER),
  validateRequest(applyAsTechnicianValidationSchema),
  TechniciansController.applyAsTechnician,
);

router.patch(
  "/:userId/update-application-status",
  auth(Role.ADMIN),
  validateRequest(updateTechnicianApplicationStatusValidationSchema),
  TechniciansController.updateTechnicianApplicationStatus,
);

export const TechniciansRoutes = router;
