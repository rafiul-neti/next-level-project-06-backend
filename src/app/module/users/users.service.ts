import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import type {
  TechnicianProfileUpdateInput,
  UserUpdateInput,
} from "../../../generated/prisma/models";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { IUpdateMePayload } from "./users.interface";

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    ...(user.role === Role.TECHNICIAN && {
      include: { technicianProfile: true },
    }),
    omit: {
      password: true,
    },
  });

  if (!isUserExists || isUserExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (isUserExists.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked!");
  }

  if (!isUserExists.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "User email is unverified!");
  }

  return isUserExists;
};

const updateMe = async (
  payload: IUpdateMePayload,
  user: IRequestUser,
  profileImageBuffer?: Buffer,
) => {
  const { name, contactNumber, address, bio, serviceArea, yearsOfExperience } =
    payload;

  const updateUserInfo: UserUpdateInput = {};
  const updateTechnicianInfo: TechnicianProfileUpdateInput = {};

  let uploadUpdatedProfileImageAndGetLink: UploadApiResponse | null = null;

  const isUserExists = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!isUserExists || isUserExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (isUserExists.isBlocked) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked!");
  }

  if (!isUserExists.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "User email is unverified!");
  }

  if (profileImageBuffer) {
    uploadUpdatedProfileImageAndGetLink = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "auto" }, async (error, result) => {
            if (error) {
              return reject(error);
            }

            if (!result) {
              return reject(
                new AppError(
                  httpStatus.INTERNAL_SERVER_ERROR,
                  "No result returned from Cloudinary: at registerUser in auth.service; uploading profile image!",
                ),
              );
            }

            resolve(result);
          })
          .end(profileImageBuffer);
      },
    );

    if (isUserExists.profileImage && isUserExists.profileImagePublicId) {
      await cloudinary.uploader.destroy(isUserExists.profileImagePublicId);
    }
  }

  if (name) {
    updateUserInfo.name = name;
  }

  if (contactNumber) {
    updateUserInfo.contactNumber = contactNumber;
  }

  if (address) {
    updateUserInfo.address = address;
  }

  if (user.role === Role.TECHNICIAN) {
    if (bio) {
      updateTechnicianInfo.bio = bio;
    }

    if (yearsOfExperience) {
      updateTechnicianInfo.yearsOfExperience = yearsOfExperience;
    }

    if (serviceArea) {
      updateTechnicianInfo.serviceArea;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: isUserExists.id },
    data: {
      ...updateUserInfo,
      ...(uploadUpdatedProfileImageAndGetLink && {
        profileImage: uploadUpdatedProfileImageAndGetLink.secure_url,
        profileImagePublicId: uploadUpdatedProfileImageAndGetLink.public_id,
      }),
      ...(user.role === Role.TECHNICIAN && {
        technicianProfile: { update: updateTechnicianInfo },
      }),
    },
    omit: { password: true },
    ...(user.role === Role.TECHNICIAN && {
      include: { technicianProfile: true },
    }),
  });

  return updatedUser;
};

export const UsersService = { getMe, updateMe };
