import { z } from "zod";

const phoneSchema = z.string().regex(/^01[3-9]\d{8}$/, {
  message:
    "Phone number must be a valid Bangladeshi number (11 digits, starting with 013–019).",
});

export const updateMePayloadValidationSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Name must be at least 3 characters long!" })
    .optional(),
  contactNumber: phoneSchema.optional(),
  address: z
    .string()
    .trim()
    .min(10, { message: "Address must be at least 10 characters long." })
    .max(255, { message: "Address must not exceed 255 characters." })
    .optional(),
  bio: z
    .string()
    .trim()
    .min(10, { message: "Bio must be at least 10 characters long." })
    .max(400, { message: "Bio must not exceed 400 characters." })
    .optional(),
  yearsOfExperience: z.coerce.number().min(0).optional(),
  serviceArea: z.string().optional(),
});
