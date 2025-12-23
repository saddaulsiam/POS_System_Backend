import { validationResult } from "express-validator";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  changePinService,
  getMeService,
  loginService,
  logoutService,
  refreshTokenService,
  registerStoreService,
} from "./authService.js";

// Register new store with owner account
export async function registerStore(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors
        .array()
        .map((e) => e.msg)
        .join(", ");
      return sendError(res, 400, messages);
    }

    const {
      storeName,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerUsername,
      ownerPin,
      email,
      phone,
      address,
      city,
      country,
    } = req.body;

    const result = await registerStoreService({
      storeName,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerUsername,
      ownerPin,
      email,
      phone,
      address,
      city,
      country,
    });

    if (result.error) {
      return sendError(res, result.status || 400, result.error);
    }

    return sendSuccess(res, { data: result, message: "Store registered successfully" }, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to create store. Please try again.");
  }
}

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
    sendError(res, 500, "Login failed", error);
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
    const storeId = req.user.storeId;
    if (!storeId) {
      return sendError(res, 400, "Store ID is required for PIN change");
    }
    const result = await changePinService(userId, currentPin, newPin, storeId);
    if (result.error) {
      return sendError(res, result.status || 400, result.error);
    }
    sendSuccess(res, { message: result.message });
  } catch (error) {
    console.error("Change PIN error:", error);
    sendError(res, 500, "Failed to change PIN");
  }
}

// Refresh access token
export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    const result = await refreshTokenService(refreshToken);
    if (result.error) {
      return sendError(res, result.status || 401, result.error);
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Refresh token error:", error);
    sendError(res, 500, "Failed to refresh token");
  }
}

// Logout user
export async function logout(req, res) {
  try {
    const userId = req.user.id;
    const result = await logoutService(userId);
    sendSuccess(res, { message: result.message });
  } catch (error) {
    console.error("Logout error:", error);
    sendError(res, 500, "Failed to logout");
  }
}
