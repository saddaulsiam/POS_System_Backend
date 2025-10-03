const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get audit logs (admin only, with filters)
router.get("/", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { userId, action, entity, page = 1, limit = 20 } = req.query;
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
    res.json({ logs, total });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

module.exports = router;
