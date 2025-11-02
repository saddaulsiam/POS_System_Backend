import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAuditLogs(query) {
  const { userId, action, entity, page = 1, limit = 20 } = query;
  const where = {};
  if (userId) where.userId = parseInt(userId);
  if (action) {
    where.AND = where.AND || [];
    where.AND.push({
      action: {
        contains: action.toLowerCase(),
      },
    });
  }
  if (entity) {
    where.AND = where.AND || [];
    where.AND.push({
      entity: {
        contains: entity.toLowerCase(),
      },
    });
  }
  // For SQLite, fetch all and filter in JS for case-insensitive search
  let logs, total;
  if (action || entity) {
    const allLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
    const filtered = allLogs.filter((log) => {
      let match = true;
      if (action) match = match && log.action.toLowerCase().includes(action.toLowerCase());
      if (entity) match = match && log.entity && log.entity.toLowerCase().includes(entity.toLowerCase());
      if (userId) match = match && log.userId === parseInt(userId);
      return match;
    });
    total = filtered.length;
    logs = filtered.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));
  } else {
    logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
    total = await prisma.auditLog.count();
  }
  return { logs, total };
}

export default { getAuditLogs };
