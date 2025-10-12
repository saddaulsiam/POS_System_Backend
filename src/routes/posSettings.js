import express from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import * as posSettingsController from "../controllers/posSettingsController.js";
import { posSettingsValidator } from "../validators/posSettingsValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

router.get("/", authenticateToken, posSettingsController.getSettings);

router.put(
  "/",
  [authenticateToken, authorizeRoles("ADMIN"), ...posSettingsValidator],
  posSettingsController.updateSettings
);

export default router;
