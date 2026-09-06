import path from "node:path";
import type { UploadApiResponse } from "cloudinary";
import ejs from "ejs";
import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { TServiceRequestPayload } from "./serviceRequest.validation";

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

export const ServiceRequestService = { createServiceRequest };
