import type { DayPeriod } from "../../../generated/prisma/enums";

export interface IAvailabilityInput {
  date: string; // ISO date string from client, e.g. "2026-09-10"
  periods: DayPeriod[]; // e.g. ["MORNING", "EVENING"]
}

export interface IApplyTechnicianPayload {
  bio: string;
  yearsOfExperience: number;
  serviceArea: string;
  categoryIds: string[]; // ServiceCategory UUIDs — becomes TechnicianSkill rows
  availability: IAvailabilityInput[]; // one entry per date, each with its periods
}
