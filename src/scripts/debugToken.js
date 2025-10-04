/**
 * Debug User Token and Role
 * Run this to check what role the logged-in user has
 */

const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function debugToken() {
  console.log("🔍 Token Debug Utility\n");

  const token = process.argv[2];

  if (!token) {
    console.log("❌ No token provided!");
    console.log("\nUsage: node debugToken.js YOUR_TOKEN");
    console.log("\nTo get your token:");
    console.log("1. Login to the app");
    console.log("2. Open browser console (F12)");
    console.log("3. Run: localStorage.getItem('token')");
    console.log("4. Copy the token (without quotes)");
    console.log("\n");
    process.exit(1);
  }

  try {
    console.log("📦 Decoding token...");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("\n✅ Token decoded:");
    console.log(JSON.stringify(decoded, null, 2));

    if (decoded.userId) {
      console.log("\n🔍 Looking up user in database...");
      const employee = await prisma.employee.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          isActive: true,
        },
      });

      if (employee) {
        console.log("\n✅ User found:");
        console.log(JSON.stringify(employee, null, 2));
        console.log("\n📋 Authorization Check:");
        console.log(`   Role: ${employee.role}`);
        console.log(`   Active: ${employee.isActive}`);
        console.log(
          `   Can access /loyalty/statistics: ${
            ["ADMIN", "MANAGER"].includes(employee.role) && employee.isActive ? "✅ YES" : "❌ NO"
          }`
        );

        if (!["ADMIN", "MANAGER"].includes(employee.role)) {
          console.log("\n⚠️  PROBLEM: User role is not ADMIN or MANAGER");
          console.log(`   Current role: "${employee.role}"`);
          console.log(`   Required role: "ADMIN" or "MANAGER"`);
          console.log("\n💡 Solution: Update user role in database:");
          console.log(`   UPDATE Employee SET role = 'ADMIN' WHERE id = ${employee.id};`);
        }

        if (!employee.isActive) {
          console.log("\n⚠️  PROBLEM: User is not active");
          console.log("\n💡 Solution: Activate user in database:");
          console.log(`   UPDATE Employee SET isActive = 1 WHERE id = ${employee.id};`);
        }
      } else {
        console.log("\n❌ User not found in database!");
        console.log(`   Looking for user ID: ${decoded.userId}`);
      }
    }
  } catch (error) {
    console.log("\n❌ Error:", error.message);
    if (error.name === "JsonWebTokenError") {
      console.log("\n💡 Token is invalid or malformed");
    } else if (error.name === "TokenExpiredError") {
      console.log("\n💡 Token has expired - please login again");
    }
  } finally {
    await prisma.$disconnect();
  }
}

debugToken();
