import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
  forgotPasswordSchema,
  loginValidationSchema,
  registerUserValidationSchema,
  resetPasswordSchema,
  verifyEmailPayloadVerificationSchema,
} from "./validation/auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(registerUserValidationSchema),
  AuthController.registerUser,
);

router.post(
  "/verify-otp",
  validateRequest(verifyEmailPayloadVerificationSchema),
  AuthController.verifyEmail,
);

router.post(
  "/login",
  validateRequest(loginValidationSchema),
  AuthController.loginUser,
);

router.get(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN),
  AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword,
);

export const AuthRoutes = router;
