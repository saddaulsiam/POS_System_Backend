// Audit logging helper
import prisma from "../prisma.js";

export async function logAudit({ storeId, employeeId, action, entity, entityId, details, ipAddress, userAgent }) {
  return prisma.auditLog.create({
    data: {
      storeId,
      employeeId,
      action,
      entity,
      entityId,
      details: details ? JSON.stringify(details) : undefined,
      ipAddress,
      userAgent,
    },
  });
}
