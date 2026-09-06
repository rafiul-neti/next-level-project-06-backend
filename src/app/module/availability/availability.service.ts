import httpStatus from "http-status";
import { AvailabilityStatus, Role } from "../../../generated/prisma/enums";
import type { TechnicianAvailabilityWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  TAvailabilityPayload,
  TAvailabilityQuery,
  TBlockAvailabilityPayload,
} from "./availability.validation";

async function setAvailability(
  payload: TAvailabilityPayload,
  user: IRequestUser,
) {
  if (user.role !== Role.TECHNICIAN) {
    throw new AppError(httpStatus.FORBIDDEN, "Forbidden Access!");
  }

  const technicianProfile = await prisma.technicianProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found!");
  }

  const createAvailabilitySlots =
    await prisma.technicianAvailability.createManyAndReturn({
      data: payload.periods.map((period) => ({
        technicianProfileId: technicianProfile.id,
        date: new Date(payload.date),
        period,
      })),
      skipDuplicates: true,
    });

  return createAvailabilitySlots;
}

async function getAllAvailabilitySlotsByTechnicianProfileId(
  user: IRequestUser,
) {
  const technicianProfile = await prisma.technicianProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found.");
  }

  const allAvailabilitySlots = await prisma.technicianAvailability.findMany({
    where: { technicianProfileId: technicianProfile.id },
    include: {
      technicianProfile: { select: { user: { select: { name: true } } } },
    },
  });

  return allAvailabilitySlots.map((slot) => {
    const { technicianProfile, ...restInfo } = slot;

    return {
      ...restInfo,
      technicianName: technicianProfile.user.name,
    };
  });
}

async function blockAnAvailability(
  availabilityId: string,
  payload: TBlockAvailabilityPayload,
  user: IRequestUser,
) {
  if (!user.technicianProfileId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Missing Technician Profile Id.",
    );
  }

  const technicianProfile = await prisma.technicianProfile.findUnique({
    where: { id: user.technicianProfileId, userId: user.userId },
  });

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found.");
  }

  const availability = await prisma.technicianAvailability.findFirst({
    where: { id: availabilityId, technicianProfileId: technicianProfile.id },
  });

  if (!availability) {
    throw new AppError(httpStatus.NOT_FOUND, "Availability Slot Not Found.");
  }

  if (availability.status !== AvailabilityStatus.OPEN) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot block a ${availability.status} availability slot.`,
    );
  }

  const blockAvailability = await prisma.technicianAvailability.update({
    where: { id: availability.id },
    data: { status: payload.status },
  });

  return blockAvailability;
}

async function deleteAvailabilitySlot(
  availabilityId: string,
  user: IRequestUser,
) {
  const technicianProfile = await prisma.technicianProfile.findUnique({
    where: { userId: user.userId, id: user.technicianProfileId },
  });

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found.");
  }

  const availability = await prisma.technicianAvailability.findFirst({
    where: {
      id: availabilityId,
      technicianProfileId: technicianProfile.id,
    },
  });

  if (!availability) {
    throw new AppError(httpStatus.NOT_FOUND, "Availabolity Slot Not Found.");
  }

  if (availability.status !== AvailabilityStatus.OPEN) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot delete a ${availability.status.toLowerCase()} slot. Only open slots can be removed.`,
    );
  }

  const deletedSlot = prisma.technicianAvailability.delete({
    where: { id: availability.id },
  });

  return deletedSlot;
}

async function getOpenAvailabilityForTechnician(technicianProfileId: string) {
  const technicianProfile = await prisma.technicianProfile.findUnique({
    where: { id: technicianProfileId },
  });

  if (!technicianProfile) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found.");
  }

  const openWindows = await prisma.technicianAvailability.findMany({
    where: {
      technicianProfileId: technicianProfile.id,
      status: AvailabilityStatus.OPEN,
    },
    orderBy: [{ date: "asc" }, { period: "asc" }],
    select: {
      id: true,
      date: true,
      period: true,
    },
  });

  return openWindows;
}

async function getAllAvailability(query: TAvailabilityQuery) {
  const { technicianProfileId, date, status, page, limit, sortBy, sortOrder } =
    query;
  const skip = (page - 1) * limit;

  const andConditions: TechnicianAvailabilityWhereInput[] = [];

  if (technicianProfileId) {
    andConditions.push({ technicianProfileId });
  }
  if (date) {
    andConditions.push({ date: new Date(date) });
  }
  if (status) {
    andConditions.push({ status });
  }

  const whereClause: TechnicianAvailabilityWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [availabilitySlots, total] = await Promise.all([
    prisma.technicianAvailability.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        technicianProfile: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.technicianAvailability.count({ where: whereClause }),
  ]);

  return {
    data: availabilitySlots,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const AvailabilityService = {
  setAvailability,
  getAllAvailabilitySlotsByTechnicianProfileId,
  blockAnAvailability,
  deleteAvailabilitySlot,
  getOpenAvailabilityForTechnician,
  getAllAvailability,
};
