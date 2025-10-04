const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles, optionalAuth } = require("../middleware/auth");

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

// Get loyalty tier configuration (Public - no auth required for reading)
router.get("/tiers", async (req, res) => {
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
router.post("/birthday-rewards", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
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

// Get loyalty offers (Public - shows only active offers; Admin sees all)
router.get("/offers", [optionalAuth], async (req, res) => {
  try {
    const now = new Date();

    // Check if user is authenticated and is admin/manager
    const isAdmin = req.user && (req.user.role === "ADMIN" || req.user.role === "MANAGER");

    let offers;
    if (isAdmin) {
      // Admin/Manager sees ALL offers
      offers = await prisma.loyaltyOffer.findMany({
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Public/Regular users see only active, current offers
      offers = await prisma.loyaltyOffer.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    res.json(offers);
  } catch (error) {
    console.error("Get offers error:", error);
    res.status(500).json({ error: "Failed to fetch loyalty offers" });
  }
});

// Create loyalty offer (Admin/Manager)
router.post(
  "/offers",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
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
  authenticateToken,
  authorizeRoles("ADMIN"),
  param("customerId").isInt(),
  body("tier").isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).withMessage("Invalid tier"),
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

// Get customer's complete loyalty status
router.get(
  "/customers/:customerId/loyalty-status",
  [authenticateToken, param("customerId").isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const customerId = parseInt(req.params.customerId);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          pointsTransactions: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          loyaltyRewards: {
            where: {
              OR: [{ redeemedAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Calculate lifetime points
      const lifetimePoints = await prisma.pointsTransaction.aggregate({
        where: {
          customerId,
          type: "EARNED",
        },
        _sum: {
          points: true,
        },
      });

      // Get tier configuration
      const tierConfig = LOYALTY_TIERS[customer.loyaltyTier] || LOYALTY_TIERS.BRONZE;

      // Calculate next tier
      const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
      const currentIndex = tierOrder.indexOf(customer.loyaltyTier);
      const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
      const nextTierConfig = nextTier ? LOYALTY_TIERS[nextTier] : null;

      // Get available offers
      const now = new Date();
      const availableOffers = await prisma.loyaltyOffer.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          OR: [
            { requiredTier: customer.loyaltyTier },
            { requiredTier: "BRONZE" }, // Everyone can access bronze offers
          ],
        },
      });

      res.json({
        customer: {
          id: customer.id,
          name: customer.name,
          tier: customer.loyaltyTier,
          points: customer.loyaltyPoints,
          dateOfBirth: customer.dateOfBirth,
        },
        points: {
          current: customer.loyaltyPoints,
          lifetime: lifetimePoints._sum.points || 0,
        },
        tier: {
          current: customer.loyaltyTier,
          multiplier: tierConfig.multiplier,
          discountPercentage: tierConfig.discount,
          birthdayBonus: tierConfig.birthdayBonus,
          next: nextTier
            ? {
                tier: nextTier,
                minimumPoints: nextTierConfig.min,
                pointsNeeded: nextTierConfig.min - (lifetimePoints._sum.points || 0),
              }
            : null,
        },
        recentTransactions: customer.pointsTransactions,
        activeRewards: customer.loyaltyRewards,
        availableOffers,
      });
    } catch (error) {
      console.error("Get loyalty status error:", error);
      res.status(500).json({ error: "Failed to fetch loyalty status" });
    }
  }
);

// Update loyalty offer (Admin/Manager)
router.put(
  "/offers/:offerId",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  param("offerId").isInt(),
  body("title").optional().notEmpty(),
  body("description").optional().notEmpty(),
  body("offerType").optional().isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "BUY_X_GET_Y", "POINTS_MULTIPLIER"]),
  body("discountValue").optional().isFloat({ min: 0 }),
  body("minimumPurchase").optional().isFloat({ min: 0 }),
  body("requiredTier").optional().isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  body("startDate").optional().isISO8601(),
  body("endDate").optional().isISO8601(),
  body("isActive").optional().isBoolean(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const offerId = parseInt(req.params.offerId);
      const updateData = {};

      // Only include fields that were provided
      const allowedFields = [
        "title",
        "description",
        "offerType",
        "discountValue",
        "minimumPurchase",
        "requiredTier",
        "startDate",
        "endDate",
        "isActive",
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === "startDate" || field === "endDate") {
            updateData[field] = new Date(req.body[field]);
          } else {
            updateData[field] = req.body[field];
          }
        }
      });

      const offer = await prisma.loyaltyOffer.update({
        where: { id: offerId },
        data: updateData,
      });

      res.json(offer);
    } catch (error) {
      console.error("Update offer error:", error);
      res.status(500).json({ error: "Failed to update loyalty offer" });
    }
  }
);

