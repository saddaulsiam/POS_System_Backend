import { sendSuccess, sendError } from "../../utils/response.js";
import { validationResult } from "express-validator";
import { loginService, getMeService, changePinService } from "./authService.js";

// Login with PIN
export async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors
        .array()
        .map((e) => e.msg)
        .join(", ");
      return sendError(res, 400, messages);
    }
    const { username, pinCode } = req.body;
    const result = await loginService(username, pinCode, req);
    if (result.error) {
      return sendError(res, result.status || 400, result.error);
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, 500, "Login failed");
  }
}

// Get current user info
export async function getMe(req, res) {
  try {
    const employee = await getMeService(req.user.id);
    if (!employee) {
      return sendError(res, 404, "User not found");
    }
    sendSuccess(res, employee);
  } catch (error) {
    console.error("Get user error:", error);
    sendError(res, 500, "Failed to get user info");
  }
}

// Change PIN
export async function changePin(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors
        .array()
        .map((e) => e.msg)
        .join(", ");
      return sendError(res, 400, messages);
    }
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;
    const result = await changePinService(userId, currentPin, newPin);
    if (result.error) {
      return sendError(res, result.status || 400, result.error);
    }
    sendSuccess(res, { message: result.message });
  } catch (error) {
    console.error("Change PIN error:", error);
    sendError(res, 500, "Failed to change PIN");
  }
}
