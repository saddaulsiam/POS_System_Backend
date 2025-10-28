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
    sendError(res, 500, "Failed to fetch suppliers", error.message);
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const result = await getSupplierByIdService(req.params.id);
    if (!result) {
      return sendError(res, 404, "Supplier not found");
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    sendError(res, 500, "Failed to fetch supplier", error.message);
  }
};

export const createSupplier = async (req, res) => {
  try {
    const result = await createSupplierService(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    console.error("Error creating supplier:", error);
    sendError(res, 500, error.message || "Failed to create supplier");
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const result = await updateSupplierService(req.params.id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error updating supplier:", error);
    sendError(res, 500, error.message || "Failed to update supplier");
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const result = await deleteSupplierService(req.params.id);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Error deleting supplier:", error);
    sendError(res, 500, error.message || "Failed to delete supplier");
  }
};
