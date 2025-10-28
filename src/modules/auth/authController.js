import { sendSuccess } from "../../utils/response.js";
const { validationResult } = require("express-validator");
const { loginService, getMeService, changePinService } = require("./authService");

// Login with PIN
async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { username, pinCode } = req.body;
    const result = await loginService(username, pinCode, req);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    sendSuccess(res, result);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

// Get current user info
async function getMe(req, res) {
  try {
    const employee = await getMeService(req.user.id);
    if (!employee) {
      return res.status(404).json({ error: "User not found" });
    }
    sendSuccess(res, employee);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
}

// Change PIN
async function changePin(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;
    const result = await changePinService(userId, currentPin, newPin);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    sendSuccess(res, { message: result.message });
  } catch (error) {
    console.error("Change PIN error:", error);
    res.status(500).json({ error: "Failed to change PIN" });
  }
}

module.exports = {
  login,
  getMe,
  changePin,
};
