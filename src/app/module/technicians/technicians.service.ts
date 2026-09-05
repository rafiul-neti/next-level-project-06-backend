import httpStatus from "http-status";
import {
  AuditAction,
  Role,
  TechnicianApplicationStatus,
} from "../../../generated/prisma/enums";
import type { TechnicianProfileWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  IApplyTechnicianPayload,
  IUpdateTechnicianApllicationStatusPayload,
} from "./technicians.interface";
import type { TGetAllTechniciansQuery } from "./technicians.validation";

async function applyAsTechnician(
  payload: IApplyTechnicianPayload,
  user: IRequestUser,
) {
  const { availability, bio, categoryIds, yearsOfExperience, serviceArea } =
    payload;

  const isUserExists = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { technicianProfile: true },
  });

  if (!isUserExists || isUserExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found!");
  }

  if (isUserExists.isBlocked) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been blocked. Please contact support for assistance.",
    );
  }

  if (!isUserExists.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Please verify your email before applying to become a technician.",
    );
  }

  if (isUserExists.technicianProfile) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Technician profile already exists.",
    );
  }

  const technicianProfile = await prisma.user.update({
    where: { id: isUserExists.id },
    data: {
      technicianProfile: {
        create: {
          bio,
          serviceArea,
          yearsOfExperience,
          availability: {
            createMany: {
              data: availability.flatMap((entry) =>
                entry.periods.map((period) => ({
                  date: new Date(entry.date),
                  period,
                })),
              ),
            },
          },
          skills: {
            createMany: {
              data: categoryIds.map((categoryId) => ({ categoryId })),
            },
          },
        },
      },
    },
    include: {
      technicianProfile: {
        include: {
          availability: true,
          skills: true,
        },
      },
    },
    omit: { password: true },
  });

  return technicianProfile;
}

// admin only services
async function updateTechnicianApplicationStatus(
  userId: string,
  payload: IUpdateTechnicianApllicationStatusPayload,
  actorId: string,
) {
  const isUserExists = await prisma.user.findUnique({
    where: { id: userId },
    include: { technicianProfile: true },
    omit: { password: true },
  });

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found!");
  }

  const technicianProfile = isUserExists.technicianProfile;

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found!");
  }

  const updateStatusTransactionResult = await prisma.$transaction(
    async (tx) => {
      const previousStatus = technicianProfile.applicationStatus;

      const newStatus =
        payload.decision === TechnicianApplicationStatus.APPROVED
          ? TechnicianApplicationStatus.APPROVED
          : TechnicianApplicationStatus.REJECTED;

      const updateTechnicianApplicationStatus = await tx.user.update({
        where: { id: isUserExists.id },
        data: {
          ...(payload.decision === TechnicianApplicationStatus.APPROVED && {
            role: Role.TECHNICIAN,
          }),
          technicianProfile: {
            update: {
              applicationStatus: newStatus,
            },
          },
        },
        include: { technicianProfile: true },
        omit: { password: true },
      });

      await prisma.auditLog.create({
        data: {
          actorId,
          action: AuditAction.ACCOUNT_ACTION,
          entityType: "TechnicianProfile",
          entityId: technicianProfile.id,
          metadata: {
            from: previousStatus,
            to: newStatus,
          },
        },
      });

      return updateTechnicianApplicationStatus;
    },
  );

  return updateStatusTransactionResult;
}

async function getAllTechnicians(query: TGetAllTechniciansQuery) {
  const limit = query.limit ? query.limit : 10;
  const page = query.page ? query.page : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: TechnicianProfileWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          user: { name: { contains: query.searchTerm, mode: "insensitive" } },
        },
        {
          user: { email: { contains: query.searchTerm, mode: "insensitive" } },
        },
      ],
    });
  }

  const technicians = await prisma.technicianProfile.findMany({
    where: { AND: andConditions },
    take: limit,
    skip,
    orderBy: { [sortBy]: sortOrder },
    include: { user: { select: { name: true, email: true } } },
  });

  const totalTechnicians = await prisma.technicianProfile.count({
    where: { AND: andConditions },
  });

  return {
    data: technicians,
    meta: {
      page,
      limit,
      total: totalTechnicians,
      totalPages: Math.ceil(totalTechnicians / limit),
    },
  };
}

export const TechniciansService = {
  applyAsTechnician,
  updateTechnicianApplicationStatus,
  getAllTechnicians,
};
