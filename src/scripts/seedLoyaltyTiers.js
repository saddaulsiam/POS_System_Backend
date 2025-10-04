/**
 * Seed Loyalty Tier Configuration
 * This script initializes the loyalty tier configuration in the database
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LOYALTY_TIERS = [
  {
    tier: "BRONZE",
    minimumPoints: 0,
    pointsMultiplier: 1.0,
    discountPercentage: 0,
    birthdayBonus: 50,
    description: "Entry level - Start earning rewards",
  },
  {
    tier: "SILVER",
    minimumPoints: 500,
    pointsMultiplier: 1.25,
    discountPercentage: 5,
    birthdayBonus: 100,
    description: "Silver members get 25% more points and 5% discount",
  },
  {
    tier: "GOLD",
    minimumPoints: 1500,
    pointsMultiplier: 1.5,
    discountPercentage: 10,
    birthdayBonus: 200,
    description: "Gold members get 50% more points and 10% discount",
  },
  {
    tier: "PLATINUM",
    minimumPoints: 3000,
    pointsMultiplier: 2.0,
    discountPercentage: 15,
    birthdayBonus: 500,
    description: "Platinum members get double points and 15% discount",
  },
];

async function seedLoyaltyTiers() {
  try {
    console.log("🎁 Seeding loyalty tier configuration...");

    for (const tier of LOYALTY_TIERS) {
      const result = await prisma.loyaltyTierConfig.upsert({
        where: { tier: tier.tier },
        update: tier,
        create: tier,
      });

      console.log(`✅ ${result.tier} tier configured`);
    }

    console.log("\n✨ Loyalty tier configuration seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding loyalty tiers:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedLoyaltyTiers()
    .then(() => {
      console.log("\n🎉 Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Seeding failed:", error);
      process.exit(1);
    });
}

module.exports = seedLoyaltyTiers;
