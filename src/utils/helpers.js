// Audit log helper
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
const logAudit = async ({ userId, action, entity, entityId, details, ipAddress, userAgent }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
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
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (userId, role, storeId) => {
  return jwt.sign({ userId, role, storeId }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

export const generateReceiptId = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `R${timestamp.slice(-6)}${random}`;
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
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `PO${timestamp.slice(-6)}${random}`;
};

export { logAudit };
