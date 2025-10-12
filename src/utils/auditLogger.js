// Audit logging helper
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function logAudit({ userId, action, entity, entityId, details }) {
  return prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: JSON.stringify(details) },
  });
}
