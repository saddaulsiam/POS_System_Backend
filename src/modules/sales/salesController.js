import * as salesService from "./salesService.js";
import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../utils/responseUtils.js";

export const getSales = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await salesService.getSales(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch sales", error);
  }
};

export const getSaleById = async (req, res) => {
  try {
    const result = await salesService.getSaleById(req.params.identifier);
    if (!result) return sendError(res, 404, "Sale not found");
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch sale", error);
  }
};

export const createSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await salesService.createSale(req.body, req.user, req.ip, req.headers["user-agent"]);
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to create sale", error);
  }
};

export const processReturn = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await salesService.processReturn(req.params.id, req.body, req.user);
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to process return", error);
  }
};

export const getReturnHistory = async (req, res) => {
  try {
    const result = await salesService.getReturnHistory(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to get return history", error);
  }
};

export const getAllReturns = async (req, res) => {
  try {
    const result = await salesService.getAllReturns(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to get returns", error);
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await salesService.getSalesSummary(req.query);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to generate sales summary", error);
  }
};

export const voidSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await salesService.voidSale(req.params.id, req.body, req.user);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to void sale", error);
  }
};
