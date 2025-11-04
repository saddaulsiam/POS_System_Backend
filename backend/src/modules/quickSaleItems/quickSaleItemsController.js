import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.js";
import * as quickSaleItemsService from "./quickSaleItemsService.js";

export const getAllQuickSaleItems = async (req, res) => {
  try {
    const quickSaleItems = await quickSaleItemsService.getAllQuickSaleItems();
    sendSuccess(res, quickSaleItems);
  } catch (error) {
    console.error("Get quick sale items error:", error);
    sendError(res, 500, "Failed to fetch quick sale items");
  }
};

export const createQuickSaleItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const result = await quickSaleItemsService.createQuickSaleItem(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Create quick sale item error:", error);
    sendError(res, 500, error.message || "Failed to create quick sale item");
  }
};

export const updateQuickSaleItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const id = parseInt(req.params.id);
    const result = await quickSaleItemsService.updateQuickSaleItem(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Update quick sale item error:", error);
    sendError(res, 500, error.message || "Failed to update quick sale item");
  }
};

export const deleteQuickSaleItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const id = parseInt(req.params.id);
    await quickSaleItemsService.deleteQuickSaleItem(id);
    sendSuccess(res, { message: "Quick sale item deleted successfully" });
  } catch (error) {
    console.error("Delete quick sale item error:", error);
    sendError(res, 500, error.message || "Failed to delete quick sale item");
  }
};
