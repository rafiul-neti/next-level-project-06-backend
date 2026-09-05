import { z } from "zod";
import {
  DayPeriod,
  TechnicianApplicationStatus,
} from "../../../generated/prisma/enums";
import { QuerySchema } from "../../../validations";

export const availabilityInputValidationSchema = z.object({
  date: z.iso.date({ message: "Date must be a valid ISO date (YYYY-MM-DD)." }),
  periods: z
    .array(z.enum(DayPeriod))
    .min(1, { message: "Select at least one period for this date." })
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Duplicate periods for the same date are not allowed.",
    }),
});

export const applyAsTechnicianValidationSchema = z.object({
  bio: z
    .string()
    .trim()
    .min(20, {
      message:
        "Bio must be at least 20 characters — tell us about your experience.",
    })
    .max(1000, { message: "Bio must not exceed 1000 characters." }),
  yearsOfExperience: z
    .number()
    .int({ message: "Years of experience must be a whole number." })
    .min(0, { message: "Years of experience cannot be negative." })
    .max(60, {
      message:
        "Years of experience seems unrealistic — please check the value.",
    }),
  serviceArea: z
    .string()
    .trim()
    .min(2, { message: "Service area is required." })
    .max(100, { message: "Service area must not exceed 100 characters." }),
  categoryIds: z
    .array(z.uuid({ message: "Each category ID must be a valid UUID." }))
    .min(1, { message: "Select at least one service category." }),
  availability: z
    .array(availabilityInputValidationSchema)
    .min(1, { message: "Provide at least one availability window." }),
});

export const updateTechnicianApplicationStatusValidationSchema = z.object({
  decision: z.enum(TechnicianApplicationStatus),
});

export const getAllTechniciansQuerySchema = z.object({
  ...QuerySchema.shape,
  status: z.enum(TechnicianApplicationStatus),
});

// types based on the zod schemas
export type TGetAllTechniciansQuery = z.infer<
  typeof getAllTechniciansQuerySchema
>;
