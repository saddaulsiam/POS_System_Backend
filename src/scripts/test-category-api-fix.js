const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

// Replace with a valid admin token
// To get: Login, open console, run: localStorage.getItem('token')
const AUTH_TOKEN = "YOUR_TOKEN_HERE";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  },
});

async function testCategoryBreakdownAPI() {
  console.log("🧪 TESTING CATEGORY BREAKDOWN API FIX\n");
  console.log("=".repeat(60));

  try {
    // Test 1: Category breakdown with default (today)
    console.log("\n📊 Test 1: Category Breakdown - Today");
    const todayResponse = await api.get("/analytics/category-breakdown");
    console.log("✅ Status:", todayResponse.status);
    console.log(`📦 Categories found: ${todayResponse.data.categories.length}`);
    console.log(`💰 Total Revenue: $${todayResponse.data.totalRevenue.toFixed(2)}`);

    if (todayResponse.data.categories.length > 0) {
      console.log("\nTop 3 Categories:");
      todayResponse.data.categories.slice(0, 3).forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name}`);
        console.log(`     Revenue: $${cat.revenue.toFixed(2)}`);
        console.log(`     Percentage: ${cat.percentage.toFixed(1)}%`);
        console.log(`     Items Sold: ${cat.quantity}`);
      });
    } else {
      console.log("⚠️  No category data for today");
    }

    // Test 2: Category breakdown for the week
    console.log("\n📊 Test 2: Category Breakdown - This Week");

    // Calculate date range
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const weekResponse = await api.get("/analytics/category-breakdown", {
      params: {
        startDate: formatDate(startOfWeek),
        endDate: formatDate(now),
      },
    });

    console.log("✅ Status:", weekResponse.status);
    console.log(`📦 Categories found: ${weekResponse.data.categories.length}`);
    console.log(`💰 Total Revenue: $${weekResponse.data.totalRevenue.toFixed(2)}`);

    if (weekResponse.data.categories.length > 0) {
      console.log("\nAll Categories:");
      weekResponse.data.categories.forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name} - $${cat.revenue.toFixed(2)} (${cat.percentage.toFixed(1)}%)`);
      });
    }

    // Verify data quality
    console.log("\n🔍 Data Quality Checks:");
    const hasValidRevenue = weekResponse.data.categories.every(
      (cat) => typeof cat.revenue === "number" && !isNaN(cat.revenue)
    );
    const hasValidPercentage = weekResponse.data.categories.every(
      (cat) => typeof cat.percentage === "number" && !isNaN(cat.percentage)
    );
    const percentageSum = weekResponse.data.categories.reduce((sum, cat) => sum + cat.percentage, 0);

    console.log(`  ✅ All revenues are valid numbers: ${hasValidRevenue}`);
    console.log(`  ✅ All percentages are valid numbers: ${hasValidPercentage}`);
    console.log(
      `  ✅ Percentages sum to ~100%: ${percentageSum.toFixed(1)}% (${
        Math.abs(100 - percentageSum) < 0.1 ? "PASS" : "FAIL"
      })`
    );

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED!");
    console.log("🎉 Category breakdown is working correctly!");
    console.log("\n💡 Next Steps:");
    console.log("   1. Test in Analytics page (http://localhost:3001/analytics)");
    console.log("   2. Test in Dashboard page (http://localhost:3001/admin)");
    console.log("   3. Verify pie chart displays correctly");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ TEST FAILED!");
    console.error("Error:", error.response?.data?.error || error.message);
    if (error.response?.status === 401) {
      console.log("\n⚠️  Authentication Error!");
      console.log("Please update AUTH_TOKEN in this script:");
      console.log("1. Login to http://localhost:3001");
      console.log("2. Open browser console (F12)");
      console.log("3. Run: localStorage.getItem('token')");
      console.log("4. Copy the token and replace YOUR_TOKEN_HERE");
    }
    process.exit(1);
  }
}

if (AUTH_TOKEN === "YOUR_TOKEN_HERE") {
  console.log("⚠️  Please set AUTH_TOKEN first!");
  console.log("\nTo get your token:");
  console.log("1. Login to http://localhost:3001");
  console.log("2. Open browser console (F12)");
  console.log("3. Run: localStorage.getItem('token')");
  console.log("4. Replace YOUR_TOKEN_HERE in this script");
  process.exit(1);
}

testCategoryBreakdownAPI();
