import {
  PaymentStatus,
  ServiceRequestStatus,
  TechnicianApplicationStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

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

export const AdminService = { getDashboardStats };
