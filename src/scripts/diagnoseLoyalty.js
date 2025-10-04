#!/usr/bin/env node
/**
 * Loyalty System Diagnostic Tool
 * Tests all endpoints and database functions
 */

const http = require("http");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = "http://localhost:5000";
const AUTH_TOKEN = ""; // Will need actual token

// Color codes for terminal
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDatabase() {
  log("\n📊 TESTING DATABASE", "blue");
  log("=".repeat(50), "blue");

  try {
    // Test 1: Tier Configuration
    log("\n1. Testing Loyalty Tier Configuration...", "yellow");
    const tiers = await prisma.loyaltyTierConfig.findMany({
      orderBy: { minimumPoints: "asc" },
    });

    if (tiers.length === 0) {
      log("   ❌ ERROR: No tiers found in database!", "red");
      log("   💡 Run: node src/scripts/seedLoyaltyTiers.js", "yellow");
      return false;
    }

    log(`   ✅ Found ${tiers.length} tiers`, "green");
    tiers.forEach((tier) => {
      log(
        `      ${tier.tier}: ${tier.minimumPoints} pts, ${tier.pointsMultiplier}x multiplier, ${tier.discountPercentage}% discount`,
        "green"
      );
    });

    // Test 2: Customers
    log("\n2. Testing Customer Data...", "yellow");
    const totalCustomers = await prisma.customer.count({ where: { isActive: true } });
    const customersWithPoints = await prisma.customer.count({
      where: { loyaltyPoints: { gt: 0 }, isActive: true },
    });
    log(`   ✅ Total active customers: ${totalCustomers}`, "green");
    log(`   ✅ Customers with points: ${customersWithPoints}`, "green");

    // Test 3: Points Transactions
    log("\n3. Testing Points Transactions...", "yellow");
    const transactionCount = await prisma.pointsTransaction.count();
    const earnedCount = await prisma.pointsTransaction.count({ where: { type: "EARNED" } });
    const redeemedCount = await prisma.pointsTransaction.count({ where: { type: "REDEEMED" } });
    log(`   ✅ Total transactions: ${transactionCount}`, "green");
    log(`   ✅ Earned: ${earnedCount}, Redeemed: ${redeemedCount}`, "green");

    // Test 4: Loyalty Offers
    log("\n4. Testing Loyalty Offers...", "yellow");
    const offerCount = await prisma.loyaltyOffer.count();
    const activeOffers = await prisma.loyaltyOffer.count({ where: { isActive: true } });
    log(`   ✅ Total offers: ${offerCount}`, "green");
    log(`   ✅ Active offers: ${activeOffers}`, "green");

    // Test 5: Loyalty Rewards
    log("\n5. Testing Loyalty Rewards...", "yellow");
    const rewardCount = await prisma.loyaltyReward.count();
    const redeemedRewards = await prisma.loyaltyReward.count({ where: { redeemedAt: { not: null } } });
    log(`   ✅ Total rewards: ${rewardCount}`, "green");
    log(`   ✅ Redeemed rewards: ${redeemedRewards}`, "green");

    return true;
  } catch (error) {
    log(`\n❌ DATABASE ERROR: ${error.message}`, "red");
    console.error(error);
    return false;
  }
}

async function testBackendRoutes() {
  log("\n🔌 TESTING BACKEND ROUTES", "blue");
  log("=".repeat(50), "blue");

  const routes = [
    { method: "GET", path: "/api/loyalty/tiers", description: "Get tier configuration" },
    { method: "GET", path: "/api/loyalty/offers", description: "Get loyalty offers" },
    { method: "GET", path: "/api/loyalty/statistics", description: "Get statistics (requires auth)" },
  ];

  log("\n⚠️  Route testing requires running backend server", "yellow");
  log("   Start backend with: npm run dev (in backend folder)", "yellow");
  log("\n   Routes to test manually:", "yellow");
  routes.forEach((route) => {
    log(`   ${route.method} ${BASE_URL}${route.path} - ${route.description}`, "yellow");
  });
}

