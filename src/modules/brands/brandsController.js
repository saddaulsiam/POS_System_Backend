import { validationResult } from "express-validator";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  fetchBrands,
  fetchBrandById,
  createBrandService,
  findBrandByName,
  findBrandById,
  findNameConflict,
  updateBrandService,
  deleteBrandService,
} from "./brandsService.js";

export async function getBrands(req, res) {
  try {
    const brands = await fetchBrands(req.user.storeId);
    sendSuccess(res, brands);
  } catch (error) {
    console.error("Get brands error:", error);
    sendError(res, 500, "Failed to fetch brands");
  }
}

export async function getBrandById(req, res) {
  try {
    const brandId = parseInt(req.params.id);
    const brand = await fetchBrandById(brandId, req.user.storeId);
    if (!brand) {
      return sendError(res, 404, "Brand not found");
    }
    sendSuccess(res, brand);
  } catch (error) {
    console.error("Get brand error:", error);
    sendError(res, 500, "Failed to fetch brand");
  }
}

export async function createBrand(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const { name } = req.body;
    const exists = await findBrandByName(name, req.user.storeId);
    if (exists) {
      return sendError(res, 409, "Brand already exists");
    }

    const newBrand = await createBrandService(name, req.file, req.user.storeId);
    sendSuccess(res, newBrand, 201);
  } catch (error) {
    console.error("Create brand error:", error);
    sendError(res, 500, "Failed to create brand");
  }
}

export async function updateBrand(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const brandId = parseInt(req.params.id);
    const { name } = req.body;
    
    const existingBrand = await findBrandById(brandId, req.user.storeId);
    if (!existingBrand) {
      return sendError(res, 404, "Brand not found");
    }

    const conflict = await findNameConflict(name, brandId, req.user.storeId);
    if (conflict) {
      return sendError(res, 409, "Brand name already in use");
    }

    const updatedBrand = await updateBrandService(brandId, name, req.file, req.user.storeId);
    sendSuccess(res, updatedBrand);
  } catch (error) {
    console.error("Update brand error:", error);
    sendError(res, 500, "Failed to update brand");
  }
}

export async function deleteBrand(req, res) {
  try {
    const brandId = parseInt(req.params.id);
    
    const existingBrand = await findBrandById(brandId, req.user.storeId);
    if (!existingBrand) {
      return sendError(res, 404, "Brand not found");
    }

    await deleteBrandService(brandId, req.user.storeId);
    sendSuccess(res, null, 200);
  } catch (error) {
    console.error("Delete brand error:", error);
    sendError(res, 500, "Failed to delete brand");
  }
}
