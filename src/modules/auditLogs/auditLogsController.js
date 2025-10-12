import auditLogsService from "./auditLogsService.js";

export async function getAuditLogs(req, res) {
  try {
    const result = await auditLogsService.getAuditLogs(req.query);
    res.json(result);
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}

export default { getAuditLogs };
