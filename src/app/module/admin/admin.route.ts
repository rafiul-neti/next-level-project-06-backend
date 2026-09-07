import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import validateQuery from "../../middleware/validateQuery";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = Router();

router.get(
  "/dashboard-stats",
  auth(Role.ADMIN),
  AdminController.getDashboardStats,
);

router.get(
  "/audit-logs",
  auth(Role.ADMIN),
  validateQuery(AdminValidation.getAllAuditLogsQueryValidationSchema),
  AdminController.getAllAuditLogs,
);

export const AdminRoutes = router;
