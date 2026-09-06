import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

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

export const PaymentRoutes = router;
