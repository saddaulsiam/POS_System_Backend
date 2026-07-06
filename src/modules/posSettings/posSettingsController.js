import { validationResult } from "express-validator";
import * as posSettingsService from "./posSettingsService.js";
import { sendError, sendSuccess } from "../../utils/response.js";

export const getSettings = async (req, res) => {
  try {
    const { storeId, role } = req.user;
    
    // Super Admin has bypass access
    if (role === "SUPER_ADMIN") {
      return sendSuccess(res, {
        id: 0,
        storeId: null,
        enableQuickSale: true,
        enableSplitPayment: true,
        enableParkSale: true,
        enableCustomerSearch: true,
        enableBarcodeScanner: true,
        enableLoyaltyPoints: true,
        taxRate: 0,
      });
    }

    const settings = await posSettingsService.getSettings(storeId);
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Get POS settings error:", error);
    sendError(res, 500, "Failed to fetch POS settings");
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { storeId, role, id: userId } = req.user;

    if (role === "SUPER_ADMIN") {
      return sendSuccess(res, { message: "Settings cannot be updated for Super Admin" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const settings = await posSettingsService.updateSettings(req.body, userId, storeId);
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Update POS settings error:", error);
    sendError(res, 500, "Failed to update POS settings");
  }
};
