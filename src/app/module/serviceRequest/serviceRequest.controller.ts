import type { Request, Response } from "express";
import httpStatus from "http-status";
import { idValidationSchema } from "../../../validations";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ServiceRequestService } from "./serviceRequest.service";

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const requestAttachments = files?.["requestAttachments"] || [];

  const result = await ServiceRequestService.createServiceRequest(
    req.body,
    requestAttachments,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message:
      "Request received. You will be contacted by a Technician as soon as possible.",
    data: result,
  });
});

const getMyRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.getMyRequests(req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Service requests retrieved successfully.",
    data: result,
  });
});

const cancelServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const parsed = idValidationSchema.safeParse({
    id: req.params.serviceRequestId,
  });

  if (!parsed.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid service request reference.",
    );
  }

  const result = await ServiceRequestService.cancelServiceRequest(
    parsed.data.id,
    req.user!,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Service request cancelled successfully.",
    data: result,
  });
});

const getAllServiceRequests = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ServiceRequestService.getAllServiceRequests(
      req.validatedQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Service requests retrieved successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getMyAssignedServiceRequestsController = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ServiceRequestService.getMyAssignedServiceRequests(
      req.user!.userId,
      req.validatedQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Assigned service requests retrieved successfully",
      data: result.data,
      meta: result.meta,
    });
  },
);

const getServiceRequestByIdController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid service request reference.",
      );
    }

    const result = await ServiceRequestService.getServiceRequestById(
      parsed.data.id,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Service request retrieved successfully",
      data: result,
    });
  },
);

const reviewServiceRequestController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid service request reference.",
      );
    }

    const result = await ServiceRequestService.reviewServiceRequest(
      parsed.data.id,
      req.user!.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Service request marked as reviewed",
      data: result,
    });
  },
);

const assignServiceRequestController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid service request reference.",
      );
    }

    const result = await ServiceRequestService.assignServiceRequest(
      parsed.data.id,
      req.body,
      req.user!.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Technician assigned successfully",
      data: result,
    });
  },
);

const startServiceRequestController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid service request reference.",
      );
    }

    const result = await ServiceRequestService.startServiceRequest(
      parsed.data.id,
      req.user!.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Service request marked as in progress",
      data: result,
    });
  },
);

const completeServiceRequest = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid service request reference.",
      );
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const completionPhotos = files?.["completionPhotos"] || [];

    const result = await ServiceRequestService.completeServiceRequest(
      parsed.data.id,
      req.body,
      completionPhotos,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Service request marked as completed.",
      data: result,
    });
  },
);

const createFeedbackController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid Service Request Reference.",
      );
    }

    const result = await ServiceRequestService.createFeedback(
      parsed.data.id,
      req.user!.userId,
      req.body,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Feedback Submitted Successfully.",
      data: result,
    });
  },
);

const getFeedbackByServiceRequestIdController = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = idValidationSchema.safeParse({
      id: req.params.serviceRequestId,
    });

    if (!parsed.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Invalid Service Request Reference.",
      );
    }

    const result = await ServiceRequestService.getFeedbackByServiceRequestId(
      parsed.data.id,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Feedback retrieved successfully.",
      data: result,
    });
  },
);

export const ServiceRequestController = {
  createServiceRequest,
  getMyRequests,
  cancelServiceRequest,
  getAllServiceRequests,
  getMyAssignedServiceRequestsController,
  getServiceRequestByIdController,
  reviewServiceRequestController,
  assignServiceRequestController,
  startServiceRequestController,
  completeServiceRequest,
  createFeedbackController,
  getFeedbackByServiceRequestIdController,
};
