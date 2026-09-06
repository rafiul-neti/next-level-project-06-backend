import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityValidation } from "./availability.validation";

const router = Router();

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

export const AvailabilityRoutes = router;
