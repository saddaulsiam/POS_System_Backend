const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all customers with pagination and search
router.get(
  "/",
  [
    authenticateToken,
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("search").optional().isString().withMessage("Search must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search;
      const skip = (page - 1) * limit;

      const where = { isActive: true };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { phoneNumber: { contains: search } },
          { email: { contains: search } },
        ];
      }

      let countWhere = { ...where };
      if (search) {
        countWhere = {
          ...countWhere,
          OR: [{ name: { contains: search } }, { phoneNumber: { contains: search } }, { email: { contains: search } }],
        };
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            _count: {
              select: { sales: true },
            },
          },
          orderBy: { name: "asc" },
          skip,
          take: limit,
        }),
        prisma.customer.count({ where: countWhere }),
      ]);

      res.json({
        data: customers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get customers error:", error);
      res.status(500).json({ error: "Failed to fetch customers", data: error });
    }
  }
);

// Get customer by phone number (for POS lookup)
router.get("/phone/:phone", authenticateToken, async (req, res) => {
  try {
    const { phone } = req.params;

    const customer = await prisma.customer.findFirst({
      where: {
        phoneNumber: phone,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        address: true,
        loyaltyPoints: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Get customer by phone error:", error);
    res.status(500).json({ error: "Failed to get customer" });
  }
});

// Search customers by phone number or name (for POS lookup)
router.get("/search/:query", authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { phoneNumber: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        loyaltyPoints: true,
      },
      orderBy: { name: "asc" },
      take: 10,
    });

    res.json(customers);
  } catch (error) {
    console.error("Search customers error:", error);
    res.status(500).json({ error: "Failed to search customers" });
  }
});

// Get customer by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId, isActive: true },
      include: {
        sales: {
          select: {
            id: true,
            receiptId: true,
            finalAmount: true,
            paymentMethod: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: { sales: true },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Calculate total spent
    const totalSpent = await prisma.sale.aggregate({
      where: {
        customerId: customerId,
        finalAmount: { gt: 0 },
      },
      _sum: {
        finalAmount: true,
      },
    });

    res.json({
      ...customer,
      totalSpent: totalSpent._sum.finalAmount || 0,
    });
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Create new customer
router.post(
  "/",
  [
    authenticateToken,
    body("name").notEmpty().trim().withMessage("Customer name is required"),
    body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("address").optional().isString().withMessage("Address must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, phoneNumber, email, address } = req.body;

      // Check for existing customer with same phone or email
      if (phoneNumber || email) {
        const existing = await prisma.customer.findFirst({
          where: {
            OR: [...(phoneNumber ? [{ phoneNumber }] : []), ...(email ? [{ email }] : [])],
          },
        });

        if (existing) {
          return res.status(400).json({
            error: "Customer with this phone number or email already exists",
          });
        }
      }

      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          phoneNumber,
          email,
          address,
        },
        include: {
          _count: {
            select: { sales: true },
          },
        },
      });

      res.status(201).json(customer);
    } catch (error) {
      console.error("Create customer error:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  }
);

// Update customer
router.put(
  "/:id",
  [
    authenticateToken,
    body("name").optional().notEmpty().trim().withMessage("Customer name cannot be empty"),
    body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("address").optional().isString().withMessage("Address must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const customerId = parseInt(id);

      const existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!existingCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Check for conflicts with phone or email if they're being updated
      if (req.body.phoneNumber || req.body.email) {
        const conflicts = await prisma.customer.findFirst({
          where: {
            AND: [
              { id: { not: customerId } },
              {
                OR: [
                  ...(req.body.phoneNumber ? [{ phoneNumber: req.body.phoneNumber }] : []),
                  ...(req.body.email ? [{ email: req.body.email }] : []),
                ],
              },
            ],
          },
        });

        if (conflicts) {
          return res.status(400).json({
            error: "Another customer with this phone number or email already exists",
          });
        }
      }

      const updateData = { ...req.body };
      if (updateData.name) {
        updateData.name = updateData.name.trim();
      }

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
        include: {
          _count: {
            select: { sales: true },
          },
        },
      });

      res.json(customer);
    } catch (error) {
      console.error("Update customer error:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  }
);

// Deactivate customer (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    res.json({ message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ error: "Failed to deactivate customer" });
  }
});

// Add loyalty points
router.post(
  "/:id/loyalty",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("points").isInt({ min: 1 }).withMessage("Points must be a positive integer"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { points, reason } = req.body;
      const customerId = parseInt(id);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId, isActive: true },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: points } },
      });

      res.json({
        message: `Added ${points} loyalty points`,
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          loyaltyPoints: updatedCustomer.loyaltyPoints,
        },
      });
    } catch (error) {
      console.error("Add loyalty points error:", error);
      res.status(500).json({ error: "Failed to add loyalty points" });
    }
  }
);

// Redeem loyalty points
router.post(
  "/:id/redeem",
  [authenticateToken, body("points").isInt({ min: 1 }).withMessage("Points must be a positive integer")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { points } = req.body;
      const customerId = parseInt(id);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId, isActive: true },
      });

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      if (customer.loyaltyPoints < points) {
        return res.status(400).json({
          error: "Insufficient loyalty points",
          availablePoints: customer.loyaltyPoints,
          requestedPoints: points,
        });
      }

      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { decrement: points } },
      });

      // Calculate discount amount (assuming 1 point = $0.01)
      const discountAmount = points * 0.01;

      res.json({
        message: `Redeemed ${points} loyalty points`,
        discountAmount,
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          loyaltyPoints: updatedCustomer.loyaltyPoints,
        },
      });
    } catch (error) {
      console.error("Redeem loyalty points error:", error);
      res.status(500).json({ error: "Failed to redeem loyalty points" });
    }
  }
);

module.exports = router;
