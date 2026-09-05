import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import config from "../config";
import { jwtUtils } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        name: string;
        userId: string;
        role: Role;
      };
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.accessToken
    ? req.cookies.accessToken
    : req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization?.split(" ")[1]
      : req.headers.authorization;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwtUtils.verifyToken(token, config.jwt_access_secret);
    if (!decoded.success) {
      return next();
    }

    const { email, name, userId, role } = decoded.data as JwtPayload;
    req.user = { email, name, userId, role };
  } catch {}

  next();
}
