const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { hashPassword, comparePassword, generateToken, logAudit } = require("../utils/helpers");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Login with PIN
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("pinCode").isLength({ min: 4, max: 6 }).withMessage("PIN must be 4-6 digits"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, pinCode } = req.body;

      const employee = await prisma.employee.findUnique({
        where: { username },
      });

      if (!employee || !employee.isActive) {
        return res.status(401).json({ error: "Invalid credentials or inactive account" });
      }

      const isValidPin = await comparePassword(pinCode, employee.pinCode);
      if (!isValidPin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(employee.id, employee.role);

      // Log audit event for login
      await logAudit({
        userId: employee.id,
        action: "LOGIN",
        entity: "Employee",
        entityId: employee.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "",
      });

      res.json({
        token,
        user: {
          id: employee.id,
          name: employee.name,
          username: employee.username,
          role: employee.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  }
);

// Get current user info
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    if (!employee) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(employee);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// Change PIN
router.put(
  "/change-pin",
  [
    authenticateToken,
    body("currentPin").isLength({ min: 4, max: 6 }).withMessage("Current PIN must be 4-6 digits"),
    body("newPin").isLength({ min: 4, max: 6 }).withMessage("New PIN must be 4-6 digits"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPin, newPin } = req.body;
      const userId = req.user.id;

      const employee = await prisma.employee.findUnique({
        where: { id: userId },
      });

      if (!employee) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidCurrentPin = await comparePassword(currentPin, employee.pinCode);
      if (!isValidCurrentPin) {
        return res.status(401).json({ error: "Current PIN is incorrect" });
      }

      const hashedNewPin = await hashPassword(newPin);

      await prisma.employee.update({
        where: { id: userId },
        data: { pinCode: hashedNewPin },
      });

      res.json({ message: "PIN changed successfully" });
    } catch (error) {
      console.error("Change PIN error:", error);
      res.status(500).json({ error: "Failed to change PIN" });
    }
  }
);

module.exports = router;
