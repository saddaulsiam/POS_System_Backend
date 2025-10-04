/**
 * API Endpoint Tester for Loyalty System
 * Tests all loyalty endpoints with sample data
 *
 * Usage: Ensure backend server is running, then run:
 * node src/scripts/testLoyaltyEndpoints.js <admin-token>
 */

const http = require("http");
const https = require("https");

const BASE_URL = "http://localhost:5000";
const token = process.argv[2] || "";

if (!token) {
  console.log("⚠️  Warning: No auth token provided");
  console.log("Usage: node testLoyaltyEndpoints.js <admin-token>");
  console.log("\nTo get a token:");
  console.log("1. Login as admin through the frontend");
  console.log("2. Open browser console");
  console.log("3. Run: localStorage.getItem('token')");
  console.log("\nProceeding with tests that don't require auth...\n");
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testEndpoint(name, method, path, data = null, expectedStatus = 200) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   ${method} ${path}`);

    const result = await makeRequest(method, path, data);

    if (result.status === expectedStatus) {
      console.log(`   ✅ Status: ${result.status} (expected)`);
      if (result.data) {
        console.log(`   📦 Response:`, JSON.stringify(result.data, null, 2).split("\n").slice(0, 10).join("\n"));
        if (JSON.stringify(result.data).length > 500) {
          console.log(`   ... (truncated)`);
        }
      }
      return { success: true, data: result.data };
    } else {
      console.log(`   ❌ Status: ${result.status} (expected ${expectedStatus})`);
      console.log(`   Error:`, result.data);
      return { success: false, data: result.data };
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║   LOYALTY API ENDPOINT TESTS                      ║");
  console.log("╚═══════════════════════════════════════════════════╝");

  const results = [];

  // Test 1: Get Tier Configuration
  results.push(await testEndpoint("Get Tier Configuration", "GET", "/api/loyalty/tiers"));

  // Test 2: Get Loyalty Offers
  results.push(await testEndpoint("Get All Loyalty Offers", "GET", "/api/loyalty/offers"));

  if (token) {
    console.log("\n" + "=".repeat(50));
    console.log("AUTHENTICATED TESTS (Admin/Manager required)");
    console.log("=".repeat(50));

    // Test 3: Get Statistics
    results.push(await testEndpoint("Get Loyalty Statistics", "GET", "/api/loyalty/statistics"));

    // Test 4: Create Offer
    const offerData = {
      title: "Test Weekend Special",
      description: "Test offer - 20% off for testing",
      offerType: "DISCOUNT_PERCENTAGE",
      discountValue: 20,
      minimumPurchase: 50,
      requiredTier: "BRONZE",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const createResult = await testEndpoint("Create Loyalty Offer", "POST", "/api/loyalty/offers", offerData, 201);
    results.push(createResult);

    // Test 5: Update Offer (if create succeeded)
    if (createResult.success && createResult.data?.id) {
      const offerId = createResult.data.id;

      results.push(
        await testEndpoint("Update Loyalty Offer", "PUT", `/api/loyalty/offers/${offerId}`, {
          title: "Updated Test Offer",
          discountValue: 25,
        })
      );

      // Test 6: Delete Offer
      results.push(await testEndpoint("Delete Loyalty Offer", "DELETE", `/api/loyalty/offers/${offerId}`));
    }

    // Test 7: Update Tier Configuration
    results.push(
      await testEndpoint("Update Tier Configuration", "POST", "/api/loyalty/tiers/config", {
        tier: "BRONZE",
        minimumPoints: 0,
        pointsMultiplier: 1.0,
        discountPercentage: 0,
        birthdayBonus: 50,
        description: "Entry level tier - updated for testing",
      })
    );

    // Test 8: Get Customer Loyalty Status (using customer ID 1)
    results.push(await testEndpoint("Get Customer Loyalty Status", "GET", "/api/loyalty/customers/1/loyalty-status"));

    // Test 9: Award Points
    results.push(
      await testEndpoint("Award Loyalty Points", "POST", "/api/loyalty/award-points", {
        customerId: 1,
        saleId: 1,
        amount: 100,
      })
    );

    // Test 10: Get Points History
    results.push(await testEndpoint("Get Points History", "GET", "/api/loyalty/customers/1/points-history"));
  } else {
    console.log("\n⚠️  Skipping authenticated tests (no token provided)");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("TEST SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${results.length}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed - check output above");
  }

  console.log("\n" + "=".repeat(50));
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
