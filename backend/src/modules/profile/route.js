import express from "express";
import * as profileController from "./profileController.js";
import { authenticateToken } from "../../middleware/auth.js";
import { updateProfileValidator } from "./profileValidator.js";

const router = express.Router();

router.put("/me", [authenticateToken, ...updateProfileValidator], profileController.updateProfile);

export const ProfileRoutes = router;
