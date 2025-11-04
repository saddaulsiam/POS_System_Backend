import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as posSettingsController from "./posSettingsController.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, posSettingsController.getSettings)
  .put([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], posSettingsController.updateSettings);

export const PosSettingsRoutes = router;
