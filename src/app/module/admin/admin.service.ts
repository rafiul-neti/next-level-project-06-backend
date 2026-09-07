import {
  PaymentStatus,
  ServiceRequestStatus,
  TechnicianApplicationStatus,
} from "../../../generated/prisma/enums";
import { AuditLogWhereInput } from "../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import type { TGetAllAuditLogsQuery } from "./admin.validation";

const ALL_SERVICE_REQUEST_STATUSES = Object.values(ServiceRequestStatus);
const ALL_APPLICATION_STATUSES = Object.values(TechnicianApplicationStatus);

async function getDashboardStats() {
  const [serviceRequestGroups, revenueAggregate, technicianApplicationGroups] =
    await Promise.all([
      prisma.serviceRequest.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      prisma.technicianProfile.groupBy({
        by: ["applicationStatus"],
        _count: { applicationStatus: true },
      }),
    ]);

  // groupBy omits any status with zero rows — fill those in explicitly so
  // the dashboard always has every status represented, even at 0.
  const serviceRequestCountMap = new Map(
    serviceRequestGroups.map((g) => [g.status, g._count.status]),
  );
  const serviceRequestsByStatus = ALL_SERVICE_REQUEST_STATUSES.reduce(
    (acc, status) => {
      acc[status] = serviceRequestCountMap.get(status) ?? 0;
      return acc;
    },
    {} as Record<ServiceRequestStatus, number>,
  );

  const technicianCountMap = new Map(
    technicianApplicationGroups.map((g) => [
      g.applicationStatus,
      g._count.applicationStatus,
    ]),
  );
  const techniciansByApplicationStatus = ALL_APPLICATION_STATUSES.reduce(
    (acc, status) => {
      acc[status] = technicianCountMap.get(status) ?? 0;
      return acc;
    },
    {} as Record<TechnicianApplicationStatus, number>,
  );

  return {
    serviceRequestsByStatus,
    totalRevenue: revenueAggregate._sum.amount ?? 0,
    techniciansByApplicationStatus,
  };
}

async function getAllAuditLogs(query: TGetAllAuditLogsQuery) {
  const {
    action,
    entityType,
    actorId,
    serviceRequestId,
    page,
    limit,
    sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const andConditions: AuditLogWhereInput[] = [];

  if (action) {
    andConditions.push({ action });
  }
  if (entityType) {
    andConditions.push({ entityType });
  }
  if (actorId) {
    andConditions.push({ actorId });
  }
  if (serviceRequestId) {
    andConditions.push({ serviceRequestId });
  }

  const whereClause: AuditLogWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [auditLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: { createdAt: sortOrder },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where: whereClause }),
  ]);

  return {
    data: auditLogs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const AdminService = { getDashboardStats, getAllAuditLogs };
