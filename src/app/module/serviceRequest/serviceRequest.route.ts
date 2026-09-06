import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import validateQuery from "../../middleware/validateQuery";
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

// technician only routes
router.get(
  "/assigned-to-me",
  auth(Role.TECHNICIAN),
  validateQuery(
    ServiceRequestValidation.getMyAssignedServiceRequestsQueryValidationSchema,
  ),
  ServiceRequestController.getMyAssignedServiceRequestsController,
);

router.patch(
  "/:serviceRequestId/start",
  auth(Role.TECHNICIAN),
  ServiceRequestController.startServiceRequestController,
);

// admin only routes
router.get(
  "/",
  auth(Role.ADMIN),
  validateQuery(
    ServiceRequestValidation.getAllServiceRequestsQueryValidationSchema,
  ),
  ServiceRequestController.getAllServiceRequests,
);

router.patch(
  "/:serviceRequestId/review",
  auth(Role.ADMIN),
  ServiceRequestController.reviewServiceRequestController,
);

router.patch(
  "/:serviceRequestId/assign",
  auth(Role.ADMIN),
  validateRequest(
    ServiceRequestValidation.assignServiceRequestPayloadValidationSchema,
  ),
  ServiceRequestController.assignServiceRequestController,
);

// multi-auth routes
router.patch(
  "/:serviceRequestId/cancel",
  auth(Role.CUSTOMER, Role.ADMIN),
  validateRequest(
    ServiceRequestValidation.cancelServiceRequestPayloadValidationSchema,
  ),
  ServiceRequestController.cancelServiceRequest,
);

router.get(
  "/:serviceRequestId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, Role.ADMIN),
  ServiceRequestController.getServiceRequestByIdController,
);

export const ServiceRequestRoutes = router;
