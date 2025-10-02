const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { hashPassword } = require("../utils/helpers");

const router = express.Router();
const prisma = new PrismaClient();

// Get all employees
router.get(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("includeInactive").optional().isBoolean().withMessage("includeInactive must be a boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const includeInactive = req.query.includeInactive === "true";

      const where = includeInactive ? {} : { isActive: true };

      const employees = await prisma.employee.findMany({
        where,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });

      res.json(employees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  }
);

// Get employee by ID
router.get("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = parseInt(id);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sales: {
          select: {
            id: true,
            receiptId: true,
            finalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Calculate employee statistics
    const stats = await prisma.sale.aggregate({
      where: {
        employeeId: employeeId,
        finalAmount: { gt: 0 }, // Exclude returns
      },
      _sum: {
        finalAmount: true,
      },
      _count: true,
    });

    res.json({
      ...employee,
      stats: {
        totalSales: stats._sum.finalAmount || 0,
        totalTransactions: stats._count,
        averageTransaction: stats._count > 0 ? (stats._sum.finalAmount || 0) / stats._count : 0,
      },
    });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// Create new employee
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN"),
    body("name").notEmpty().trim().withMessage("Employee name is required"),
    body("username").notEmpty().trim().withMessage("Username is required"),
    body("pinCode").isLength({ min: 4, max: 6 }).withMessage("PIN must be 4-6 digits"),
    body("role").isIn(["ADMIN", "MANAGER", "CASHIER"]).withMessage("Invalid role"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, username, pinCode, role } = req.body;

      // Check if username already exists
      const existing = await prisma.employee.findUnique({
        where: { username: username.trim() },
      });

      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPin = await hashPassword(pinCode);

      const employee = await prisma.employee.create({
        data: {
          name: name.trim(),
          username: username.trim(),
          pinCode: hashedPin,
          role,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      res.status(201).json(employee);
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  }
);

// Update employee
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN"),
    body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
    body("username").optional().notEmpty().trim().withMessage("Username cannot be empty"),
    body("role").optional().isIn(["ADMIN", "MANAGER", "CASHIER"]).withMessage("Invalid role"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const employeeId = parseInt(id);

      const existingEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!existingEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Check for username conflicts if username is being updated
      if (req.body.username) {
        const usernameConflict = await prisma.employee.findFirst({
          where: {
            username: req.body.username.trim(),
            id: { not: employeeId },
          },
        });

        if (usernameConflict) {
          return res.status(400).json({ error: "Username already taken by another employee" });
        }
      }

      // Prevent self-deactivation
      if (req.user.id === employeeId && req.body.isActive === false) {
        return res.status(400).json({ error: "Cannot deactivate your own account" });
      }

      const updateData = { ...req.body };
      if (updateData.name) updateData.name = updateData.name.trim();
      if (updateData.username) updateData.username = updateData.username.trim();

      const employee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(employee);
    } catch (error) {
      console.error("Update employee error:", error);
      res.status(500).json({ error: "Failed to update employee" });
    }
  }
);

// Reset employee PIN
router.put(
  "/:id/reset-pin",
  [
    authenticateToken,
    authorizeRoles("ADMIN"),
    body("newPin").isLength({ min: 4, max: 6 }).withMessage("New PIN must be 4-6 digits"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { newPin } = req.body;
      const employeeId = parseInt(id);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const hashedPin = await hashPassword(newPin);

      await prisma.employee.update({
        where: { id: employeeId },
        data: { pinCode: hashedPin },
      });

      res.json({ message: "PIN reset successfully" });
    } catch (error) {
      console.error("Reset PIN error:", error);
      res.status(500).json({ error: "Failed to reset PIN" });
    }
  }
);

// Get employee performance report
router.get(
  "/:id/performance",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const employeeId = parseInt(id);

      const startDate = req.query.startDate
        ? new Date(req.query.startDate)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, username: true, role: true },
      });

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const [salesStats, dailyStats] = await Promise.all([
        prisma.sale.aggregate({
          where: {
            employeeId,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            finalAmount: { gt: 0 },
          },
          _sum: {
            finalAmount: true,
            discountAmount: true,
          },
          _count: true,
        }),
        prisma.sale.groupBy({
          by: ["createdAt"],
          where: {
            employeeId,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            finalAmount: { gt: 0 },
          },
          _sum: {
            finalAmount: true,
          },
          _count: true,
        }),
      ]);

      // Process daily stats
      const dailySales = dailyStats.map((day) => ({
        date: day.createdAt.toISOString().split("T")[0],
        totalSales: day._sum.finalAmount || 0,
        transactions: day._count,
      }));

      res.json({
        employee,
        period: { startDate, endDate },
        performance: {
          totalSales: salesStats._sum.finalAmount || 0,
          totalTransactions: salesStats._count,
          totalDiscounts: salesStats._sum.discountAmount || 0,
          averageTransaction: salesStats._count > 0 ? (salesStats._sum.finalAmount || 0) / salesStats._count : 0,
          dailySales,
        },
      });
    } catch (error) {
      console.error("Employee performance error:", error);
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  }
);

// Deactivate employee (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN")], async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = parseInt(id);

    if (req.user.id === employeeId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });

    res.json({ message: "Employee deactivated successfully" });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ error: "Failed to deactivate employee" });
  }
});

module.exports = router;
