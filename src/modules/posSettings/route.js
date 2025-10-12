import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as posSettingsController from "./posSettingsController.js";
import { posSettingsValidator } from "../validators/posSettingsValidator.js";

const router = express.Router();

router.get("/", authenticateToken, posSettingsController.getSettings);

router.put(
  "/",
  [authenticateToken, authorizeRoles("ADMIN"), ...posSettingsValidator],
  posSettingsController.updateSettings
);

export const PosSettingsRoutes = router;