function testFrontendIntegration() {
  log("\n🎨 FRONTEND INTEGRATION CHECKLIST", "blue");
  log("=".repeat(50), "blue");

  const checks = [
    {
      file: "frontend/src/pages/LoyaltyAdminPage.tsx",
      checks: [
        "Component imports loyaltyAPI from services/api",
        "Three tabs: Overview, Tiers, Offers",
        "Fetches data on mount with fetchAllData()",
        "Handles tier editing with modal",
        "Handles offer CRUD operations",
      ],
    },
    {
      file: "frontend/src/services/api.ts",
      checks: [
        "loyaltyAPI.getTierConfig() - GET /loyalty/tiers",
        "loyaltyAPI.updateTierConfig() - POST /loyalty/tiers/config",
        "loyaltyAPI.getAllOffers() - GET /loyalty/offers",
        "loyaltyAPI.createOffer() - POST /loyalty/offers",
        "loyaltyAPI.updateOffer() - PUT /loyalty/offers/:id",
        "loyaltyAPI.deleteOffer() - DELETE /loyalty/offers/:id",
        "loyaltyAPI.getStatistics() - GET /loyalty/statistics",
        "loyaltyAPI.getLoyaltyStatus() - GET /loyalty/customers/:id/loyalty-status",
      ],
    },
    {
      file: "frontend/src/App.tsx",
      checks: [
        "Route /loyalty-admin exists",
        "LoyaltyAdminPage component imported",
        "Route protected by admin/manager roles",
      ],
    },
    {
      file: "frontend/src/components/common/Sidebar.tsx",
      checks: ["Loyalty Program link exists", "Link points to /loyalty-admin", "Visible to ADMIN/MANAGER"],
    },
  ];

  checks.forEach((fileCheck) => {
    log(`\n📄 ${fileCheck.file}`, "yellow");
    fileCheck.checks.forEach((check) => {
      log(`   ☐ ${check}`, "yellow");
    });
  });
}

function printCommonIssues() {
  log("\n🔧 COMMON ISSUES & SOLUTIONS", "blue");
  log("=".repeat(50), "blue");

  const issues = [
    {
      issue: "❌ No tiers in database",
      solution: "Run: node src/scripts/seedLoyaltyTiers.js",
    },
    {
      issue: "❌ 404 errors on API calls",
      solution: "Check backend is running on port 5000",
    },
    {
      issue: "❌ 401 Unauthorized errors",
      solution: "Ensure user is logged in with ADMIN or MANAGER role",
    },
    {
      issue: "❌ Statistics not loading",
      solution: "Check /api/loyalty/statistics endpoint in Network tab",
    },
    {
      issue: "❌ Offers not appearing",
      solution: "Check offer dates and isActive status in database",
    },
    {
      issue: "❌ Tier changes not saving",
      solution: "Check POST /api/loyalty/tiers/config endpoint validation",
    },
    {
      issue: "❌ Points not calculating correctly",
      solution: "Check LOYALTY_TIERS constant in backend/src/routes/loyalty.js",
    },
    {
      issue: "❌ Frontend shows blank page",
      solution: "Check browser console for errors, verify all API methods exist",
    },
  ];

  issues.forEach((item, index) => {
    log(`\n${index + 1}. ${item.issue}`, "red");
    log(`   💡 ${item.solution}`, "green");
  });
}

function printQuickChecks() {
  log("\n⚡ QUICK DIAGNOSTIC CHECKS", "blue");
  log("=".repeat(50), "blue");

  log("\n1. Backend Server:", "yellow");
  log("   curl http://localhost:5000/api/loyalty/tiers", "yellow");
  log("   Expected: JSON array with tier configs", "yellow");

  log("\n2. Database Tiers:", "yellow");
  log("   sqlite3 prisma/dev.db 'SELECT * FROM LoyaltyTierConfig;'", "yellow");
  log("   Expected: 4 rows (BRONZE, SILVER, GOLD, PLATINUM)", "yellow");

  log("\n3. Frontend Build:", "yellow");
  log("   npm run build", "yellow");
  log("   Expected: No TypeScript errors", "yellow");

  log("\n4. Browser Console:", "yellow");
  log("   Open /loyalty-admin in browser", "yellow");
  log("   Check Network tab for failed API calls", "yellow");
  log("   Check Console for JavaScript errors", "yellow");
}

async function main() {
  log("\n╔═══════════════════════════════════════════════════╗", "blue");
  log("║   LOYALTY PROGRAM DIAGNOSTIC TOOL                 ║", "blue");
  log("╚═══════════════════════════════════════════════════╝", "blue");

  const dbOk = await testDatabase();

  testBackendRoutes();
  testFrontendIntegration();
  printCommonIssues();
  printQuickChecks();

  log("\n" + "=".repeat(50), "blue");
  if (dbOk) {
    log("✅ Database checks passed!", "green");
    log("Next: Start backend server and test API endpoints", "yellow");
  } else {
    log("❌ Database issues found - fix these first!", "red");
  }
  log("=".repeat(50) + "\n", "blue");

  await prisma.$disconnect();
}

main();
