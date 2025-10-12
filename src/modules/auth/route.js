import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import authValidator from "./authValidator.js";
import authController from "./authController.js";

const router = express.Router();

// Login with PIN
router.post("/login", authValidator.login, authController.login);

// Get current user info
router.get("/me", authenticateToken, authController.getMe);

// Change PIN
router.put("/change-pin", [authenticateToken, ...authValidator.changePin], authController.changePin);

export const AuthRoutes = router;
