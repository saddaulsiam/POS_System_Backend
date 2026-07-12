import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

/**
 * Log an audit event
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.action
 * @param {string} [params.entity]
 * @param {number} [params.entityId]
 * @param {string} [params.details]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */

export const logAudit = async ({ storeId, employeeId, action, entity, entityId, details, ipAddress, userAgent }) => {
  try {
    await prisma.auditLog.create({
      data: {
        storeId,
        employeeId,
        action,
        entity,
        entityId,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
};

export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (userId, role, storeId, extra = {}) => {
  return jwt.sign(
    { userId, role, storeId, ...extra },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    if (decoded.type !== "refresh") {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Generate a collision-resistant receipt ID.
 * Format: R-{base36 timestamp}-{8 random hex chars}
 * e.g.  R-LKH3F2A-4F9E1A2B
 * Collision probability: ~1 in 4 billion per millisecond.
 */
export const generateReceiptId = () => {
  const ts  = Date.now().toString(36).toUpperCase();      // base-36 timestamp
  const rnd = randomBytes(4).toString("hex").toUpperCase(); // 8 random hex chars
  return `R-${ts}-${rnd}`;
};

export const calculateTax = (amount, taxRate = 0) => {
  return amount * (taxRate / 100);
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const generatePONumber = () => {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(2).toString("hex").toUpperCase();
  return `PO-${ts}-${rnd}`;
};
