import path from "node:path";
import bcrypt from "bcryptjs";
import ejs from "ejs";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import {
  Actions,
  RedisKeyPrefix,
  redisActions,
} from "../../utils/redisActions";
import type {
  ILoginUserPayload,
  IRegisterUserPayload,
  IRequestUser,
  IVerifyEmailPayload,
} from "./auth.interface";

const registerUser = async (payload: IRegisterUserPayload) => {
  const { name, password } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const expirationSeconds = 60 * 5;

  const OTP = await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTER_OTP,
    keySuffix: email,
    action: Actions.SET_OTP,
    expirationSeconds,
  });

  const registrationPayload = {
    name,
    email,
    password: hashedPassword,
    role: payload.role,
  };

  await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTRATION_DATA,
    keySuffix: email,
    action: Actions.SET_REGISTRATION_PAYLOAD,
    registrationPayload,
    expirationSeconds,
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/user-registration-OTP.ejs",
  );

  const html = await ejs.renderFile(templatePath, {
    appName: "Field Service Management",
    name: payload.name,
    otp: OTP,
    expiresInMinutes: expirationSeconds / 60,
    currentYear: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: payload.email,
    subject: "Verify your email",
    html,
  });
};

const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const email = payload.email.trim().toLowerCase();

  const OTP = await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTER_OTP,
    keySuffix: email,
    action: Actions.GET_OTP,
  });

  if (OTP !== payload.otp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP does not match! Please provide a valid OTP.",
    );
  }

  await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTER_OTP,
    keySuffix: email,
    action: Actions.DEL_OTP,
  });

  const getUserDataFromRedis = await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTRATION_DATA,
    keySuffix: email,
    action: Actions.GET_OTP,
  });

  if (!getUserDataFromRedis) {
    throw new AppError(
      httpStatus.GONE,
      "OTP has expired. Please try again after some times.",
    );
  }

  const userData: IRegisterUserPayload = JSON.parse(
    getUserDataFromRedis as string,
  );

  const createdUser = await prisma.user.create({
    data: {
      ...userData,
      isEmailVerified: true,
    },
    omit: { password: true },
  });

  await redisActions({
    keyPrefix: RedisKeyPrefix.USER_REGISTRATION_DATA,
    keySuffix: email,
    action: Actions.DEL_OTP,
  });

  const jwtPayload = {
    userId: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  const html = await ejs.renderFile(
    path.join(process.cwd(), "src/app/templates/welcome-to-the-FSM.ejs"),
    {
      appName: "Field Service Management",
      name: createdUser.name,
      role: createdUser.role, // 'CUSTOMER' | 'TECHNICIAN'
      ctaUrl:
        createdUser.role === "TECHNICIAN"
          ? `${config.frontend_url}/technician/dashboard`
          : `${config.frontend_url}/service-requests/new`,
      ctaLabel:
        createdUser.role === "TECHNICIAN"
          ? "Go to dashboard"
          : "Create a service request",
      currentYear: new Date().getFullYear(),
    },
  );

  await transporter.sendMail({
    from: config.email_sender,
    to: payload.email,
    subject: "Welcome to Field Service Management System",
    html,
  });

  return {
    createdUser,
    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.isDeleted) {
    throw new Error("User is deleted");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  return isUserExists;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted) {
    throw new Error("User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const AuthService = {
  registerUser,
  verifyEmail,
  loginUser,
  getMe,
  refreshToken,
};
