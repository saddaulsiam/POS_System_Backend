import { sendSuccess } from "../../utils/response.js";
import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.js";
import * as parkedSalesService from "./parkedSalesService.js";

export const getAllParkedSales = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const result = await parkedSalesService.getAllParkedSalesService(employeeId);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Get parked sales error:", error);
    sendError(res, 500, "Failed to fetch parked sales");
  }
};

export const parkSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const employeeId = req.user.id;
    const result = await parkedSalesService.parkSaleService({ ...req.body, employeeId });
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Park sale error:", error);
    sendError(res, 500, "Failed to park sale");
  }
};

export const getParkedSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const id = parseInt(req.params.id);
    const employeeId = req.user.id;
    const result = await parkedSalesService.getParkedSaleService(id, employeeId);
    if (!result) {
      return res.status(404).json({ error: "Parked sale not found" });
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Get parked sale error:", error);
    sendError(res, 500, "Failed to fetch parked sale");
  }
};

export const deleteParkedSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const id = parseInt(req.params.id);
    const employeeId = req.user.id;
    const result = await parkedSalesService.deleteParkedSaleService(id, employeeId);
    if (!result) {
      return res.status(404).json({ error: "Parked sale not found" });
    }
    sendSuccess(res, { message: "Parked sale deleted successfully" });
  } catch (error) {
    console.error("Delete parked sale error:", error);
    sendError(res, 500, "Failed to delete parked sale");
  }
};

export const cleanupExpiredParkedSales = async (req, res) => {
  try {
    const result = await parkedSalesService.cleanupExpiredParkedSalesService();
    sendSuccess(res, { message: `Deleted ${result.count} expired parked sales` });
    sendSuccess(res, { message: `Deleted ${result.count} expired parked sales` });
  } catch (error) {
    console.error("Cleanup expired sales error:", error);
    sendError(res, 500, "Failed to cleanup expired sales");
  }
};
