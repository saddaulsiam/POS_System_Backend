import { validationResult } from "express-validator";
import * as posSettingsService from "./posSettingsService.js";
import { sendError, sendSuccess } from "../../utils/response.js";

export const getSettings = async (req, res) => {
  try {
    const settings = await posSettingsService.getSettings();
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Get POS settings error:", error);
    sendError(res, 500, "Failed to fetch POS settings");
  }
};

export const updateSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const userId = req.user.id;
    const settings = await posSettingsService.updateSettings(req.body, userId);
    sendSuccess(res, settings);
  } catch (error) {
    console.error("Update POS settings error:", error);
    sendError(res, 500, "Failed to update POS settings");
  }
};
