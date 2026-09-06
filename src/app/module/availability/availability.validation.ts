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

export const AvailabilityValidation = {
  setAvailabilityPayloadValidationSchema,
  blockAvailabilityPayloadValidationSchema,
};

export type TAvailabilityPayload = z.infer<
  typeof setAvailabilityPayloadValidationSchema
>;

export type TBlockAvailabilityPayload = z.infer<
  typeof blockAvailabilityPayloadValidationSchema
>;
