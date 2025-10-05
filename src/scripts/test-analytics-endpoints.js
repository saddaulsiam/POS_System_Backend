const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

// You'll need to replace this with a valid admin token
// To get a token: Login to the app, open browser console, run: localStorage.getItem('token')
const AUTH_TOKEN = "YOUR_TOKEN_HERE";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  },
});

async function testAnalyticsEndpoints() {
  console.log("🧪 TESTING ANALYTICS ENDPOINTS\n");
  console.log("=" .repeat(60));

  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Overview endpoint
  try {
    console.log("\n📊 Test 1: GET /analytics/overview (today)");
    const response = await api.get("/analytics/overview", {
      params: { period: "today" },
    });
    console.log("✅ Status:", response.status);
    console.log("📦 Response structure:");
    console.log("  - period:", JSON.stringify(response.data.period));
    console.log("  - metrics:", Object.keys(response.data.metrics));
    console.log("  - growth:", Object.keys(response.data.growth));
    console.log("📈 Metrics:");
    console.log(`  - Total Sales: ${response.data.metrics.totalSales}`);
    console.log(`  - Total Revenue: $${response.data.metrics.totalRevenue.toFixed(2)}`);
    console.log(`  - Average Order Value: $${response.data.metrics.averageOrderValue.toFixed(2)}`);
    console.log(`  - Unique Customers: ${response.data.metrics.uniqueCustomers}`);
    console.log(`  - Revenue Growth: ${response.data.growth.revenue.toFixed(1)}%`);
    tests.push({ name: "Overview (today)", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Overview (today)", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 2: Overview with custom dates
  try {
    console.log("\n📊 Test 2: GET /analytics/overview (week)");
    const response = await api.get("/analytics/overview", {
      params: { period: "week" },
    });
    console.log("✅ Status:", response.status);
    console.log(`  - Total Sales (week): ${response.data.metrics.totalSales}`);
    console.log(`  - Total Revenue (week): $${response.data.metrics.totalRevenue.toFixed(2)}`);
    tests.push({ name: "Overview (week)", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Overview (week)", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 3: Sales Trend
  try {
    console.log("\n📈 Test 3: GET /analytics/sales-trend");
    const response = await api.get("/analytics/sales-trend", {
      params: { period: "week", groupBy: "day" },
    });
    console.log("✅ Status:", response.status);
    console.log("📦 Response:");
    console.log(`  - Data points: ${response.data.data.length}`);
    console.log(`  - Group by: ${response.data.groupBy}`);
    if (response.data.data.length > 0) {
      console.log("  - Sample data point:", response.data.data[0]);
    }
    tests.push({ name: "Sales Trend", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Sales Trend", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 4: Top Products
  try {
    console.log("\n🏆 Test 4: GET /analytics/top-products");
    const response = await api.get("/analytics/top-products", {
      params: { limit: 5 },
    });
    console.log("✅ Status:", response.status);
    console.log(`📦 Top ${response.data.products.length} Products:`);
    response.data.products.slice(0, 3).forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name}`);
      console.log(`     - Category: ${product.category}`);
      console.log(`     - Qty Sold: ${product.quantitySold.toFixed(2)}`);
      console.log(`     - Revenue: $${product.revenue.toFixed(2)}`);
    });
    tests.push({ name: "Top Products", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Top Products", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 5: Category Breakdown
  try {
    console.log("\n🗂️  Test 5: GET /analytics/category-breakdown");
    const response = await api.get("/analytics/category-breakdown");
    console.log("✅ Status:", response.status);
    console.log(`📦 Categories: ${response.data.categories.length}`);
    console.log(`💰 Total Revenue: $${response.data.totalRevenue.toFixed(2)}`);
    console.log("Top Categories:");
    response.data.categories.slice(0, 3).forEach((cat) => {
      console.log(`  - ${cat.name}: $${cat.revenue.toFixed(2)} (${cat.percentage.toFixed(1)}%)`);
    });
    tests.push({ name: "Category Breakdown", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Category Breakdown", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 6: Customer Stats
  try {
    console.log("\n👥 Test 6: GET /analytics/customer-stats");
    const response = await api.get("/analytics/customer-stats");
    console.log("✅ Status:", response.status);
    console.log("📦 Customer Stats:");
    console.log(`  - Total Customers: ${response.data.totalCustomers}`);
    console.log(`  - New Customers: ${response.data.newCustomers}`);
    console.log(`  - Tier Distribution: ${response.data.tierDistribution.length} tiers`);
    console.log(`  - Top Customers: ${response.data.topCustomers.length}`);
    if (response.data.topCustomers.length > 0) {
      const top = response.data.topCustomers[0];
      console.log(`  - #1 Customer: ${top.name} ($${top.totalSpent.toFixed(2)})`);
    }
    tests.push({ name: "Customer Stats", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Customer Stats", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Test 7: Payment Methods
  try {
    console.log("\n💳 Test 7: GET /analytics/payment-methods");
    const response = await api.get("/analytics/payment-methods");
    console.log("✅ Status:", response.status);
    console.log(`📦 Payment Methods: ${response.data.methods.length}`);
    console.log(`💰 Total Revenue: $${response.data.totalRevenue.toFixed(2)}`);
    response.data.methods.forEach((method) => {
      console.log(`  - ${method.method}: ${method.count} sales, $${method.revenue.toFixed(2)} (${method.percentage.toFixed(1)}%)`);
    });
    tests.push({ name: "Payment Methods", status: "✅ PASS" });
    passed++;
  } catch (error) {
    console.log("❌ FAILED:", error.response?.data?.error || error.message);
    tests.push({ name: "Payment Methods", status: "❌ FAIL", error: error.message });
    failed++;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  tests.forEach((test) => {
    console.log(`${test.status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log("=".repeat(60));

  if (failed === 0) {
    console.log("\n🎉 ALL TESTS PASSED! Analytics API is fully functional.");
  } else {
    console.log("\n⚠️  Some tests failed. Check errors above.");
  }
}

// Check if token is provided
if (AUTH_TOKEN === "YOUR_TOKEN_HERE") {
  console.log("⚠️  ERROR: Please set AUTH_TOKEN in the script");
  console.log("\nTo get your token:");
  console.log("1. Login to the POS system");
  console.log("2. Open browser console (F12)");
  console.log("3. Run: localStorage.getItem('token')");
  console.log("4. Copy the token value");
  console.log("5. Replace YOUR_TOKEN_HERE in this script");
  process.exit(1);
}

testAnalyticsEndpoints().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
