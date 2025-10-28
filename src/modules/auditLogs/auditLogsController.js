import auditLogsService from "./auditLogsService.js";
import { sendSuccess } from "../../utils/response.js";

export async function getAuditLogs(req, res) {
  try {
    const result = await auditLogsService.getAuditLogs(req.query);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}

export default { getAuditLogs };
