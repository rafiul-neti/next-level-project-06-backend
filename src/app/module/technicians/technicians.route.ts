import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import validateQuery from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { TechniciansController } from "./technicians.controller";
import {
  applyAsTechnicianValidationSchema,
  getAllTechniciansQuerySchema,
  updateTechnicianApplicationStatusValidationSchema,
} from "./technicians.validation";

const router = Router();

router.post(
  "/apply",
  auth(Role.CUSTOMER),
  validateRequest(applyAsTechnicianValidationSchema),
  TechniciansController.applyAsTechnician,
);

// admin only routes
router.patch(
  "/:userId/update-application-status",
  auth(Role.ADMIN),
  validateRequest(updateTechnicianApplicationStatusValidationSchema),
  TechniciansController.updateTechnicianApplicationStatus,
);

router.get(
  "/",
  auth(Role.ADMIN),
  validateQuery(getAllTechniciansQuerySchema),
  TechniciansController.getAlltechnicians,
);

export const TechniciansRoutes = router;
