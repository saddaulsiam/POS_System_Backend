import {
  createSupplierService,
  deleteSupplierService,
  getSupplierByIdService,
  getSuppliersService,
  updateSupplierService,
} from "./suppliersService.js";
import { sendSuccess, sendError } from "../../utils/response.js";

export const getSuppliers = async (req, res) => {
  try {
    const result = await getSuppliersService(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    sendError(res, "Failed to fetch suppliers", 500, error.message);
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const result = await getSupplierByIdService(req.params.id);
    if (!result) {
      return sendError(res, "Supplier not found", 404);
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    sendError(res, "Failed to fetch supplier", 500, error.message);
  }
};

export const createSupplier = async (req, res) => {
  try {
    const result = await createSupplierService(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Error creating supplier:", error);
    sendError(res, error.message || "Failed to create supplier", 500);
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const result = await updateSupplierService(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error updating supplier:", error);
    sendError(res, error.message || "Failed to update supplier", 500);
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const result = await deleteSupplierService(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error deleting supplier:", error);
    sendError(res, error.message || "Failed to delete supplier", 500);
  }
};
