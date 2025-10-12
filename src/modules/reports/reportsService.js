import { PrismaClient } from "@prisma/client";
import moment from "moment";

const prisma = new PrismaClient();

export const dailySalesReport = async (query) => {
  const date = query.date ? moment(query.date) : moment();
  const startOfDay = date.startOf("day").toDate();
  const endOfDay = date.endOf("day").toDate();

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

  return {
    date: date.format("YYYY-MM-DD"),
    summary: {
      totalSales: salesSummary._sum.finalAmount || 0,
      totalTax: salesSummary._sum.taxAmount || 0,
      totalDiscount: salesSummary._sum.discountAmount || 0,
      totalTransactions: salesSummary._count.id || 0,
    },
    salesByPaymentMethod: salesByPayment,
    topProducts: topProductsWithDetails,
  };
};

export const salesRangeReport = async (query) => {
  const startDate = moment(query.startDate).startOf("day").toDate();
  const endDate = moment(query.endDate).endOf("day").toDate();

  const salesData = await prisma.sale.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      paymentStatus: "COMPLETED",
    },
    include: {
      employee: { select: { name: true } },
      customer: { select: { name: true } },
      saleItems: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
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
    _count: { id: true },
  });

  return {
    startDate: moment(startDate).format("YYYY-MM-DD"),
    endDate: moment(endDate).format("YYYY-MM-DD"),
    summary: {
      totalSales: summary._sum.finalAmount || 0,
      totalTax: summary._sum.taxAmount || 0,
      totalDiscount: summary._sum.discountAmount || 0,
      totalTransactions: summary._count.id || 0,
    },
    sales: salesData,
  };
};

export const inventoryReport = async () => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { stockQuantity: "asc" },
  });

  const totalValue = products.reduce((sum, product) => sum + product.stockQuantity * product.purchasePrice, 0);
  const lowStockItems = products.filter((product) => product.stockQuantity <= product.lowStockThreshold);
  const outOfStockItems = products.filter((product) => product.stockQuantity <= 0);

  return {
    totalProducts: products.length,
    totalInventoryValue: totalValue,
    lowStockCount: lowStockItems.length,
    outOfStockCount: outOfStockItems.length,
    products,
    lowStockItems,
    outOfStockItems,
  };
};

export const employeePerformanceReport = async (query) => {
  const startDate = query.startDate
    ? moment(query.startDate).startOf("day").toDate()
    : moment().subtract(30, "days").startOf("day").toDate();
  const endDate = query.endDate ? moment(query.endDate).endOf("day").toDate() : moment().endOf("day").toDate();

  const employeePerformance = await prisma.sale.groupBy({
    by: ["employeeId"],
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: "COMPLETED",
    },
    _sum: { finalAmount: true },
    _count: { id: true },
    _avg: { finalAmount: true },
  });

  const employeeIds = employeePerformance.map((perf) => perf.employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true, username: true, role: true },
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

  return {
    startDate: moment(startDate).format("YYYY-MM-DD"),
    endDate: moment(endDate).format("YYYY-MM-DD"),
    performance: performanceWithDetails,
  };
};

export const productPerformanceReport = async (query) => {
  const startDate = query.startDate
    ? moment(query.startDate).startOf("day").toDate()
    : moment().subtract(30, "days").startOf("day").toDate();
  const endDate = query.endDate ? moment(query.endDate).endOf("day").toDate() : moment().endOf("day").toDate();
  const limit = parseInt(query.limit) || 50;

  const productPerformance = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      sale: {
        createdAt: { gte: startDate, lte: endDate },
        paymentStatus: "COMPLETED",
      },
    },
    _sum: { quantity: true, subtotal: true },
    _count: { id: true },
    orderBy: { _sum: { subtotal: "desc" } },
    take: limit,
  });

  const productIds = productPerformance.map((perf) => perf.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: { select: { name: true } } },
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

  return {
    startDate: moment(startDate).format("YYYY-MM-DD"),
    endDate: moment(endDate).format("YYYY-MM-DD"),
    products: performanceWithDetails,
  };
};

export const profitMarginReport = async (query) => {
  const startDate = query.startDate ? new Date(query.startDate) : moment().subtract(30, "days").toDate();
  const endDate = query.endDate ? new Date(query.endDate) : new Date();

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

  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
  Object.values(categoryProfits).forEach((cat) => {
    cat.margin = cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(2) : 0;
  });

  return {
    period: { startDate, endDate },
    overall: {
      revenue: parseFloat(totalRevenue.toFixed(2)),
      cost: parseFloat(totalCost.toFixed(2)),
      profit: parseFloat(totalProfit.toFixed(2)),
      margin: parseFloat(totalMargin),
    },
    byCategory: Object.values(categoryProfits),
  };
};

export const stockTurnoverReport = async (query) => {
  const days = parseInt(query.days) || 30;
  const startDate = moment().subtract(days, "days").toDate();

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
    const averageStock = product.stockQuantity + totalSold / 2;
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

  turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate);

  return {
    period: { days, startDate },
    products: turnoverData,
    summary: {
      totalProducts: turnoverData.length,
      fastMoving: turnoverData.filter((p) => p.status === "FAST_MOVING").length,
      moderate: turnoverData.filter((p) => p.status === "MODERATE").length,
      slowMoving: turnoverData.filter((p) => p.status === "SLOW_MOVING").length,
      stagnant: turnoverData.filter((p) => p.status === "STAGNANT").length,
    },
  };
};

export const salesTrendsReport = async (query) => {
  const startDate = query.startDate ? new Date(query.startDate) : moment().subtract(30, "days").toDate();
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  const groupBy = query.groupBy || "day";

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
  Object.values(grouped).forEach((period) => {
    period.averageTransactionValue =
      period.transactionCount > 0 ? parseFloat((period.totalRevenue / period.transactionCount).toFixed(2)) : 0;
    period.totalRevenue = parseFloat(period.totalRevenue.toFixed(2));
  });
  const trendData = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  return {
    period: { startDate, endDate, groupBy },
    data: trendData,
  };
};

export const customerAnalyticsReport = async (query) => {
  const days = parseInt(query.days) || 30;
  const startDate = moment().subtract(days, "days").toDate();

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

  return {
    period: { days, startDate },
    customers: analytics.slice(0, 50),
    summary: {
      totalActiveCustomers: analytics.length,
      totalRevenue: parseFloat(analytics.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)),
      averageCustomerValue: parseFloat(
        (analytics.reduce((sum, c) => sum + c.totalSpent, 0) / analytics.length).toFixed(2)
      ),
    },
  };
};
