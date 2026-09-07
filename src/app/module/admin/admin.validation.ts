import { z } from "zod";
import { AuditAction, Role } from "../../../generated/prisma/enums";

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

const toggleUserBlockPayloadValidationSchema = z.object({
  status: z.enum(["BLOCK", "UNBLOCK"], {
    error: "Block status must be one of 'BLOCK' or 'UNBLOCK'!",
  }),
});

const changeUserRolePayloadValidationSchema = z.object({
  role: z.enum(Role, {
    message: "role must be one of CUSTOMER, TECHNICIAN, ADMIN.",
  }),
});

export const AdminValidation = {
  getAllAuditLogsQueryValidationSchema,
  toggleUserBlockPayloadValidationSchema,
  changeUserRolePayloadValidationSchema,
};

export type TGetAllAuditLogsQuery = z.infer<
  typeof getAllAuditLogsQueryValidationSchema
>;

export type TToggleUserBlockPayload = z.infer<
  typeof toggleUserBlockPayloadValidationSchema
>;

export type TChangeUserRolePayload = z.infer<
  typeof changeUserRolePayloadValidationSchema
>;
