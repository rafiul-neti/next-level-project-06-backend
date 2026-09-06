import { z } from "zod";
import { DayPeriod } from "../../../generated/prisma/enums";

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

export const AvailabilityValidation = {
  setAvailabilityPayloadValidationSchema,
};

export type TAvailabilityPayload = z.infer<
  typeof setAvailabilityPayloadValidationSchema
>;
