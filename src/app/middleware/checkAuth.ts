import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        name: string;
        userId: string;
        role: Role;
        technicianProfileId?: string;
      };
    }
  }
}

// auth(Role.ADMIN, Role.USER, Role.Author)
// auth() => ...requiredRoles => [Role.ADMIN, Role.USER, Role.AUTHOR]
export const auth = (...requiredRoles: Role[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization?.split(" ")[1]
        : req.headers.authorization;

    if (!token) {
      throw new Error(
        "You are not logged in. Please log in to access this resource.",
      );
    }

    const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

    if (!verifiedToken.success) {
      throw new Error(verifiedToken.error);
    }

    const { email, name, userId, role } = verifiedToken.data as JwtPayload;

    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new Error(
        "Forbidden. You don't have permission to access this resource.",
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        email,
        name,
        role,
      },
      include: { technicianProfile: { select: { id: true } } },
    });

    if (!user) {
      throw new AppError(404, "User not found. Please log in again.");
    }

    if (user.isDeleted) {
      throw new AppError(404, "User is deleted from the platform.");
    }

    if (user.isBlocked) {
      throw new AppError(404, "User is blocked. Please contact support.");
    }

    if (!user.isEmailVerified) {
      throw new AppError(
        400,
        "Email is not verified. Please verify your email.",
      );
    }

    req.user = {
      email,
      name,
      userId,
      role,
      ...(role === Role.TECHNICIAN && {
        technicianProfileId: user.technicianProfile?.id,
      }),
    };

    next();
  });
};
