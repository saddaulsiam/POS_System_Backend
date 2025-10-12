import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export function getDateRange(period) {
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const endOfToday = new Date(now.setHours(23, 59, 59, 999));
  switch (period) {
    case "today":
      return { start: startOfToday, end: endOfToday };
    case "yesterday":
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      const endYesterday = new Date(yesterday);
      endYesterday.setHours(23, 59, 59, 999);
      return { start: yesterday, end: endYesterday };
    case "week":
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      return { start: startOfWeek, end: endOfToday };
    case "lastWeek":
      const startOfLastWeek = new Date(startOfToday);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { start: startOfLastWeek, end: endOfLastWeek };
    case "month":
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth, end: endOfToday };
    case "lastMonth":
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: startOfLastMonth, end: endOfLastMonth };
    default:
      return { start: startOfToday, end: endOfToday };
  }
}

export async function getOverview(query) {
  let startDate, endDate;
  if (query.period) {
    const range = getDateRange(query.period);
    startDate = range.start;
    endDate = range.end;
  } else {
    startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    endDate = query.endDate ? new Date(query.endDate) : new Date(new Date().setHours(23, 59, 59, 999));
  }
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: "COMPLETED",
    },
    select: {
      id: true,
      finalAmount: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      paymentMethod: true,
      customerId: true,
    },
  });
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.finalAmount, 0);
  const totalDiscount = sales.reduce((sum, sale) => sum + sale.discountAmount, 0);
  const totalTax = sales.reduce((sum, sale) => sum + sale.taxAmount, 0);
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const uniqueCustomers = new Set(sales.filter((s) => s.customerId).map((s) => s.customerId)).size;
  const periodLength = endDate - startDate;
  const compareStartDate = new Date(startDate.getTime() - periodLength);
  const compareEndDate = new Date(startDate);
  const comparisonSales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: compareStartDate, lt: compareEndDate },
      paymentStatus: "COMPLETED",
    },
    select: { finalAmount: true },
  });
  const comparisonRevenue = comparisonSales.reduce((sum, sale) => sum + sale.finalAmount, 0);
  const revenueGrowth = comparisonRevenue > 0 ? ((totalRevenue - comparisonRevenue) / comparisonRevenue) * 100 : 0;
  const salesGrowth =
    comparisonSales.length > 0 ? ((totalSales - comparisonSales.length) / comparisonSales.length) * 100 : 0;
  const paymentMethods = {};
  sales.forEach((sale) => {
    paymentMethods[sale.paymentMethod] = (paymentMethods[sale.paymentMethod] || 0) + 1;
  });
  return {
    period: { start: startDate, end: endDate },
    metrics: { totalSales, totalRevenue, totalDiscount, totalTax, averageOrderValue, uniqueCustomers },
    growth: { revenue: revenueGrowth, sales: salesGrowth },
    paymentMethods,
  };
}

export async function getSalesTrend(query) {
  const period = query.period || "week";
  const groupBy = query.groupBy || "day";
  const range = getDateRange(period);
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: range.start, lte: range.end },
      paymentStatus: "COMPLETED",
    },
    select: { createdAt: true, finalAmount: true, subtotal: true },
    orderBy: { createdAt: "asc" },
  });
  const grouped = {};
  sales.forEach((sale) => {
    let key;
    const date = new Date(sale.createdAt);
    switch (groupBy) {
      case "hour":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
          2,
          "0"
        )} ${String(date.getHours()).padStart(2, "0")}:00`;
        break;
      case "day":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
          2,
          "0"
        )}`;
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = `${weekStart.getFullYear()}-W${String(Math.ceil(weekStart.getDate() / 7)).padStart(2, "0")}`;
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      default:
        key = date.toISOString().split("T")[0];
    }
    if (!grouped[key]) {
      grouped[key] = { period: key, sales: 0, revenue: 0, count: 0 };
    }
    grouped[key].sales += sale.finalAmount;
    grouped[key].revenue += sale.subtotal;
    grouped[key].count += 1;
  });
  const trend = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  return { period: { start: range.start, end: range.end }, groupBy, data: trend };
}

