import prisma from "../../prisma.js";

export async function getAuditLogs(query, storeId) {
  const { employeeId, action, entity, page = 1, limit = 20 } = query;
  const where = { storeId };
  if (employeeId) where.employeeId = parseInt(employeeId);
  if (action) {
    where.action = { contains: action, mode: "insensitive" };
  }
  if (entity) {
    where.entity = { contains: entity, mode: "insensitive" };
  }
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit),
    include: {
      employee: { select: { id: true, name: true, username: true, role: true } },
      store: { select: { id: true, name: true } },
    },
  });
  const total = await prisma.auditLog.count({ where });
  return { logs, total };
}

export default { getAuditLogs };
