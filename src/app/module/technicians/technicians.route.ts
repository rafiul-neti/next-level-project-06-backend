import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { QuerySchema } from "../../../validations";
import { auth } from "../../middleware/checkAuth";
import validateQuery from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { TechniciansController } from "./technicians.controller";
import {
  addTechnicianSkillValidationSchema,
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

// public routes
router.get(
  "/public",
  validateQuery(QuerySchema),
  TechniciansController.getAllPublicTechnicians,
);

router.get(
  "/public/:technicianId",
  TechniciansController.getSinglePublicTechnicianDetails,
);

// technician only routes
router.post(
  "/me/skills",
  auth(Role.TECHNICIAN),
  validateRequest(addTechnicianSkillValidationSchema),
  TechniciansController.addTechnicianSkill,
);

export const TechniciansRoutes = router;
