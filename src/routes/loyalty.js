const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Loyalty tier configuration (can be moved to database)
// Updated: Added redeem-points endpoint for POS integration
const LOYALTY_TIERS = {
  BRONZE: { min: 0, multiplier: 1.0, discount: 0, birthdayBonus: 50 },
  SILVER: { min: 500, multiplier: 1.25, discount: 5, birthdayBonus: 100 },
  GOLD: { min: 1500, multiplier: 1.5, discount: 10, birthdayBonus: 200 },
  PLATINUM: { min: 3000, multiplier: 2.0, discount: 15, birthdayBonus: 500 },
};

// Calculate tier based on points
const calculateTier = (points) => {
  if (points >= LOYALTY_TIERS.PLATINUM.min) return "PLATINUM";
  if (points >= LOYALTY_TIERS.GOLD.min) return "GOLD";
  if (points >= LOYALTY_TIERS.SILVER.min) return "SILVER";
  return "BRONZE";
};

// Get loyalty tier configuration
router.get("/tiers", [authenticateToken], async (req, res) => {
  try {
    const tiers = await prisma.loyaltyTierConfig.findMany({
      orderBy: { minimumPoints: "asc" },
    });

    // If no tiers in database, return default
    if (tiers.length === 0) {
      return res.json(
        Object.entries(LOYALTY_TIERS).map(([tier, config]) => ({
          tier,
          minimumPoints: config.min,
          pointsMultiplier: config.multiplier,
          discountPercentage: config.discount,
          birthdayBonus: config.birthdayBonus,
        }))
      );
    }

    res.json(tiers);
  } catch (error) {
    console.error("Get loyalty tiers error:", error);
    res.status(500).json({ error: "Failed to fetch loyalty tiers" });
  }
});

// Get customer's points history
router.get(
  "/customers/:customerId/points-history",
  [authenticateToken, param("customerId").isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const customerId = parseInt(req.params.customerId);

      const transactions = await prisma.pointsTransaction.findMany({
        where: { customerId },
        include: {
          sale: {
            select: {
              receiptId: true,
              finalAmount: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(transactions);
    } catch (error) {
      console.error("Get points history error:", error);
      res.status(500).json({ error: "Failed to fetch points history" });
    }
  }
);

// Redeem points for reward
router.post(
  "/redeem",
  [
    authenticateToken,
    body("customerId").isInt().withMessage("Customer ID is required"),
    body("pointsCost").isInt({ min: 1 }).withMessage("Points cost must be positive"),
    body("rewardType")
      .isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "FREE_PRODUCT", "POINTS_MULTIPLIER"])
      .withMessage("Invalid reward type"),
    body("rewardValue").isFloat({ min: 0 }).withMessage("Reward value is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, pointsCost, rewardType, rewardValue, description } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // Get customer
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        // Check if customer has enough points
        if (customer.loyaltyPoints < pointsCost) {
          throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${pointsCost}`);
        }

        // Deduct points
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { decrement: pointsCost } },
        });

        // Create points transaction
        await tx.pointsTransaction.create({
          data: {
            customerId,
            type: "REDEEMED",
            points: -pointsCost,
            description: `Redeemed: ${description}`,
          },
        });

        // Create loyalty reward
        const reward = await tx.loyaltyReward.create({
          data: {
            customerId,
            rewardType,
            rewardValue,
            pointsCost,
            description,
            redeemedAt: new Date(),
          },
        });

        return {
          reward,
          newBalance: customer.loyaltyPoints - pointsCost,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Redeem points error:", error);
      res.status(500).json({ error: error.message || "Failed to redeem points" });
    }
  }
);

// Redeem points (simplified endpoint for POS)
router.post(
  "/redeem-points",
  [
    authenticateToken,
    body("customerId").isInt().withMessage("Customer ID is required"),
    body("points").isInt({ min: 1 }).withMessage("Points must be positive"),
    body("rewardType")
      .isIn(["DISCOUNT", "FREE_PRODUCT", "STORE_CREDIT", "SPECIAL_OFFER"])
      .withMessage("Invalid reward type"),
    body("rewardValue").isNumeric().withMessage("Reward value is required"),
    body("description").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, points, rewardType, rewardValue, description } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // Get customer
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        // Check if customer has enough points
        if (customer.loyaltyPoints < points) {
          throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${points}`);
        }

        // Deduct points from customer
        const updatedCustomer = await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { decrement: points } },
        });

        // Create points transaction
        await tx.pointsTransaction.create({
          data: {
            customerId,
            type: "REDEEMED",
            points: -points,
            description: description || `Redeemed ${points} points for ${rewardType}`,
          },
        });

        // Map reward type to database enum
        let dbRewardType = "DISCOUNT_FIXED";
        if (rewardType === "DISCOUNT") {
          dbRewardType = "DISCOUNT_FIXED";
        } else if (rewardType === "FREE_PRODUCT") {
          dbRewardType = "FREE_PRODUCT";
        } else if (rewardType === "STORE_CREDIT" || rewardType === "SPECIAL_OFFER") {
          dbRewardType = "DISCOUNT_FIXED";
        }

        // Create loyalty reward record
        const reward = await tx.loyaltyReward.create({
          data: {
            customerId,
            rewardType: dbRewardType,
            rewardValue: parseFloat(rewardValue),
            pointsCost: points,
            description: description || `${rewardType} reward`,
            redeemedAt: new Date(),
            isActive: false, // Already used/redeemed
          },
        });

        return {
          success: true,
          reward,
          newBalance: updatedCustomer.loyaltyPoints,
          pointsRedeemed: points,
          discountAmount: parseFloat(rewardValue),
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Redeem points error:", error);
      res.status(500).json({ error: error.message || "Failed to redeem points" });
    }
  }
);

