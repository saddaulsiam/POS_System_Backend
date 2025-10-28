import { sendSuccess, sendError } from "../../utils/response.js";
import * as analyticsService from "./analyticsService.js";

export async function overview(req, res) {
  try {
    const result = await analyticsService.getOverview(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    sendError(res, 500, "Failed to fetch analytics overview");
  }
}

export async function salesTrend(req, res) {
  try {
    const result = await analyticsService.getSalesTrend(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching sales trend:", error);
    sendError(res, 500, "Failed to fetch sales trend");
  }
}

export async function topProducts(req, res) {
  try {
    const result = await analyticsService.getTopProducts(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching top products:", error);
    sendError(res, 500, "Failed to fetch top products");
  }
}

export async function categoryBreakdown(req, res) {
  try {
    const result = await analyticsService.getCategoryBreakdown(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching category breakdown:", error);
    sendError(res, 500, "Failed to fetch category breakdown");
  }
}

export async function customerStats(req, res) {
  try {
    const result = await analyticsService.getCustomerStats(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    sendError(res, 500, "Failed to fetch customer statistics");
  }
}

export async function paymentMethods(req, res) {
  try {
    const result = await analyticsService.getPaymentMethods(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    sendError(res, 500, "Failed to fetch payment method statistics");
  }
}
