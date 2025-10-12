import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAuditLogs(query) {
  const { userId, action, entity, page = 1, limit = 20 } = query;
  const where = {};
  if (userId) where.userId = parseInt(userId);
  if (action) where.action = action;
  if (entity) where.entity = entity;
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit),
    include: { user: { select: { id: true, name: true, username: true, role: true } } },
  });
  const total = await prisma.auditLog.count({ where });
  return { logs, total };
}

export default { getAuditLogs };
