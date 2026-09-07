import { z } from "zod";
import { AuditAction } from "../../../generated/prisma/enums";

const getAllAuditLogsQueryValidationSchema = z.object({
  action: z.enum(AuditAction).optional(),
  entityType: z.string().trim().min(1).optional(),
  actorId: z.uuid({ message: "actorId must be a valid UUID." }).optional(),
  serviceRequestId: z
    .uuid({ message: "serviceRequestId must be a valid UUID." })
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const AdminValidation = { getAllAuditLogsQueryValidationSchema };

export type TGetAllAuditLogsQuery = z.infer<
  typeof getAllAuditLogsQueryValidationSchema
>;
