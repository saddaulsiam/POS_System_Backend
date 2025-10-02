const express = require("express");
const { query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const moment = require("moment");

const router = express.Router();
const prisma = new PrismaClient();

// Daily sales report
router.get(
  "/daily-sales",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("date").optional().isISO8601().withMessage("Date must be in ISO format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const date = req.query.date ? moment(req.query.date) : moment();
      const startOfDay = date.startOf("day").toDate();
      const endOfDay = date.endOf("day").toDate();

      // Get sales summary
      const salesSummary = await prisma.sale.aggregate({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          paymentStatus: "COMPLETED",
        },
        _sum: {
          finalAmount: true,
          taxAmount: true,
          discountAmount: true,
        },
        _count: {
          id: true,
        },
      });

      // Get sales by payment method
      const salesByPayment = await prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          paymentStatus: "COMPLETED",
        },
        _sum: {
          finalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      // Get top selling products
      const topProducts = await prisma.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
            paymentStatus: "COMPLETED",
          },
        },
        _sum: {
          quantity: true,
          subtotal: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      });

      // Get product details for top products
      const productIds = topProducts.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
        },
      });

      const topProductsWithDetails = topProducts.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          ...item,
          product,
        };
      });

      res.json({
        date: date.format("YYYY-MM-DD"),
        summary: {
          totalSales: salesSummary._sum.finalAmount || 0,
          totalTax: salesSummary._sum.taxAmount || 0,
          totalDiscount: salesSummary._sum.discountAmount || 0,
          totalTransactions: salesSummary._count.id || 0,
        },
        salesByPaymentMethod: salesByPayment,
        topProducts: topProductsWithDetails,
      });
    } catch (error) {
      console.error("Daily sales report error:", error);
      res.status(500).json({ error: "Failed to generate daily sales report" });
    }
  }
);

// Sales report for date range
router.get(
  "/sales-range",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").isISO8601().withMessage("Start date is required and must be in ISO format"),
    query("endDate").isISO8601().withMessage("End date is required and must be in ISO format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const startDate = moment(req.query.startDate).startOf("day").toDate();
      const endDate = moment(req.query.endDate).endOf("day").toDate();

      const salesData = await prisma.sale.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          paymentStatus: "COMPLETED",
        },
        include: {
          employee: {
            select: { name: true },
          },
          customer: {
            select: { name: true },
          },
          saleItems: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const summary = await prisma.sale.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          paymentStatus: "COMPLETED",
        },
        _sum: {
          finalAmount: true,
          taxAmount: true,
          discountAmount: true,
        },
        _count: {
          id: true,
        },
      });

      res.json({
        startDate: moment(startDate).format("YYYY-MM-DD"),
        endDate: moment(endDate).format("YYYY-MM-DD"),
        summary: {
          totalSales: summary._sum.finalAmount || 0,
          totalTax: summary._sum.taxAmount || 0,
          totalDiscount: summary._sum.discountAmount || 0,
          totalTransactions: summary._count.id || 0,
        },
        sales: salesData,
      });
    } catch (error) {
      console.error("Sales range report error:", error);
      res.status(500).json({ error: "Failed to generate sales range report" });
    }
  }
);

// Inventory report
router.get("/inventory", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
      },
      orderBy: {
        stockQuantity: "asc",
      },
    });

    // Calculate inventory value
    const totalValue = products.reduce((sum, product) => {
      return sum + product.stockQuantity * product.purchasePrice;
    }, 0);

    // Low stock items
    const lowStockItems = products.filter((product) => product.stockQuantity <= product.lowStockThreshold);

    // Out of stock items
    const outOfStockItems = products.filter((product) => product.stockQuantity <= 0);

    res.json({
      totalProducts: products.length,
      totalInventoryValue: totalValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      products,
      lowStockItems,
      outOfStockItems,
    });
  } catch (error) {
    console.error("Inventory report error:", error);
    res.status(500).json({ error: "Failed to generate inventory report" });
  }
});

// Employee performance report
router.get(
  "/employee-performance",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601().withMessage("Start date must be in ISO format"),
    query("endDate").optional().isISO8601().withMessage("End date must be in ISO format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const startDate = req.query.startDate
        ? moment(req.query.startDate).startOf("day").toDate()
        : moment().subtract(30, "days").startOf("day").toDate();

      const endDate = req.query.endDate
        ? moment(req.query.endDate).endOf("day").toDate()
        : moment().endOf("day").toDate();

      const employeePerformance = await prisma.sale.groupBy({
        by: ["employeeId"],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          paymentStatus: "COMPLETED",
        },
        _sum: {
          finalAmount: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          finalAmount: true,
        },
      });

      // Get employee details
      const employeeIds = employeePerformance.map((perf) => perf.employeeId);
      const employees = await prisma.employee.findMany({
        where: {
          id: {
            in: employeeIds,
          },
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      });

      const performanceWithDetails = employeePerformance
        .map((perf) => {
          const employee = employees.find((emp) => emp.id === perf.employeeId);
          return {
            employee,
            totalSales: perf._sum.finalAmount || 0,
            totalTransactions: perf._count.id || 0,
            averageTransaction: perf._avg.finalAmount || 0,
          };
        })
        .sort((a, b) => b.totalSales - a.totalSales);

      res.json({
        startDate: moment(startDate).format("YYYY-MM-DD"),
        endDate: moment(endDate).format("YYYY-MM-DD"),
        performance: performanceWithDetails,
      });
    } catch (error) {
      console.error("Employee performance report error:", error);
      res.status(500).json({ error: "Failed to generate employee performance report" });
    }
  }
);

// Product performance report
router.get(
  "/product-performance",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601().withMessage("Start date must be in ISO format"),
    query("endDate").optional().isISO8601().withMessage("End date must be in ISO format"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const startDate = req.query.startDate
        ? moment(req.query.startDate).startOf("day").toDate()
        : moment().subtract(30, "days").startOf("day").toDate();

      const endDate = req.query.endDate
        ? moment(req.query.endDate).endOf("day").toDate()
        : moment().endOf("day").toDate();

      const limit = parseInt(req.query.limit) || 50;

      const productPerformance = await prisma.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            paymentStatus: "COMPLETED",
          },
        },
        _sum: {
          quantity: true,
          subtotal: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            subtotal: "desc",
          },
        },
        take: limit,
      });

      // Get product details
      const productIds = productPerformance.map((perf) => perf.productId);
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        include: {
          category: {
            select: { name: true },
          },
        },
      });

      const performanceWithDetails = productPerformance.map((perf) => {
        const product = products.find((prod) => prod.id === perf.productId);
        const profit = (perf._sum.subtotal || 0) - (product ? product.purchasePrice * (perf._sum.quantity || 0) : 0);

        return {
          product,
          totalQuantitySold: perf._sum.quantity || 0,
          totalRevenue: perf._sum.subtotal || 0,
          totalTransactions: perf._count.id || 0,
          estimatedProfit: profit,
        };
      });

      res.json({
        startDate: moment(startDate).format("YYYY-MM-DD"),
        endDate: moment(endDate).format("YYYY-MM-DD"),
        products: performanceWithDetails,
      });
    } catch (error) {
      console.error("Product performance report error:", error);
      res.status(500).json({ error: "Failed to generate product performance report" });
    }
  }
);

module.exports = router;
