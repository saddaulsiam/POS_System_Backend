import * as analyticsService from "./analyticsService.js";

export async function overview(req, res) {
  try {
    const result = await analyticsService.getOverview(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({ error: "Failed to fetch analytics overview" });
  }
}

export async function salesTrend(req, res) {
  try {
    const result = await analyticsService.getSalesTrend(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching sales trend:", error);
    res.status(500).json({ error: "Failed to fetch sales trend" });
  }
}

export async function topProducts(req, res) {
  try {
    const result = await analyticsService.getTopProducts(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({ error: "Failed to fetch top products" });
  }
}

export async function categoryBreakdown(req, res) {
  try {
    const result = await analyticsService.getCategoryBreakdown(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching category breakdown:", error);
    res.status(500).json({ error: "Failed to fetch category breakdown" });
  }
}

export async function customerStats(req, res) {
  try {
    const result = await analyticsService.getCustomerStats(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    res.status(500).json({ error: "Failed to fetch customer statistics" });
  }
}

export async function paymentMethods(req, res) {
  try {
    const result = await analyticsService.getPaymentMethods(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ error: "Failed to fetch payment method statistics" });
  }
}
