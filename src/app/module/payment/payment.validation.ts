import { z } from "zod";
import { PaymentStatus } from "../../../generated/prisma/enums";

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

const getMyPaymentsQueryValidationSchema = z.object({
  status: z.enum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(["createdAt", "updatedAt", "amount"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const getAllPaymentsQueryValidationSchema = z.object({
  status: z.enum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(["createdAt", "updatedAt", "amount"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const PaymentValidation = {
  validateInitiatePaymentPayloadSchema,
  refundPaymentPayloadValidationSchema,
  getMyPaymentsQueryValidationSchema,
  getAllPaymentsQueryValidationSchema,
};

export type TInitiatePaymentPayload = z.infer<
  typeof validateInitiatePaymentPayloadSchema
>;

export type TRefundPaymentPayload = z.infer<
  typeof refundPaymentPayloadValidationSchema
>;

export type TGetMyPaymentsQuery = z.infer<
  typeof getMyPaymentsQueryValidationSchema
>;

export type TGetAllPaymentsQuery = z.infer<
  typeof getAllPaymentsQueryValidationSchema
>;
