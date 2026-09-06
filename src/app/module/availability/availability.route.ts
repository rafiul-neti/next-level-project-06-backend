import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import validateQuery from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityValidation } from "./availability.validation";

const router = Router();

// technician only routes
router.post(
  "/",
  auth(Role.TECHNICIAN),
  validateRequest(
    AvailabilityValidation.setAvailabilityPayloadValidationSchema,
  ),
  AvailabilityController.setAvailability,
);

router.get(
  "/me",
  auth(Role.TECHNICIAN),
  AvailabilityController.getAvailabilitySlots,
);

router.patch(
  "/:availabilityId/block",
  auth(Role.TECHNICIAN),
  validateRequest(
    AvailabilityValidation.blockAvailabilityPayloadValidationSchema,
  ),
  AvailabilityController.blockAnAvailability,
);

router.delete(
  "/:availabilityId",
  auth(Role.TECHNICIAN),
  AvailabilityController.deleteAvailabilitySlot,
);

// public routes
router.get(
  "/technician/:technicianProfileId",
  optionalAuth,
  AvailabilityController.getOpenAvailabilityForTechnician,
);

// admin only routes
router.get(
  "/",
  auth(Role.ADMIN),
  validateQuery(AvailabilityValidation.getAllAvailabilityQueryValidationSchema),
  AvailabilityController.getAllAvailability,
);

export const AvailabilityRoutes = router;
