import { validationResult } from "express-validator";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  createEmployeeService,
  deactivateEmployeeService,
  getAllEmployeesService,
  getEmployeeByIdService,
  getEmployeePerformanceService,
  resetEmployeePinService,
  updateEmployeeService,
  uploadEmployeePhotoService,
} from "./employeesService.js";

export async function getAllEmployees(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const includeInactive = req.query.includeInactive === "true";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await getAllEmployeesService({ includeInactive, page, limit });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch employees");
  }
}

export async function getEmployeeById(req, res) {
  try {
    const employee = await getEmployeeByIdService(req.params.id);
    if (!employee) return sendError(res, 404, "Employee not found");
    sendSuccess(res, employee);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch employee");
  }
}

export async function createEmployee(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const employee = await createEmployeeService(req.body);
    sendSuccess(res, employee, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to create employee");
  }
}

export async function updateEmployee(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const employee = await updateEmployeeService(req.params.id, req.body, req.user);
    sendSuccess(res, employee);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to update employee");
  }
}

export async function resetEmployeePin(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    await resetEmployeePinService(req.params.id, req.body.newPin);
    sendSuccess(res, { message: "PIN reset successfully" });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to reset PIN");
  }
}

export async function getEmployeePerformance(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const report = await getEmployeePerformanceService(id, startDate, endDate);
    sendSuccess(res, report);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to generate performance report");
  }
}

export async function deactivateEmployee(req, res) {
  try {
    await deactivateEmployeeService(req.params.id, req.user);
    sendSuccess(res, { message: "Employee deactivated successfully" });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to deactivate employee");
  }
}

export async function uploadEmployeePhoto(req, res) {
  try {
    if (!req.file) return sendError(res, 400, "No file uploaded");
    const url = await uploadEmployeePhotoService(req.params.id, req.file.buffer);
    sendSuccess(res, { url });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to upload photo");
  }
}

// --- Salary Sheet Management ---
export async function getAllSalarySheets(req, res) {
  try {
    const { month, year } = req.query;
    const result = await getAllSalarySheetsService({ month, year });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch salary sheets");
  }
}

export async function getEmployeeSalarySheets(req, res) {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const result = await getEmployeeSalarySheetsService(employeeId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch employee salary sheets");
  }
}

export async function createSalarySheet(req, res) {
  try {
    const { employeeId, month, year, baseSalary, bonus, deduction } = req.body;
    const result = await createSalarySheetService({ employeeId, month, year, baseSalary, bonus, deduction });
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to create salary sheet");
  }
}

export async function updateSalarySheet(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { baseSalary, bonus, deduction } = req.body;
    const result = await updateSalarySheetService(id, { baseSalary, bonus, deduction });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to update salary sheet");
  }
}

export async function markSalaryAsPaid(req, res) {
  try {
    const id = parseInt(req.params.id);
    const result = await markSalaryAsPaidService(id);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to mark salary as paid");
  }
}

export async function deleteSalarySheet(req, res) {
  try {
    const id = parseInt(req.params.id);
    await deleteSalarySheetService(id);
    sendSuccess(res, { message: "Salary sheet deleted" });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to delete salary sheet");
  }
}
