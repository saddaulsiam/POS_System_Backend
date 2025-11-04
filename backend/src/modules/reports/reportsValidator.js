import { query } from "express-validator";

export const dailySalesValidator = [query("date").optional().isISO8601().withMessage("Date must be in ISO format")];

export const salesRangeValidator = [
  query("startDate").isISO8601().withMessage("Start date is required and must be in ISO format"),
  query("endDate").isISO8601().withMessage("End date is required and must be in ISO format"),
];

export const employeePerformanceValidator = [
  query("startDate").optional().isISO8601().withMessage("Start date must be in ISO format"),
  query("endDate").optional().isISO8601().withMessage("End date must be in ISO format"),
];

export const productPerformanceValidator = [
  query("startDate").optional().isISO8601().withMessage("Start date must be in ISO format"),
  query("endDate").optional().isISO8601().withMessage("End date must be in ISO format"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
];

export const profitMarginValidator = [
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
];

export const salesTrendsValidator = [
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  query("groupBy").optional().isIn(["hour", "day", "week", "month"]),
];
