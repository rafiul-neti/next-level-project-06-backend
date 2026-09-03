import type { z } from "zod";
import type {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

export type TForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type TResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
