import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
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

// payment callback route, bkash only
router.get("/callback", PaymentController.paymentCallbackController);

// admin only routes
router.post(
  "/:paymentId/refund",
  auth(Role.ADMIN),
  validateRequest(PaymentValidation.refundPaymentPayloadValidationSchema),
  PaymentController.refundPaymentController,
);

export const PaymentRoutes = router;