export async function getTopProducts(query) {
  let startDate, endDate;
  if (query.startDate) {
    startDate = new Date(query.startDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }
  const limit = parseInt(query.limit) || 10;
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        createdAt: { gte: startDate, lte: endDate },
        paymentStatus: "COMPLETED",
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
          category: { select: { name: true } },
        },
      },
      productVariant: { select: { id: true, name: true, sku: true } },
    },
  });
  const productStats = {};
  saleItems.forEach((item) => {
    const key = item.productVariantId ? `variant-${item.productVariantId}` : `product-${item.productId}`;
    if (!productStats[key]) {
      const displayName = item.productVariant
        ? `${item.product.name} - ${item.productVariant.name}`
        : item.product.name;
      productStats[key] = {
        productId: item.productId,
        variantId: item.productVariantId,
        name: displayName,
        sku: item.productVariant?.sku || item.product.sku,
        category: item.product.category.name,
        quantitySold: 0,
        revenue: 0,
        averagePrice: 0,
      };
    }
    productStats[key].quantitySold += item.quantity;
    productStats[key].revenue += item.subtotal;
  });
  Object.values(productStats).forEach((stat) => {
    stat.averagePrice = stat.revenue / stat.quantitySold;
  });
  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
  return { period: { start: startDate, end: endDate }, products: topProducts };
}

export async function getCategoryBreakdown(query) {
  let startDate, endDate;
  if (query.startDate) {
    startDate = new Date(query.startDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        createdAt: { gte: startDate, lte: endDate },
        paymentStatus: "COMPLETED",
      },
    },
    include: {
      product: { select: { category: { select: { id: true, name: true } } } },
    },
  });
  const categoryStats = {};
  saleItems.forEach((item) => {
    const categoryName = item.product.category.name;
    if (!categoryStats[categoryName]) {
      categoryStats[categoryName] = {
        categoryId: item.product.category.id,
        name: categoryName,
        revenue: 0,
        quantity: 0,
        itemCount: 0,
      };
    }
    categoryStats[categoryName].revenue += item.subtotal;
    categoryStats[categoryName].quantity += item.quantity;
    categoryStats[categoryName].itemCount += 1;
  });
  const totalRevenue = Object.values(categoryStats).reduce((sum, cat) => sum + cat.revenue, 0);
  const categories = Object.values(categoryStats)
    .map((cat) => ({ ...cat, percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  return { period: { start: startDate, end: endDate }, totalRevenue, categories };
}

export async function getCustomerStats(query) {
  let startDate, endDate;
  if (query.startDate) {
    startDate = new Date(query.startDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }
  const totalCustomers = await prisma.customer.count({ where: { isActive: true } });
  const newCustomers = await prisma.customer.count({
    where: { createdAt: { gte: startDate, lte: endDate } },
  });
  const tierDistribution = await prisma.customer.groupBy({
    by: ["loyaltyTier"],
    where: { isActive: true },
    _count: { loyaltyTier: true },
  });
  const topCustomers = await prisma.sale.groupBy({
    by: ["customerId"],
    where: {
      customerId: { not: null },
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: "COMPLETED",
    },
    _sum: { finalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { finalAmount: "desc" } },
    take: 10,
  });
  const topCustomersWithDetails = await Promise.all(
    topCustomers.map(async (customer) => {
      const details = await prisma.customer.findUnique({
        where: { id: customer.customerId },
        select: { id: true, name: true, phoneNumber: true, loyaltyTier: true, loyaltyPoints: true },
      });
      return {
        ...details,
        totalSpent: customer._sum.finalAmount,
        purchaseCount: customer._count.id,
        averageOrderValue: customer._sum.finalAmount / customer._count.id,
      };
    })
  );
  return {
    period: { start: startDate, end: endDate },
    totalCustomers,
    newCustomers,
    tierDistribution: tierDistribution.map((t) => ({ tier: t.loyaltyTier, count: t._count.loyaltyTier })),
    topCustomers: topCustomersWithDetails,
  };
}

export async function getPaymentMethods(query) {
  let startDate, endDate;
  if (query.startDate) {
    startDate = new Date(query.startDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }
  const sales = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: "COMPLETED",
    },
    _sum: { finalAmount: true },
    _count: { id: true },
  });
  const totalRevenue = sales.reduce((sum, s) => sum + s._sum.finalAmount, 0);
  const paymentMethods = sales
    .map((method) => ({
      method: method.paymentMethod,
      revenue: method._sum.finalAmount,
      count: method._count.id,
      percentage: totalRevenue > 0 ? (method._sum.finalAmount / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  return { period: { start: startDate, end: endDate }, totalRevenue, methods: paymentMethods };
}
