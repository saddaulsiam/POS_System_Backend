const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Update current user's profile (name, username)
router.put(
  "/me",
  [
    authenticateToken,
    body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
    body("username").optional().notEmpty().trim().withMessage("Username cannot be empty"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const userId = req.user.id;
      const { name, username } = req.body;
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (username) updateData.username = username.trim();
      // Check for username conflict
      if (username) {
        const conflict = await prisma.employee.findFirst({
          where: { username: username.trim(), id: { not: userId } },
        });
        if (conflict) {
          return res.status(400).json({ error: "Username already taken by another user" });
        }
      }
      const updated = await prisma.employee.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, name: true, username: true, role: true, isActive: true, updatedAt: true },
      });
      res.json(updated);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  }
);

module.exports = router;
