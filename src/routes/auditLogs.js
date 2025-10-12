import express from "express";
import auditLogsController from "../controllers/auditLogsController.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();
router.get("/", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], auditLogsController.getAuditLogs);

export default router;
