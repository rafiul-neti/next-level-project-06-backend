import { z } from "zod";

const validateInitiatePaymentPayloadSchema = z.object({
  serviceId: z.uuid({ error: "Invalid Service Reference!" }),
});

export const PaymentValidation = { validateInitiatePaymentPayloadSchema };

export type TInitiatePaymentPayload = z.infer<
  typeof validateInitiatePaymentPayloadSchema
>;
