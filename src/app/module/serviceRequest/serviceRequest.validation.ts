import { z } from "zod";

export const attachmentValidationSchema = z.object({
  url: z.url({ message: "Attachment url must be a valid URL." }),
  publicId: z.string().min(1, { message: "publicId is required." }),
});

export const createServiceRequestPayloadValidationSchema = z.object({
  categoryId: z.uuid({ message: "Invalid category reference!" }),
  title: z
    .string()
    .trim()
    .min(5, { message: "Title must be at least 5 characters." })
    .max(150, { message: "Title must not exceed 150 characters." }),
  description: z
    .string()
    .trim()
    .min(20, { message: "Description must be at least 20 characters." })
    .max(2000, { message: "Description must not exceed 2000 characters." }),
  address: z
    .string()
    .trim()
    .min(10, { message: "Address must be at least 10 characters long." })
    .max(255, { message: "Address must not exceed 255 characters." }),
  attachmentUrls: z
    .array(attachmentValidationSchema)
    .max(5, { message: "You can attach at most 5 files." })
    .optional(),
});

export const ServiceRequestValidation = {
  createServiceRequestPayloadValidationSchema,
};

export type TServiceRequestPayload = z.infer<
  typeof createServiceRequestPayloadValidationSchema
>;
