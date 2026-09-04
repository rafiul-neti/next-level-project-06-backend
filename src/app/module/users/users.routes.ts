import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UsersController } from "./users.controller";
import { updateMePayloadValidationSchema } from "./users.validation";

const router = Router();

router.get(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN),
  UsersController.getMe,
);

router.patch(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN),
  upload.single("profileImage"),
  validateRequest(updateMePayloadValidationSchema),
  UsersController.updateMe,
);

export const UsersRoutes = router;
