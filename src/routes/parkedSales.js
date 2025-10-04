const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all parked sales for current employee
router.get("/", [authenticateToken], async (req, res) => {
  try {
    const employeeId = req.user.id;

    const parkedSales = await prisma.parkedSale.findMany({
      where: { employeeId },
      include: {
        customer: true,
        employee: true,
      },
      orderBy: { parkedAt: "desc" },
    });

    // Parse items JSON
    const parsedSales = parkedSales.map((sale) => ({
      ...sale,
      items: JSON.parse(sale.items),
    }));

    res.json(parsedSales);
  } catch (error) {
    console.error("Get parked sales error:", error);
    res.status(500).json({ error: "Failed to fetch parked sales" });
  }
});

// Park a sale (hold transaction)
router.post(
  "/",
  [
    authenticateToken,
    body("items").isArray().withMessage("Items must be an array"),
    body("subtotal").isFloat({ min: 0 }).withMessage("Subtotal must be >= 0"),
    body("taxAmount").optional().isFloat({ min: 0 }),
    body("discountAmount").optional().isFloat({ min: 0 }),
    body("customerId").optional().isInt(),
    body("notes").optional().isString(),
    body("expiresAt").optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { items, subtotal, taxAmount, discountAmount, customerId, notes, expiresAt } = req.body;
      const employeeId = req.user.id;

      // Convert items array to JSON string
      const itemsJSON = JSON.stringify(items);

      const parkedSale = await prisma.parkedSale.create({
        data: {
          employeeId,
          customerId,
          items: itemsJSON,
          subtotal,
          taxAmount: taxAmount || 0,
          discountAmount: discountAmount || 0,
          notes,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: {
          customer: true,
          employee: true,
        },
      });

      // Parse items for response
      const response = {
        ...parkedSale,
        items: JSON.parse(parkedSale.items),
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Park sale error:", error);
      res.status(500).json({ error: "Failed to park sale" });
    }
  }
);

// Get a specific parked sale
router.get("/:id", [authenticateToken, param("id").isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const employeeId = req.user.id;

    const parkedSale = await prisma.parkedSale.findFirst({
      where: {
        id,
        employeeId, // Only allow employee to retrieve their own parked sales
      },
      include: {
        customer: true,
        employee: true,
      },
    });

    if (!parkedSale) {
      return res.status(404).json({ error: "Parked sale not found" });
    }

    // Parse items JSON
    const response = {
      ...parkedSale,
      items: JSON.parse(parkedSale.items),
    };

    res.json(response);
  } catch (error) {
    console.error("Get parked sale error:", error);
    res.status(500).json({ error: "Failed to fetch parked sale" });
  }
});

// Delete/resume a parked sale
router.delete("/:id", [authenticateToken, param("id").isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = parseInt(req.params.id);
    const employeeId = req.user.id;

    // Verify ownership
    const parkedSale = await prisma.parkedSale.findFirst({
      where: { id, employeeId },
    });

    if (!parkedSale) {
      return res.status(404).json({ error: "Parked sale not found" });
    }

    await prisma.parkedSale.delete({
      where: { id },
    });

    res.json({ message: "Parked sale deleted successfully" });
  } catch (error) {
    console.error("Delete parked sale error:", error);
    res.status(500).json({ error: "Failed to delete parked sale" });
  }
});

// Clear expired parked sales (cron job endpoint)
router.delete("/cleanup/expired", [authenticateToken], async (req, res) => {
  try {
    const now = new Date();

    const result = await prisma.parkedSale.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    res.json({ message: `Deleted ${result.count} expired parked sales` });
  } catch (error) {
    console.error("Cleanup expired sales error:", error);
    res.status(500).json({ error: "Failed to cleanup expired sales" });
  }
});

module.exports = router;
