import type { Role } from "../../../generated/prisma/browser";

export interface ILoginUserPayload {
  email: string;
  password: string;
}

export interface IRegisterUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface IRequestUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface IGoogleLoginPayload {
  idToken: string;
}
