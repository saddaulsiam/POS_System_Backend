import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.js";
import * as productVariantsService from "./productVariantsService.js";

export const getVariantById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const variant = await productVariantsService.getVariantById(id);
    if (!variant) {
      return sendError(res, 404, "Variant not found");
    }
    sendSuccess(res, variant);
  } catch (error) {
    console.error("Get variant by ID error:", error);
    sendError(res, 500, "Failed to fetch variant");
  }
};

export const getAllVariants = async (req, res) => {
  try {
    const variants = await productVariantsService.getAllVariants();
    sendSuccess(res, variants);
  } catch (error) {
    console.error("Get all variants error:", error);
    sendError(res, 500, "Failed to fetch variants");
  }
};

export const getVariantsByProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const productId = parseInt(req.params.productId);
    const variants = await productVariantsService.getVariantsByProduct(productId);
    sendSuccess(res, variants);
  } catch (error) {
    console.error("Get variants error:", error);
    sendError(res, 500, "Failed to fetch variants");
  }
};

export const createVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const result = await productVariantsService.createVariant(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Create variant error:", error);
    sendError(res, 500, error.message || "Failed to create variant");
  }
};

export const updateVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const id = parseInt(req.params.id);
    const result = await productVariantsService.updateVariant(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Update variant error:", error);
    sendError(res, 500, error.message || "Failed to update variant");
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const id = parseInt(req.params.id);
    const result = await productVariantsService.deleteVariant(id);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Delete variant error:", error);
    sendError(res, 500, error.message || "Failed to delete variant");
  }
};

export const lookupVariant = async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const variant = await productVariantsService.lookupVariant(identifier);
    if (!variant) {
      return sendError(res, 404, "Variant not found");
    }
    sendSuccess(res, variant);
  } catch (error) {
    console.error("Lookup variant error:", error);
    sendError(res, 500, "Failed to lookup variant");
  }
};
