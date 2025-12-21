import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import authValidator from "./authValidator.js";
import * as authController from "./authController.js";

const router = express.Router();

// Register new store with owner
router.post("/register", authValidator.registerStore, authController.registerStore);

// Login with PIN
router.post("/login", authValidator.login, authController.login);

// Get current user info
router.get("/me", authenticateToken, authController.getMe);

// Change PIN
router.put("/change-pin", [authenticateToken, ...authValidator.changePin], authController.changePin);

// Refresh access token
router.post("/refresh", authController.refreshToken);

// Logout user
router.post("/logout", authenticateToken, authController.logout);

export const AuthRoutes = router;