// Get customer's active rewards
router.get("/customers/:customerId/rewards", [authenticateToken, param("customerId").isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customerId = parseInt(req.params.customerId);

    const rewards = await prisma.loyaltyReward.findMany({
      where: {
        customerId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(rewards);
  } catch (error) {
    console.error("Get rewards error:", error);
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});

// Award points for sale (called after sale creation)
router.post(
  "/award-points",
  [
    authenticateToken,
    body("customerId").isInt().withMessage("Customer ID is required"),
    body("saleId").isInt().withMessage("Sale ID is required"),
    body("amount").isFloat({ min: 0 }).withMessage("Amount must be positive"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, saleId, amount } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        // Get tier configuration
        const tierConfig = LOYALTY_TIERS[customer.loyaltyTier] || LOYALTY_TIERS.BRONZE;

        // Calculate points (1 point per $10 spent, with tier multiplier)
        const basePoints = Math.floor(amount / 10);
        const bonusPoints = Math.floor(basePoints * (tierConfig.multiplier - 1));
        const totalPoints = basePoints + bonusPoints;

        // Update customer points
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { increment: totalPoints } },
        });

        // Create points transaction
        const transaction = await tx.pointsTransaction.create({
          data: {
            customerId,
            saleId,
            type: "EARNED",
            points: totalPoints,
            description: `Earned ${basePoints} base points${
              bonusPoints > 0 ? ` + ${bonusPoints} tier bonus (${customer.loyaltyTier})` : ""
            }`,
          },
        });

        // Check if tier should be upgraded
        const newTier = calculateTier(customer.loyaltyPoints + totalPoints);
        if (newTier !== customer.loyaltyTier) {
          await tx.customer.update({
            where: { id: customerId },
            data: { loyaltyTier: newTier },
          });
        }

        return {
          transaction,
          pointsAwarded: totalPoints,
          newBalance: customer.loyaltyPoints + totalPoints,
          newTier,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Award points error:", error);
      res.status(500).json({ error: error.message || "Failed to award points" });
    }
  }
);

// Check birthday rewards (should be called daily via cron)
router.post("/birthday-rewards", [authenticateToken, authorizeRoles(["ADMIN"])], async (req, res) => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Find customers with birthdays today
    const customers = await prisma.$queryRaw`
      SELECT * FROM Customer 
      WHERE isActive = 1 
      AND dateOfBirth IS NOT NULL
      AND CAST(strftime('%m', dateOfBirth) AS INTEGER) = ${todayMonth}
      AND CAST(strftime('%d', dateOfBirth) AS INTEGER) = ${todayDay}
    `;

    const results = [];

    for (const customer of customers) {
      const tierConfig = LOYALTY_TIERS[customer.loyaltyTier] || LOYALTY_TIERS.BRONZE;
      const birthdayBonus = tierConfig.birthdayBonus;

      // Award birthday points
      await prisma.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: birthdayBonus } },
      });

      // Create points transaction
      await prisma.pointsTransaction.create({
        data: {
          customerId: customer.id,
          type: "BIRTHDAY_BONUS",
          points: birthdayBonus,
          description: `Birthday bonus - ${customer.loyaltyTier} tier`,
        },
      });

      results.push({
        customerId: customer.id,
        name: customer.name,
        bonus: birthdayBonus,
      });
    }

    res.json({
      message: `Awarded birthday bonuses to ${results.length} customers`,
      customers: results,
    });
  } catch (error) {
    console.error("Birthday rewards error:", error);
    res.status(500).json({ error: "Failed to process birthday rewards" });
  }
});

// Get active loyalty offers
router.get("/offers", [authenticateToken], async (req, res) => {
  try {
    const now = new Date();

    const offers = await prisma.loyaltyOffer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(offers);
  } catch (error) {
    console.error("Get offers error:", error);
    res.status(500).json({ error: "Failed to fetch loyalty offers" });
  }
});

// Create loyalty offer (Admin/Manager)
router.post(
  "/offers",
  [
    authenticateToken,
    authorizeRoles(["ADMIN", "MANAGER"]),
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("offerType")
      .isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "BUY_X_GET_Y", "POINTS_MULTIPLIER"])
      .withMessage("Invalid offer type"),
    body("discountValue").optional().isFloat({ min: 0 }),
    body("minimumPurchase").optional().isFloat({ min: 0 }),
    body("requiredTier").optional().isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
    body("startDate").isISO8601().withMessage("Valid start date required"),
    body("endDate").isISO8601().withMessage("Valid end date required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, offerType, discountValue, minimumPurchase, requiredTier, startDate, endDate } =
        req.body;

      const offer = await prisma.loyaltyOffer.create({
        data: {
          title,
          description,
          offerType,
          discountValue,
          minimumPurchase: minimumPurchase || 0,
          requiredTier: requiredTier || "BRONZE",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });

      res.status(201).json(offer);
    } catch (error) {
      console.error("Create offer error:", error);
      res.status(500).json({ error: "Failed to create loyalty offer" });
    }
  }
);

// Update customer tier manually (Admin only)
router.put(
  "/customers/:customerId/tier",
  [
    authenticateToken,
    authorizeRoles(["ADMIN"]),
    param("customerId").isInt(),
    body("tier").isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).withMessage("Invalid tier"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const customerId = parseInt(req.params.customerId);
      const { tier } = req.body;

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyTier: tier },
      });

      res.json(customer);
    } catch (error) {
      console.error("Update tier error:", error);
      res.status(500).json({ error: "Failed to update customer tier" });
    }
  }
);

module.exports = router;
// trigger reload
