import { z } from "zod";

const validateInitiatePaymentPayloadSchema = z.object({
  serviceId: z.uuid({ error: "Invalid Service Reference!" }),
});

const refundPaymentPayloadValidationSchema = z.object({
  refundReason: z
    .string()
    .trim()
    .min(10, { message: "refundReason must be at least 10 characters." })
    .max(500, { message: "refundReason must not exceed 500 characters." })
    .optional(),
});

export const PaymentValidation = {
  validateInitiatePaymentPayloadSchema,
  refundPaymentPayloadValidationSchema,
};

export type TInitiatePaymentPayload = z.infer<
  typeof validateInitiatePaymentPayloadSchema
>;

export type TRefundPaymentPayload = z.infer<
  typeof refundPaymentPayloadValidationSchema
>;
