const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const prisma = new PrismaClient();

// Get all cash drawers with pagination and filters
router.get("/", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { page = 1, limit = 10, status, employeeId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    if (startDate || endDate) {
      where.openedAt = {};
      if (startDate) {
        where.openedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.openedAt.lte = new Date(endDate);
      }
    }

    const [cashDrawers, total] = await Promise.all([
      prisma.cashDrawer.findMany({
        where,
        skip,
        take,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          openedAt: "desc",
        },
      }),
      prisma.cashDrawer.count({ where }),
    ]);

    res.json({
      cashDrawers,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Error fetching cash drawers:", error);
    res.status(500).json({ error: "Failed to fetch cash drawers" });
  }
});

// Get current open drawer for employee
router.get("/current", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;

    const openDrawer = await prisma.cashDrawer.findFirst({
      where: {
        employeeId,
        status: "OPEN",
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ drawer: openDrawer });
  } catch (error) {
    console.error("Error fetching current drawer:", error);
    res.status(500).json({ error: "Failed to fetch current drawer" });
  }
});

// Open cash drawer
router.post("/open", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { openingBalance } = req.body;

    if (openingBalance === undefined || openingBalance === null) {
      return res.status(400).json({ error: "Opening balance is required" });
    }

    if (openingBalance < 0) {
      return res.status(400).json({ error: "Opening balance cannot be negative" });
    }

    // Check if employee already has an open drawer
    const existingDrawer = await prisma.cashDrawer.findFirst({
      where: {
        employeeId,
        status: "OPEN",
      },
    });

    if (existingDrawer) {
      return res.status(400).json({
        error: "You already have an open cash drawer. Please close it first.",
      });
    }

    const cashDrawer = await prisma.cashDrawer.create({
      data: {
        employeeId,
        openingBalance: parseFloat(openingBalance),
        status: "OPEN",
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        employeeId,
        action: "OPEN_CASH_DRAWER",
        entityType: "CashDrawer",
        entityId: cashDrawer.id,
        details: JSON.stringify({
          openingBalance: parseFloat(openingBalance),
        }),
      },
    });

    res.status(201).json(cashDrawer);
  } catch (error) {
    console.error("Error opening cash drawer:", error);
    res.status(500).json({ error: "Failed to open cash drawer" });
  }
});

// Close cash drawer
router.post("/close/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;
    const { closingBalance, actualCash, notes } = req.body;

    if (closingBalance === undefined || closingBalance === null) {
      return res.status(400).json({ error: "Closing balance is required" });
    }

    const cashDrawer = await prisma.cashDrawer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!cashDrawer) {
      return res.status(404).json({ error: "Cash drawer not found" });
    }

    if (cashDrawer.status !== "OPEN") {
      return res.status(400).json({ error: "Cash drawer is already closed" });
    }

    if (cashDrawer.employeeId !== employeeId && !["ADMIN", "MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ error: "You can only close your own cash drawer" });
    }

    // Calculate expected balance from sales
    const sales = await prisma.sale.findMany({
      where: {
        employeeId: cashDrawer.employeeId,
        createdAt: {
          gte: cashDrawer.openedAt,
        },
        status: {
          not: "VOIDED",
        },
      },
      include: {
        paymentSplits: true,
      },
    });

    let cashSalesTotal = 0;
    sales.forEach((sale) => {
      if (sale.paymentSplits && sale.paymentSplits.length > 0) {
        sale.paymentSplits.forEach((split) => {
          if (split.method === "CASH") {
            cashSalesTotal += split.amount;
          }
        });
      } else if (sale.paymentMethod === "CASH") {
        cashSalesTotal += sale.total;
      }
    });

    const expectedBalance = cashDrawer.openingBalance + cashSalesTotal;
    const actualBalance = actualCash !== undefined ? parseFloat(actualCash) : parseFloat(closingBalance);
    const difference = actualBalance - expectedBalance;

    const updatedDrawer = await prisma.cashDrawer.update({
      where: { id: parseInt(id) },
      data: {
        closingBalance: parseFloat(closingBalance),
        expectedBalance,
        difference,
        status: "CLOSED",
        closedAt: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        employeeId,
        action: "CLOSE_CASH_DRAWER",
        entityType: "CashDrawer",
        entityId: updatedDrawer.id,
        details: JSON.stringify({
          closingBalance: parseFloat(closingBalance),
          expectedBalance,
          difference,
          notes,
        }),
      },
    });

    res.json(updatedDrawer);
  } catch (error) {
    console.error("Error closing cash drawer:", error);
    res.status(500).json({ error: "Failed to close cash drawer" });
  }
});

