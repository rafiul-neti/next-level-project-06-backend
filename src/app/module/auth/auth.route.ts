import { Router } from "express";
import { upload } from "../../lib/multer";
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
  upload.single("profileImage"),
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

router.post("/google", AuthController.googleLogin);

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
