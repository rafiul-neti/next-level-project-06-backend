import httpStatus from "http-status";
import {
  AuditAction,
  Role,
  TechnicianApplicationStatus,
} from "../../../generated/prisma/enums";
import type { TechnicianProfileWhereInput } from "../../../generated/prisma/models";
import type { TQuerySchema } from "../../../validations";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  IApplyTechnicianPayload,
  IUpdateTechnicianApllicationStatusPayload,
} from "./technicians.interface";
import type {
  TAddTechnicianSkillPayload,
  TGetAllTechniciansQuery,
} from "./technicians.validation";

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

  if (query.status) {
    andConditions.push({ applicationStatus: query.status });
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
    data: technicians.map((technician) => {
      const { user, ...technicianInfo } = technician;

      return {
        technicianName: user.name,
        technicianEmail: user.email,
        ...technicianInfo,
      };
    }),
    meta: {
      page,
      limit,
      total: totalTechnicians,
      totalPages: Math.ceil(totalTechnicians / limit),
    },
  };
}

// public routes
async function getAllPublicTechnicians(query: TQuerySchema) {
  const limit = query.limit ? query.limit : 10;
  const page = query.page ? query.page : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: TechnicianProfileWhereInput[] = [
    { applicationStatus: TechnicianApplicationStatus.APPROVED },
  ];

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
    include: {
      user: { select: { id: true, name: true, email: true } },
      skills: {
        select: {
          id: true,
          category: { select: { name: true, description: true } },
        },
      },
      availability: {
        omit: { technicianProfileId: true, createdAt: true, updatedAt: true },
      },
    },
  });

  const totalTechnicians = await prisma.technicianProfile.count({
    where: { AND: andConditions },
  });

  const techniciansList = await Promise.all(
    technicians.map(async (technician) => {
      const { user, skills, ...technicianInfo } = technician;

      const ratingResult = await prisma.feedback.aggregate({
        where: {
          serviceRequest: { technicianId: user.id },
        },
        _avg: { rating: true },
        _count: { rating: true },
      });

      return {
        technicianName: user.name,
        technicianEmail: user.email,
        averageRating: ratingResult._avg.rating,
        totalReviews: ratingResult._count.rating,
        skills: skills.map((skill) => ({
          id: skill.id,
          serviceCategory: skill.category.name,
          description: skill.category.description,
        })),
        ...technicianInfo,
      };
    }),
  );

  return {
    data: techniciansList,
    meta: {
      page,
      limit,
      total: totalTechnicians,
      totalPages: Math.ceil(totalTechnicians / limit),
    },
  };
}

async function getSinglePublicTechnicianDetails(technicianId: string) {
  const technician = await prisma.technicianProfile.findUnique({
    where: {
      id: technicianId,
      applicationStatus: TechnicianApplicationStatus.APPROVED,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      skills: {
        include: {
          category: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      availability: true,
    },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found.");
  }

  const { user, skills, ...technicianInfo } = technician;

  const ratingResult = await prisma.feedback.aggregate({
    where: {
      serviceRequest: { technicianId: user.id },
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    technicianName: user.name,
    technicianEmail: user.email,
    averageRating: ratingResult._avg.rating,
    totalReviews: ratingResult._count.rating,
    skills: skills.map((skill) => ({
      id: skill.id,
      serviceCategory: skill.category.name,
      description: skill.category.description,
    })),
    ...technicianInfo,
  };
}

// technician only routes services
async function addTechnicianSkill(
  payload: TAddTechnicianSkillPayload,
  user: IRequestUser,
) {
  const isTechnicianExists = await prisma.technicianProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!isTechnicianExists || isTechnicianExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found!");
  }

  if (
    isTechnicianExists.applicationStatus !==
    TechnicianApplicationStatus.APPROVED
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `You application is ${isTechnicianExists.applicationStatus}. Please ${isTechnicianExists.applicationStatus === TechnicianApplicationStatus.PENDING ? "wait your application to be APPROVED!" : "try again or contact support!"}`,
    );
  }

  const { category, ...addedSkill } = await prisma.technicianSkill.create({
    data: {
      technicianProfileId: isTechnicianExists.id,
      categoryId: payload.categoryId,
    },
    include: { category: { select: { name: true, description: true } } },
  });

  return {
    ...addedSkill,
    serviceCategory: category.name,
    description: category.description,
  };
}

async function removeTechnicianSkill(categoryId: string, user: IRequestUser) {
  const isTechnicianExists = await prisma.technicianProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!isTechnicianExists || isTechnicianExists.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found!");
  }

  const technicianSkill = await prisma.technicianSkill.findUnique({
    where: {
      technicianProfileId_categoryId: {
        categoryId,
        technicianProfileId: isTechnicianExists.id,
      },
    },
  });

  if (!technicianSkill) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Skill Not Found!");
  }

  const removedSkill = await prisma.technicianSkill.delete({
    where: { id: technicianSkill.id },
  });

  return removedSkill;
}

export const TechniciansService = {
  applyAsTechnician,
  updateTechnicianApplicationStatus,
  getAllTechnicians,
  getAllPublicTechnicians,
  getSinglePublicTechnicianDetails,
  addTechnicianSkill,
  removeTechnicianSkill,
};
