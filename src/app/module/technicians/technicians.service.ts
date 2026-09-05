import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { IApplyTechnicianPayload } from "./technicians.interface";

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

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found!");
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

export const TechniciansService = { applyAsTechnician };
