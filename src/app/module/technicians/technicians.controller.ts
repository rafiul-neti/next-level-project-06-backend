import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TechniciansService } from "./technicians.service";
import { addTechnicianSkillValidationSchema } from "./technicians.validation";

const applyAsTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechniciansService.applyAsTechnician(
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Application submitted successfully.",
    data: result,
  });
});

// admin only route's controllers
const updateTechnicianApplicationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await TechniciansService.updateTechnicianApplicationStatus(
      req.params.userId as string,
      req.body,
      req.user!.userId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Application status updated successfully.",
      data: result,
    });
  },
);

const getAlltechnicians = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await TechniciansService.getAllTechnicians(
    req.validatedQuery,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Technicians Retrieved Successfully.",
    data,
    meta,
  });
});

// public route's controllers
const getAllPublicTechnicians = catchAsync(
  async (req: Request, res: Response) => {
    const { data, meta } = await TechniciansService.getAllPublicTechnicians(
      req.validatedQuery,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Public Technicians Retrieved Successfully.",
      data,
      meta,
    });
  },
);

const getSinglePublicTechnicianDetails = catchAsync(
  async (req: Request, res: Response) => {
    const result = await TechniciansService.getSinglePublicTechnicianDetails(
      req.params.technicianId as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Public Technician Details Retrieved Successfully.",
      data: result,
    });
  },
);

// technician only controllers
const addTechnicianSkill = catchAsync(async (req: Request, res: Response) => {
  const result = await TechniciansService.addTechnicianSkill(
    req.body,
    req.user!,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Successfully Added New Skill.",
    data: result,
  });
});

const removeTechnicianSkill = catchAsync(
  async (req: Request, res: Response) => {
    const parsed = addTechnicianSkillValidationSchema.safeParse(
      req.params,
    );

    if (!parsed.success) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid Category Reference!");
    }

    const result = await TechniciansService.removeTechnicianSkill(
      parsed.data.categoryId,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: "Successfully Deleted Technician Skill.",
      data: result,
    });
  },
);

export const TechniciansController = {
  applyAsTechnician,
  updateTechnicianApplicationStatus,
  getAlltechnicians,
  getAllPublicTechnicians,
  getSinglePublicTechnicianDetails,
  addTechnicianSkill,
  removeTechnicianSkill,
};