// Get cash drawer by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const cashDrawer = await prisma.cashDrawer.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!cashDrawer) {
      return res.status(404).json({ error: "Cash drawer not found" });
    }

    // Only allow viewing own drawer or if admin/manager
    if (cashDrawer.employeeId !== employeeId && !["ADMIN", "MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(cashDrawer);
  } catch (error) {
    console.error("Error fetching cash drawer:", error);
    res.status(500).json({ error: "Failed to fetch cash drawer" });
  }
});

// Get cash drawer reconciliation details
router.get("/:id/reconciliation", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const cashDrawer = await prisma.cashDrawer.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!cashDrawer) {
      return res.status(404).json({ error: "Cash drawer not found" });
    }

    // Only allow viewing own drawer or if admin/manager
    if (cashDrawer.employeeId !== employeeId && !["ADMIN", "MANAGER"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get sales during drawer period
    const whereConditions = {
      employeeId: cashDrawer.employeeId,
      createdAt: {
        gte: cashDrawer.openedAt,
      },
      status: {
        not: "VOIDED",
      },
    };

    if (cashDrawer.closedAt) {
      whereConditions.createdAt.lte = cashDrawer.closedAt;
    }

    const sales = await prisma.sale.findMany({
      where: whereConditions,
      include: {
        paymentSplits: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate payment method breakdown
    const paymentBreakdown = {
      cash: 0,
      card: 0,
      mobile: 0,
      other: 0,
    };

    let totalSales = 0;

    sales.forEach((sale) => {
      totalSales += sale.total;

      if (sale.paymentSplits && sale.paymentSplits.length > 0) {
        sale.paymentSplits.forEach((split) => {
          switch (split.method) {
            case "CASH":
              paymentBreakdown.cash += split.amount;
              break;
            case "CARD":
              paymentBreakdown.card += split.amount;
              break;
            case "MOBILE":
              paymentBreakdown.mobile += split.amount;
              break;
            default:
              paymentBreakdown.other += split.amount;
          }
        });
      } else {
        switch (sale.paymentMethod) {
          case "CASH":
            paymentBreakdown.cash += sale.total;
            break;
          case "CARD":
            paymentBreakdown.card += sale.total;
            break;
          case "MOBILE":
            paymentBreakdown.mobile += sale.total;
            break;
          default:
            paymentBreakdown.other += sale.total;
        }
      }
    });

    const expectedCashBalance = cashDrawer.openingBalance + paymentBreakdown.cash;

    res.json({
      drawer: cashDrawer,
      sales: sales.length,
      totalSales,
      paymentBreakdown,
      expectedCashBalance,
      actualBalance: cashDrawer.closingBalance || null,
      difference: cashDrawer.difference || null,
      recentTransactions: sales.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation details" });
  }
});

// Get cash drawer summary/statistics
router.get("/stats/summary", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    const where = {
      status: "CLOSED",
    };

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) {
        where.closedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.closedAt.lte = new Date(endDate);
      }
    }

    const drawers = await prisma.cashDrawer.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    let totalShifts = drawers.length;
    let totalOverShort = 0;
    let shiftsWithDifference = 0;
    let averageOpeningBalance = 0;
    let averageClosingBalance = 0;

    drawers.forEach((drawer) => {
      if (drawer.difference) {
        totalOverShort += drawer.difference;
        if (Math.abs(drawer.difference) > 0.01) {
          shiftsWithDifference++;
        }
      }
      averageOpeningBalance += drawer.openingBalance;
      if (drawer.closingBalance) {
        averageClosingBalance += drawer.closingBalance;
      }
    });

    if (totalShifts > 0) {
      averageOpeningBalance /= totalShifts;
      averageClosingBalance /= totalShifts;
    }

    res.json({
      totalShifts,
      totalOverShort,
      shiftsWithDifference,
      accuracyRate: totalShifts > 0 ? (((totalShifts - shiftsWithDifference) / totalShifts) * 100).toFixed(2) : 100,
      averageOpeningBalance,
      averageClosingBalance,
      averageOverShort: totalShifts > 0 ? totalOverShort / totalShifts : 0,
      recentDrawers: drawers.slice(0, 5),
    });
  } catch (error) {
    console.error("Error fetching drawer statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;
