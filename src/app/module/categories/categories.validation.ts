import { z } from "zod";

export const createCategoryPayloadValidationSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Category name must be at least 3 characters long!" })
    .max(15, { error: "Category name must not exceed 15 characters!" }),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters long." })
    .max(450, { message: "Description must not exceed 450 characters." })
    .optional(),
});

export type TCreateCategoryPayload = z.infer<
  typeof createCategoryPayloadValidationSchema
>;
