import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ServiceRequestController } from "./serviceRequest.controller";
import { ServiceRequestValidation } from "./serviceRequest.validation";

const router = Router();

// customer only routes
router.post(
  "/",
  auth(Role.CUSTOMER),
  upload.fields([{ name: "requestAttachments", maxCount: 5 }]),
  validateRequest(
    ServiceRequestValidation.createServiceRequestPayloadValidationSchema,
  ),
  ServiceRequestController.createServiceRequest,
);

router.get("/me", auth(Role.CUSTOMER), ServiceRequestController.getMyRequests);

export const ServiceRequestRoutes = router;
