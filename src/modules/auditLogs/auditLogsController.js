import auditLogsService from "./auditLogsService.js";
import { sendSuccess, sendError } from "../../utils/response.js";

export async function getAuditLogs(req, res) {
  try {
    const storeId = req.user.storeId;
    const result = await auditLogsService.getAuditLogs(req.query, storeId);
    sendSuccess(res, result);
  } catch (error) {
    console.error("Get audit logs error:", error);
    sendError(res, 500, "Failed to fetch audit logs");
  }
}

export default { getAuditLogs };
