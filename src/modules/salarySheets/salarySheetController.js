import { sendError, sendSuccess } from "../../utils/response.js";
import {
  getAllSalarySheetsService,
  getEmployeeSalarySheetsService,
  createSalarySheetService,
  updateSalarySheetService,
  markSalaryAsPaidService,
  deleteSalarySheetService,
} from "./salarySheetService.js";

export async function getAllSalarySheets(req, res) {
  console.log("[SalarySheets] getAllSalarySheets controller called", req.originalUrl, req.query);
  try {
    let { month, year, ...rest } = req.query;
    if (rest.employeeId !== undefined) {
      console.warn("[SalarySheets] employeeId found in query for all-sheets endpoint, removing.");
      delete rest.employeeId;
    }
    const result = await getAllSalarySheetsService({ month, year });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch salary sheets");
  }
}

export async function getEmployeeSalarySheets(req, res) {
  console.log("[SalarySheets] getEmployeeSalarySheets controller called", req.originalUrl, req.params);
  try {
    const employeeId = parseInt(req.params.employeeId);
    if (!employeeId || isNaN(employeeId)) {
      return sendError(res, 400, "Invalid or missing employee id");
    }
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
