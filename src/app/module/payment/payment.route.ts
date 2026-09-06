import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import validateQuery from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// customer only routes
router.post(
  "/initiate",
  auth(Role.CUSTOMER),
  validateRequest(PaymentValidation.validateInitiatePaymentPayloadSchema),
  PaymentController.initiatePayment,
);

router.post(
  "/re-initiate",
  auth(Role.CUSTOMER),
  validateRequest(PaymentValidation.validateInitiatePaymentPayloadSchema),
  PaymentController.reinitiatePaymentController,
);

router.get(
  "/me",
  auth(Role.CUSTOMER),
  validateQuery(PaymentValidation.getMyPaymentsQueryValidationSchema),
  PaymentController.getMyPaymentsController,
);

// payment callback route, bkash only
router.get("/callback", PaymentController.paymentCallbackController);

// admin only routes
router.post(
  "/:paymentId/refund",
  auth(Role.ADMIN),
  validateRequest(PaymentValidation.refundPaymentPayloadValidationSchema),
  PaymentController.refundPaymentController,
);

// multi auth routes
router.get(
  "/:paymentId",
  auth(Role.CUSTOMER, Role.TECHNICIAN, Role.ADMIN),
  PaymentController.getPaymentByIdController,
);

export const PaymentRoutes = router;
