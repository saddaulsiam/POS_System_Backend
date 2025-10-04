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

// Profit margin analysis
router.get(
  "/profit-margin",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate) : moment().subtract(30, "days").toDate();
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

      const salesData = await prisma.saleItem.findMany({
        where: {
          sale: {
            createdAt: { gte: startDate, lte: endDate },
            paymentStatus: "COMPLETED",
          },
        },
        include: {
          product: {
            select: { id: true, name: true, purchasePrice: true, category: { select: { name: true } } },
          },
          sale: { select: { finalAmount: true } },
        },
      });

      let totalRevenue = 0;
      let totalCost = 0;
      const categoryProfits = {};

      salesData.forEach((item) => {
        const revenue = item.subtotal;
        const cost = item.product.purchasePrice * item.quantity;
        const profit = revenue - cost;

        totalRevenue += revenue;
        totalCost += cost;

        const categoryName = item.product.category.name;
        if (!categoryProfits[categoryName]) {
          categoryProfits[categoryName] = {
            category: categoryName,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0,
          };
        }

        categoryProfits[categoryName].revenue += revenue;
        categoryProfits[categoryName].cost += cost;
        categoryProfits[categoryName].profit += profit;
      });

      // Calculate margins
      const totalProfit = totalRevenue - totalCost;
      const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

      Object.values(categoryProfits).forEach((cat) => {
        cat.margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(2) : 0;
      });

      res.json({
        period: { startDate, endDate },
        overall: {
          revenue: parseFloat(totalRevenue.toFixed(2)),
          cost: parseFloat(totalCost.toFixed(2)),
          profit: parseFloat(totalProfit.toFixed(2)),
          margin: parseFloat(totalMargin),
        },
        byCategory: Object.values(categoryProfits),
      });
    } catch (error) {
      console.error("Profit margin analysis error:", error);
      res.status(500).json({ error: "Failed to generate profit margin analysis" });
    }
  }
);

// Stock turnover report
router.get("/stock-turnover", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = moment().subtract(days, "days").toDate();

    // Get products with sales and stock data
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        purchasePrice: true,
        category: { select: { name: true } },
        saleItems: {
          where: {
            sale: {
              createdAt: { gte: startDate },
              paymentStatus: "COMPLETED",
            },
          },
          select: { quantity: true },
        },
      },
    });

    const turnoverData = products.map((product) => {
      const totalSold = product.saleItems.reduce((sum, item) => sum + item.quantity, 0);
      const averageStock = product.stockQuantity + totalSold / 2; // Simplified average
      const turnoverRate = averageStock > 0 ? parseFloat((totalSold / averageStock).toFixed(2)) : 0;
      const daysToSellOut =
        totalSold > 0 ? parseFloat(((product.stockQuantity / (totalSold / days)) * days).toFixed(1)) : 0;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category.name,
        currentStock: product.stockQuantity,
        soldInPeriod: totalSold,
        turnoverRate,
        daysToSellOut: daysToSellOut > 365 ? "365+" : daysToSellOut,
        status:
          turnoverRate > 2
            ? "FAST_MOVING"
            : turnoverRate > 1
            ? "MODERATE"
            : turnoverRate > 0.5
            ? "SLOW_MOVING"
            : "STAGNANT",
      };
    });

    // Sort by turnover rate
    turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate);

    res.json({
      period: { days, startDate },
      products: turnoverData,
      summary: {
        totalProducts: turnoverData.length,
        fastMoving: turnoverData.filter((p) => p.status === "FAST_MOVING").length,
        moderate: turnoverData.filter((p) => p.status === "MODERATE").length,
        slowMoving: turnoverData.filter((p) => p.status === "SLOW_MOVING").length,
        stagnant: turnoverData.filter((p) => p.status === "STAGNANT").length,
      },
    });
  } catch (error) {
    console.error("Stock turnover error:", error);
    res.status(500).json({ error: "Failed to generate stock turnover report" });
  }
});

// Sales trends (for charts)
router.get(
  "/sales-trends",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("groupBy").optional().isIn(["hour", "day", "week", "month"]),
  ],
  async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate) : moment().subtract(30, "days").toDate();
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      const groupBy = req.query.groupBy || "day";

      const sales = await prisma.sale.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          paymentStatus: "COMPLETED",
        },
        select: {
          id: true,
          finalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group sales by time period
      const grouped = {};

      sales.forEach((sale) => {
        const date = moment(sale.createdAt);
        let key;

        switch (groupBy) {
          case "hour":
            key = date.format("YYYY-MM-DD HH:00");
            break;
          case "day":
            key = date.format("YYYY-MM-DD");
            break;
          case "week":
            key = date.startOf("week").format("YYYY-MM-DD");
            break;
          case "month":
            key = date.format("YYYY-MM");
            break;
          default:
            key = date.format("YYYY-MM-DD");
        }

        if (!grouped[key]) {
          grouped[key] = {
            period: key,
            totalSales: 0,
            totalRevenue: 0,
            transactionCount: 0,
          };
        }

        grouped[key].totalRevenue += sale.finalAmount;
        grouped[key].transactionCount += 1;
      });

      // Calculate average transaction value
      Object.values(grouped).forEach((period) => {
        period.averageTransactionValue =
          period.transactionCount > 0 ? parseFloat((period.totalRevenue / period.transactionCount).toFixed(2)) : 0;
        period.totalRevenue = parseFloat(period.totalRevenue.toFixed(2));
      });

      const trendData = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));

      res.json({
        period: { startDate, endDate, groupBy },
        data: trendData,
      });
    } catch (error) {
      console.error("Sales trends error:", error);
      res.status(500).json({ error: "Failed to generate sales trends" });
    }
  }
);

// Customer analytics
router.get("/customer-analytics", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = moment().subtract(days, "days").toDate();

    // Customer purchase patterns
    const customerStats = await prisma.customer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        sales: {
          where: {
            createdAt: { gte: startDate },
            paymentStatus: "COMPLETED",
          },
          select: {
            finalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    const analytics = customerStats
      .map((customer) => {
        const totalSpent = customer.sales.reduce((sum, sale) => sum + sale.finalAmount, 0);
        const purchaseCount = customer.sales.length;
        const averageOrderValue = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

        return {
          customerId: customer.id,
          name: customer.name,
          loyaltyTier: customer.loyaltyTier,
          loyaltyPoints: customer.loyaltyPoints,
          purchaseCount,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          lastPurchase:
            customer.sales.length > 0
              ? moment(customer.sales[customer.sales.length - 1].createdAt).format("YYYY-MM-DD")
              : null,
        };
      })
      .filter((c) => c.purchaseCount > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({
      period: { days, startDate },
      customers: analytics.slice(0, 50), // Top 50
      summary: {
        totalActiveCustomers: analytics.length,
        totalRevenue: parseFloat(analytics.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)),
        averageCustomerValue: parseFloat(
          (analytics.reduce((sum, c) => sum + c.totalSpent, 0) / analytics.length).toFixed(2)
        ),
      },
    });
  } catch (error) {
    console.error("Customer analytics error:", error);
    res.status(500).json({ error: "Failed to generate customer analytics" });
  }
});

module.exports = router;
