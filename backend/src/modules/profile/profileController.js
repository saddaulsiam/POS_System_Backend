import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../../utils/response.js";
import { logAudit } from "../../utils/helpers.js";
import * as profileService from "./profileService.js";

export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const userId = req.user.id;
    const { name, username } = req.body;
    let updated, updateData;
    try {
      ({ updated, updateData } = await profileService.updateProfile(userId, name, username, req));
    } catch (err) {
      if (err.status === 400) {
        return sendError(res, 400, err.message);
      }
      throw err;
    }
    logAudit({
      userId,
      action: "UPDATE_PROFILE",
      entity: "Employee",
      entityId: userId,
      details: JSON.stringify(updateData),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });
    sendSuccess(res, updated);
  } catch (error) {
    console.error("Update profile error:", error);
    sendError(res, 500, "Failed to update profile");
  }
};
