import { z } from "zod";
import { AvailabilityStatus, DayPeriod } from "../../../generated/prisma/enums";

const setAvailabilityPayloadValidationSchema = z.object({
  date: z.iso
    .date({ error: "Date must be a valid ISO date (YYYY-MM-DD)." })
    .refine((val) => new Date(val) >= new Date(new Date().toDateString()), {
      error: "Date cannot be in the past.",
    }),
  periods: z
    .array(z.enum(DayPeriod))
    .min(1, { error: "Select at least one period." })
    .refine((arr) => new Set(arr).size === arr.length, {
      error: "Duplicate periods for the same date are not allowed.",
    }),
});

const blockAvailabilityPayloadValidationSchema = z.object({
  status: z.literal(AvailabilityStatus.BLOCKED, {
    error: `Status can only be  ${AvailabilityStatus.BLOCKED}`,
  }),
});

const getAllAvailabilityQueryValidationSchema = z.object({
  technicianProfileId: z
    .uuid({ message: "technicianProfileId must be a valid UUID." })
    .optional(),
  date: z.iso
    .date({ message: "date must be a valid ISO date (YYYY-MM-DD)." })
    .optional(),
  status: z
    .enum(AvailabilityStatus, {
      message: "status must be one of OPEN, BOOKED, BLOCKED.",
    })
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(["date", "period", "status", "createdAt"])
    .optional()
    .default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export const AvailabilityValidation = {
  setAvailabilityPayloadValidationSchema,
  blockAvailabilityPayloadValidationSchema,
  getAllAvailabilityQueryValidationSchema,
};

export type TAvailabilityPayload = z.infer<
  typeof setAvailabilityPayloadValidationSchema
>;

export type TBlockAvailabilityPayload = z.infer<
  typeof blockAvailabilityPayloadValidationSchema
>;

export type TAvailabilityQuery = z.infer<
  typeof getAllAvailabilityQueryValidationSchema
>;
