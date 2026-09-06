import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { TAvailabilityPayload } from "./availability.validation";

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

export const AvailabilityService = {
  setAvailability,
  getAllAvailabilitySlotsByTechnicianProfileId,
};
