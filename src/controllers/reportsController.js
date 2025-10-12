import { validationResult } from "express-validator";
import * as reportsService from "../services/reportsService.js";
import { sendError, sendSuccess } from "../utils/responseUtils.js";

export const getDailySales = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.dailySalesReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate daily sales report", error);
  }
};

export const getSalesRange = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.salesRangeReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate sales range report", error);
  }
};

export const getInventory = async (req, res) => {
  try {
    const result = await reportsService.inventoryReport();
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate inventory report", error);
  }
};

export const getEmployeePerformance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.employeePerformanceReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate employee performance report", error);
  }
};

export const getProductPerformance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.productPerformanceReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate product performance report", error);
  }
};

export const getProfitMargin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.profitMarginReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate profit margin analysis", error);
  }
};

export const getStockTurnover = async (req, res) => {
  try {
    const result = await reportsService.stockTurnoverReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate stock turnover report", error);
  }
};

export const getSalesTrends = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await reportsService.salesTrendsReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate sales trends", error);
  }
};

export const getCustomerAnalytics = async (req, res) => {
  try {
    const result = await reportsService.customerAnalyticsReport(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to generate customer analytics", error);
  }
};
