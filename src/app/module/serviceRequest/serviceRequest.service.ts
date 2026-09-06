import path from "node:path";
import type { UploadApiResponse } from "cloudinary";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  AvailabilityStatus,
  Role,
  ServiceRequestStatus,
} from "../../../generated/prisma/enums";
import type { ServiceRequestWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type {
  TCancelServiceRequestPayload,
  TGetAllServiceRequestsQuery,
  TGetMyAssignedServiceRequestsQuery,
  TServiceRequestPayload,
} from "./serviceRequest.validation";

async function createServiceRequest(
  payload: TServiceRequestPayload,
  attachments: Express.Multer.File[],
  user: IRequestUser,
) {
  const { attachmentUrls, ...restPayload } = payload;

  const existingCustomer = await prisma.user.findUnique({
    where: { id: user.userId },
  });

  if (!existingCustomer || existingCustomer.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found!");
  }

  if (existingCustomer.role !== Role.CUSTOMER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden. Only customers can make a service request.",
    );
  }

  if (!existingCustomer.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Please verify your email to make a service request.",
    );
  }

  if (existingCustomer.isBlocked) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Your account is blocked. Please contact support.",
    );
  }

  let uploadRequsetAttachments: UploadApiResponse[] = [];

  if (attachments.length) {
    uploadRequsetAttachments = await Promise.all(
      attachments.map((file, indx) => {
        return new Promise<UploadApiResponse>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "auto" }, async (error, result) => {
              if (error) {
                return reject(error);
              }

              if (!result) {
                return reject(
                  new AppError(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    `No result returned from Cloudinary: at createServiceRequest in serviceRequest.service; uploading attchment files, file number ${indx + 1}, title: ${file.originalname}!`,
                  ),
                );
              }

              resolve(result);
            })
            .end(file.buffer);
        });
      }),
    );
  }

  const createdServiceRequest = await prisma.serviceRequest.create({
    data: {
      customerId: existingCustomer.id,
      ...restPayload,
      ...(uploadRequsetAttachments.length && {
        attachmentUrls: uploadRequsetAttachments.map((file) => ({
          url: file.secure_url,
          publicId: file.public_id,
        })),
      }),
    },
    include: { category: { select: { name: true } } },
  });

  const html = await ejs.renderFile(
    path.join(process.cwd(), "src/app/templates/service-request-received.ejs"),
    {
      appName: "Field Service Management",
      name: existingCustomer.name,
      title: createdServiceRequest.title,
      categoryName: createdServiceRequest.category.name,
      address: createdServiceRequest.address,
      requestId: createdServiceRequest.id,
      trackingUrl: `${config.frontend_url}/service-requests/${createdServiceRequest.id}`,
      currentYear: new Date().getFullYear(),
    },
  );

  transporter.sendMail({
    from: config.email_sender,
    to: existingCustomer.email,
    subject: "Service request received",
    html,
  });

  return createdServiceRequest;
}

async function getMyRequests(user: IRequestUser) {
  const myRequests = await prisma.serviceRequest.findMany({
    where: { customerId: user.userId },
  });

  return myRequests;
}

async function cancelServiceRequest(
  serviceRequestId: string,
  actor: IRequestUser,
  payload: TCancelServiceRequestPayload,
) {
  const cancellableStatuses: ServiceRequestStatus[] =
    actor.role === Role.ADMIN
      ? [
          ServiceRequestStatus.PENDING,
          ServiceRequestStatus.REVIEWED,
          ServiceRequestStatus.ASSIGNED,
          ServiceRequestStatus.IN_PROGRESS,
        ]
      : [ServiceRequestStatus.PENDING, ServiceRequestStatus.REVIEWED];

  return prisma.$transaction(async (tx) => {
    const serviceRequest = await tx.serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

    if (!serviceRequest) {
      throw new AppError(httpStatus.NOT_FOUND, "Service request not found!");
    }

    if (actor.role === Role.CUSTOMER) {
      if (serviceRequest.customerId !== actor.userId) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You can only cancel your own service requests.",
        );
      }
      if (!cancellableStatuses.includes(serviceRequest.status)) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This request can no longer be cancelled — a technician has already been assigned.",
        );
      }
    } else if (actor.role === Role.ADMIN) {
      if (!cancellableStatuses.includes(serviceRequest.status)) {
        throw new AppError(
          httpStatus.CONFLICT,
          `A request in ${serviceRequest.status} status can no longer be cancelled.`,
        );
      }
    } else {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not authorized to cancel this request.",
      );
    }

    if (serviceRequest.availabilityId) {
      await tx.technicianAvailability.update({
        where: { id: serviceRequest.availabilityId },
        data: { status: AvailabilityStatus.OPEN },
      });
    }

    const cancelledRequest = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: payload.cancellationReason,
        availabilityId: null,
      },
    });

    return cancelledRequest;
  });
}

async function getAllServiceRequests(query: TGetAllServiceRequestsQuery) {
  const {
    status,
    categoryId,
    technicianId,
    searchTerm,
    page,
    limit,
    sortBy,
    sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const andConditions: ServiceRequestWhereInput[] = [];

  if (status) {
    andConditions.push({ status });
  }

  if (categoryId) {
    andConditions.push({ categoryId });
  }

  if (technicianId) {
    andConditions.push({ technicianId });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const whereClause: ServiceRequestWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [serviceRequests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        technician: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.serviceRequest.count({ where: whereClause }),
  ]);

  return {
    data: serviceRequests,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getMyAssignedServiceRequests(
  technicianId: string,
  query: TGetMyAssignedServiceRequestsQuery,
) {
  const { status, page, limit, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const andConditions: ServiceRequestWhereInput[] = [{ technicianId }];

  if (status) {
    andConditions.push({ status });
  }

  const whereClause: ServiceRequestWhereInput = { AND: andConditions };

  const [serviceRequests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, contactNumber: true } },
        category: { select: { id: true, name: true } },
        availability: { select: { date: true, period: true } },
      },
    }),
    prisma.serviceRequest.count({ where: whereClause }),
  ]);

  return {
    data: serviceRequests,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getServiceRequestById(serviceRequestId: string, actor: IRequestUser) {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      category: true,
      customer: {
        select: { id: true, name: true, email: true, contactNumber: true },
      },
      technician: {
        select: { id: true, name: true, email: true, contactNumber: true },
      },
      assignedBy: { select: { id: true, name: true } },
      availability: true,
      payment: true,
      feedback: true,
    },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }

  const isOwningCustomer =
    actor.role === Role.CUSTOMER && serviceRequest.customerId === actor.userId;

  const isAssignedTechnician =
    actor.role === Role.TECHNICIAN &&
    serviceRequest.technicianId === actor.userId;
    
  const isAdmin = actor.role === Role.ADMIN;

  if (!isOwningCustomer && !isAssignedTechnician && !isAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view this service request.",
    );
  }

  return serviceRequest;
}
 

export const ServiceRequestService = {
  createServiceRequest,
  getMyRequests,
  cancelServiceRequest,
  getAllServiceRequests,
  getMyAssignedServiceRequests,
  getServiceRequestById,
};
