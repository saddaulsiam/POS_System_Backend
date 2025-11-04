import express from "express";
import auditLogsController from "./auditLogsController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";

const router = express.Router();
router.get("/", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], auditLogsController.getAuditLogs);

export const AuditLogsRoutes = router;