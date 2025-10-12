import { validationResult } from "express-validator";
import * as posSettingsService from "../services/posSettingsService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getSettings = async (req, res) => {
  try {
    const settings = await posSettingsService.getSettings();
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Get POS settings error:", error);
    sendError(res, "Failed to fetch POS settings", 500);
  }
};

export const updateSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const userId = req.user.id;
    const settings = await posSettingsService.updateSettings(req.body, userId);
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Update POS settings error:", error);
    sendError(res, "Failed to update POS settings", 500);
  }
};
