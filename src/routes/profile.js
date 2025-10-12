import express from "express";
import * as profileController from "../controllers/profileController.js";
import { authenticateToken } from "../middleware/auth.js";
import { updateProfileValidator } from "../validators/profileValidator.js";

const router = express.Router();

router.put("/me", [authenticateToken, ...updateProfileValidator], profileController.updateProfile);

export default router;
