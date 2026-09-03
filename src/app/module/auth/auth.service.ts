import path from "node:path";
import bcrypt from "bcryptjs";
import ejs from "ejs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import {
  Actions,
  RedisKeyPrefix,
  redisActions,
} from "../../utils/redisActions";
import { renderOtpEmail } from "../../utils/renderOtpEmail";
import type {
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterUserPayload,
  IVerifyEmailPayload,
} from "./auth.interface";
import type {
  TForgotPasswordPayload,
  TResetPasswordPayload,
} from "./validation/typesFromValidationSchemas";

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

  const html = await renderOtpEmail({
    purpose: "VERIFY_EMAIL",
    appName: "Field Service Management",
    name,
    otp: OTP as string,
    expiresInMinutes: expirationSeconds / 60,
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

  if (user.isBlocked) {
    throw new Error("User is blocked");
  }

  if (!user.isEmailVerified) {
    throw new Error("User email is not verified!");
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

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

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | undefined | null = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("google id token verification failed", error);
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired google id token.",
    );
  }

  if (!googleIdTokenPayload) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired google id tolen.",
    );
  }

  if (!googleIdTokenPayload.email) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Google account email not found! Please try again.",
    );
  }

  const isCustomerExists = await prisma.user.findFirst({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.CUSTOMER,
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = isCustomerExists;

  if (!user) {
    const isCustomerExistsWithCredentials = await prisma.user.findFirst({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.CUSTOMER,
        authProvider: AuthProvider.CREDENTIAL,
      },
    });

    if (isCustomerExistsWithCredentials) {
      if (!isCustomerExistsWithCredentials.isEmailVerified) {
        throw new AppError(httpStatus.FORBIDDEN, "Email not verified!");
      }

      if (isCustomerExistsWithCredentials.isBlocked) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Your account has been blocked. Please contact support.",
        );
      }

      if (isCustomerExistsWithCredentials.isDeleted) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Your account has been deleted. Please contact support.",
        );
      }

      user = await prisma.user.update({
        where: { id: isCustomerExistsWithCredentials.id },
        data: { googleId: googleIdTokenPayload.sub },
      });
    } else {
      // user register with google
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name ?? "name",
          email: googleIdTokenPayload.email,
          role: Role.CUSTOMER,
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
          isEmailVerified: true,
        },
      });

      const html = await ejs.renderFile(
        path.join(process.cwd(), "src/app/templates/welcome-to-the-FSM.ejs"),
        {
          appName: "Field Service Management",
          name: user.name,
          role: user.role, // 'CUSTOMER' | 'TECHNICIAN'
          ctaUrl:
            user.role === Role.TECHNICIAN
              ? `${config.frontend_url}/technician/dashboard`
              : `${config.frontend_url}/service-requests/new`,
          ctaLabel:
            user.role === Role.TECHNICIAN
              ? "Go to dashboard"
              : "Create a service request",
          currentYear: new Date().getFullYear(),
        },
      );

      await transporter.sendMail({
        from: config.email_sender,
        to: user.email,
        subject: `Welcome to Field Service Management System, ${user.name}!`,
        html,
      });
    }
  }

  if (user.isBlocked) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support.",
    );
  }

  if (user.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been deleted. Please contact support.",
    );
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

const forgotPassword = async (payload: TForgotPasswordPayload) => {
  const { email } = payload;

  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (!isUserExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No account found. Check your email address and try again.",
    );
  }

  if (isUserExists.isBlocked) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support.",
    );
  }

  if (isUserExists.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is deleted!");
  }

  if (!isUserExists.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email unverified! Please verify your email first.",
    );
  }

  if (
    isUserExists.authProvider !== AuthProvider.CREDENTIAL ||
    isUserExists.password === null
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid request: forgot password!",
    );
  }

  const expirationSeconds = 5 * 60;

  const setOTPToRedis = await redisActions({
    keyPrefix: RedisKeyPrefix.FORGOT_PASSWORD_OTP,
    keySuffix: email,
    action: Actions.SET_OTP,
    expirationSeconds,
  });

  const html = await renderOtpEmail({
    purpose: "RESET_PASSWORD",
    appName: "Field Service Management",
    name: isUserExists.name,
    otp: setOTPToRedis as string,
    expiresInMinutes: expirationSeconds / 60,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExists.email,
    subject: "FSM - Forgot Password OTP",
    html,
  });
};

const resetPassword = async (payload: TResetPasswordPayload) => {
  const { email, newPassword, otp, otpFor } = payload;

  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (!isUserExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No account found. Check your email address and try again.",
    );
  }

  if (isUserExists.isBlocked) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support.",
    );
  }

  if (isUserExists.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is deleted!");
  }

  if (!isUserExists.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email unverified! Please verify your email first.",
    );
  }

  if (
    isUserExists.authProvider !== AuthProvider.CREDENTIAL ||
    isUserExists.password === null
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid request: forgot password!",
    );
  }

  const OTP = await redisActions({
    keyPrefix: otpFor,
    keySuffix: email,
    action: Actions.GET_OTP,
  });

  if (otp !== OTP) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP!");
  }

  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const updateUser = await prisma.user.update({
    where: { email: isUserExists.email },
    data: { password: hashedNewPassword },
  });

  await redisActions({
    keyPrefix: otpFor,
    keySuffix: email,
    action: Actions.DEL_OTP,
  });

  const resetPasswordEmailHTML = await ejs.renderFile(
    path.join(process.cwd(), "src/app/templates/reset-password-success.ejs"),
    {
      appName: "Field Service Management",
      name: updateUser.name,
      changedAt: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      currentYear: new Date().getFullYear(),
    },
  );

  transporter.sendMail({
    from: config.email_sender,
    to: isUserExists.email,
    subject: "PH-Healthcare - Forgot Password OTP",
    html: resetPasswordEmailHTML,
  });

  return updateUser;
};

export const AuthService = {
  registerUser,
  verifyEmail,
  loginUser,
  googleLogin,
  refreshToken,
  forgotPassword,
  resetPassword,
};
