// Audit logging helper
import prisma from "../prisma.js";

export async function logAudit({ userId, action, entity, entityId, details }) {
  return prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: JSON.stringify(details) },
  });
}
