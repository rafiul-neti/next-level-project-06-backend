import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { UsersController } from "./users.controller";

const router = Router();

router.get(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN),
  UsersController.getMe,
);

export const UsersRoutes = router;
