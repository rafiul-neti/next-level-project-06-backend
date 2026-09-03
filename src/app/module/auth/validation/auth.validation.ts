import { z } from "zod";
import { Role } from "../../../../generated/prisma/enums";
import { RedisKeyPrefix } from "../../../utils/redisActions";

export const registerUserValidationSchema = z.object({
  name: z.string().min(3, { error: "Name is required!" }),
  email: z.email(),
  password: z
    .string()
    .min(8, "Password Must at least 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
  role: z.enum([Role.CUSTOMER, Role.TECHNICIAN], {
    error: "User role must be one of CUSTOMER or TECHNICIAN!",
  }),
});

export const loginValidationSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, "Password Must at least 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

export const verifyEmailPayloadVerificationSchema = z.object({
  email: z.email(),
  otp: z.string().length(6, { error: "OTP must be a 6-digit number!" }),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  email: z.email(),
  newPassword: z
    .string()
    .min(8, "Password Must at least 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
  otp: z.string().length(6, "OTP must be a 6-digit number!"),
  otpFor: z.enum(
    [RedisKeyPrefix.FORGOT_PASSWORD_OTP, RedisKeyPrefix.RESET_PASSWORD_OTP],
    {
      error: `Key prefix (otpFor) must be one of 'forgot-password-OTP or 'reset-password-OTP'`,
    },
  ),
});
