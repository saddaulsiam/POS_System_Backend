import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.js";
import * as productVariantsService from "./productVariantsService.js";

export const getVariantById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const variant = await productVariantsService.getVariantById(id);
    if (!variant) {
      return sendError(res, "Variant not found", 404);
    }
    sendSuccess(res, variant);
  } catch (error) {
    console.error("Get variant by ID error:", error);
    sendError(res, "Failed to fetch variant", 500);
  }
};

export const getAllVariants = async (req, res) => {
  try {
    const variants = await productVariantsService.getAllVariants();
    sendSuccess(res, variants);
  } catch (error) {
    console.error("Get all variants error:", error);
    sendError(res, "Failed to fetch variants", 500);
  }
};

export const getVariantsByProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const productId = parseInt(req.params.productId);
    const variants = await productVariantsService.getVariantsByProduct(productId);
    sendSuccess(res, variants);
  } catch (error) {
    console.error("Get variants error:", error);
    sendError(res, "Failed to fetch variants", 500);
  }
};

export const createVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const result = await productVariantsService.createVariant(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Create variant error:", error);
    sendError(res, error.message || "Failed to create variant", 500);
  }
};

export const updateVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const id = parseInt(req.params.id);
    const result = await productVariantsService.updateVariant(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Update variant error:", error);
    sendError(res, error.message || "Failed to update variant", 500);
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const id = parseInt(req.params.id);
    const result = await productVariantsService.deleteVariant(id);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Delete variant error:", error);
    sendError(res, error.message || "Failed to delete variant", 500);
  }
};

export const lookupVariant = async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const variant = await productVariantsService.lookupVariant(identifier);
    if (!variant) {
      return sendError(res, "Variant not found", 404);
    }
    sendSuccess(res, variant);
  } catch (error) {
    console.error("Lookup variant error:", error);
    sendError(res, "Failed to lookup variant", 500);
  }
};
