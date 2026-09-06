import { z } from "zod";
import { ServiceRequestStatus } from "../../../generated/prisma/enums";

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

const cancelServiceRequestPayloadValidationSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(10, { message: "cancellationReason must be at least 10 characters." })
    .max(500, {
      message: "cancellationReason must not exceed 500 characters.",
    }),
});

const getAllServiceRequestsQueryValidationSchema = z.object({
  status: z.enum(ServiceRequestStatus).optional(),
  categoryId: z
    .uuid({ message: "categoryId must be a valid UUID." })
    .optional(),
  technicianId: z
    .uuid({ message: "technicianId must be a valid UUID." })
    .optional(),
  searchTerm: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z
    .enum(["createdAt", "updatedAt", "status", "title"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const ServiceRequestValidation = {
  createServiceRequestPayloadValidationSchema,
  cancelServiceRequestPayloadValidationSchema,
  getAllServiceRequestsQueryValidationSchema,
};

export type TServiceRequestPayload = z.infer<
  typeof createServiceRequestPayloadValidationSchema
>;

export type TCancelServiceRequestPayload = z.infer<
  typeof cancelServiceRequestPayloadValidationSchema
>;

export type TGetAllServiceRequestsQuery = z.infer<
  typeof getAllServiceRequestsQueryValidationSchema
>;
