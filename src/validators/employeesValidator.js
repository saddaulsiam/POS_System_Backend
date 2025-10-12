import { body, query } from "express-validator";

export const createEmployeeValidator = [
  body("name").notEmpty().trim().withMessage("Employee name is required"),
  body("username").notEmpty().trim().withMessage("Username is required"),
  body("pinCode").isLength({ min: 4, max: 6 }).withMessage("PIN must be 4-6 digits"),
  body("role").isIn(["ADMIN", "MANAGER", "CASHIER", "STAFF"]).withMessage("Invalid role"),
];

export const updateEmployeeValidator = [
  body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
  body("username").optional().notEmpty().trim().withMessage("Username cannot be empty"),
  body("role").optional().isIn(["ADMIN", "MANAGER", "CASHIER", "STAFF"]).withMessage("Invalid role"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
];

export const resetPinValidator = [
  body("newPin").isLength({ min: 4, max: 6 }).withMessage("New PIN must be 4-6 digits"),
];

export const getAllEmployeesValidator = [
  query("includeInactive").optional().isBoolean().withMessage("includeInactive must be a boolean"),
];

export const getEmployeePerformanceValidator = [
  query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
];
