import { getAllEmployeesService } from "../employees/employeesService.js";
// Bulk generate salary sheets for all employees for a given month/year
export async function bulkGenerateSalarySheets(req, res) {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return sendError(res, 400, "Month and year are required");
    }
    // Only allow previous, current, or next month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth === 13) {
      nextMonth = 1;
      nextYear = currentYear + 1;
    }
    const m = Number(month);
    const y = Number(year);
    const isAllowed =
      (y === currentYear && m === currentMonth) ||
      (y === prevYear && m === prevMonth) ||
      (y === nextYear && m === nextMonth);
    if (!isAllowed) {
      return sendError(res, 400, "You can only generate salary sheets for the previous, current, or next month.");
    }
    // Get all active employees
    const { data: employees } = await getAllEmployeesService({ includeInactive: false, limit: 1000 });
    // Call service to bulk create salary sheets
    const result = await bulkGenerateSalarySheetsService({ employees, month: m, year: y });
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to bulk generate salary sheets");
  }
}
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  getAllSalarySheetsService,
  getEmployeeSalarySheetsService,
  createSalarySheetService,
  updateSalarySheetService,
  markSalaryAsPaidService,
  deleteSalarySheetService,
  bulkGenerateSalarySheetsService,
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
    // Validation: Only allow previous, current, or next month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth === 13) {
      nextMonth = 1;
      nextYear = currentYear + 1;
    }
    const m = Number(month);
    const y = Number(year);
    const isAllowed =
      (y === currentYear && m === currentMonth) ||
      (y === prevYear && m === prevMonth) ||
      (y === nextYear && m === nextMonth);
    if (!isAllowed) {
      return sendError(res, 400, "You can only create salary sheets for the previous, current, or next month.");
    }
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
