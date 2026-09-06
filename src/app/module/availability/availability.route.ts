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

export const AvailabilityRoutes = router;
