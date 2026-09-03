import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { UsersService } from "./users.service";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as IRequestUser;

  if (!user) {
    throw new Error("User information is missing in the request");
  }

  const result = await UsersService.getMe(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "User profile fetched successfully",
    data: result,
  });
});

export const UsersController = { getMe };