// Delete loyalty offer (Admin only)
router.delete(
  "/offers/:offerId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  param("offerId").isInt(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const offerId = parseInt(req.params.offerId);

      await prisma.loyaltyOffer.delete({
        where: { id: offerId },
      });

      res.json({ message: "Loyalty offer deleted successfully" });
    } catch (error) {
      console.error("Delete offer error:", error);
      res.status(500).json({ error: "Failed to delete loyalty offer" });
    }
  }
);

// Manage loyalty tier configuration (Admin only)
router.post(
  "/tiers/config",
  authenticateToken,
  authorizeRoles("ADMIN"),
  body("tier").isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).withMessage("Invalid tier"),
  body("minimumPoints").isInt({ min: 0 }).withMessage("Minimum points must be non-negative"),
  body("pointsMultiplier").isFloat({ min: 1.0 }).withMessage("Points multiplier must be at least 1.0"),
  body("discountPercentage").isFloat({ min: 0, max: 100 }).withMessage("Discount percentage must be between 0 and 100"),
  body("birthdayBonus").isInt({ min: 0 }).withMessage("Birthday bonus must be non-negative"),
  body("description").optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier, minimumPoints, pointsMultiplier, discountPercentage, birthdayBonus, description } = req.body;

      const tierConfig = await prisma.loyaltyTierConfig.upsert({
        where: { tier },
        update: {
          minimumPoints,
          pointsMultiplier,
          discountPercentage,
          birthdayBonus,
          description,
        },
        create: {
          tier,
          minimumPoints,
          pointsMultiplier,
          discountPercentage,
          birthdayBonus,
          description,
        },
      });

      res.json(tierConfig);
    } catch (error) {
      console.error("Manage tier config error:", error);
      res.status(500).json({ error: "Failed to manage tier configuration" });
    }
  }
);

// Get loyalty program statistics (Admin/Manager only)
router.get("/statistics", authenticateToken, authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    // Debug logging
    console.log("📊 Statistics endpoint accessed by:", {
      userId: req.user?.id,
      username: req.user?.username,
      role: req.user?.role,
      name: req.user?.name,
    });

    // Total customers by tier
    const customersByTier = await prisma.customer.groupBy({
      by: ["loyaltyTier"],
      where: { isActive: true },
      _count: true,
    });

    // Total points issued
    const totalPointsIssued = await prisma.pointsTransaction.aggregate({
      where: { type: "EARNED" },
      _sum: { points: true },
    });

    // Total points redeemed
    const totalPointsRedeemed = await prisma.pointsTransaction.aggregate({
      where: { type: "REDEEMED" },
      _sum: { points: true },
    });

    // Active offers
    const now = new Date();
    const activeOffersCount = await prisma.loyaltyOffer.count({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    // Recent redemptions
    const recentRedemptions = await prisma.loyaltyReward.findMany({
      where: { redeemedAt: { not: null } },
      include: {
        customer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { redeemedAt: "desc" },
      take: 10,
    });

    // Top customers by points
    const topCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { loyaltyPoints: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    // Format customers by tier correctly
    const tierDistribution = {};
    const allTiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

    // Initialize all tiers with 0
    allTiers.forEach((tier) => {
      tierDistribution[tier] = 0;
    });

    // Fill in actual counts
    customersByTier.forEach((item) => {
      tierDistribution[item.loyaltyTier] = item._count.loyaltyTier || item._count._all || 0;
    });

    res.json({
      customersByTier: tierDistribution,
      pointsIssued: Math.abs(totalPointsIssued._sum.points || 0),
      pointsRedeemed: Math.abs(totalPointsRedeemed._sum.points || 0),
      activeOffers: activeOffersCount,
      recentRedemptions,
      topCustomers,
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({ error: "Failed to fetch loyalty statistics" });
  }
});

module.exports = router;
