import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import customerValidators from "./customerValidators.js";

const router = express.Router();

import {
  addLoyaltyPoints,
  createCustomer,
  deactivateCustomer,
  getCustomerById,
  getCustomerByPhone,
  getCustomers,
  redeemLoyaltyPoints,
  searchCustomersController,
  updateCustomer,
} from "./customersController.js";

// Get all customers with pagination and search
router.get("/", [authenticateToken, ...customerValidators.list], getCustomers);

// Get customer by phone number (for POS lookup)
router.get("/phone/:phone", authenticateToken, getCustomerByPhone);

// Search customers by phone number or name (for POS lookup)
router.get("/search/:query", authenticateToken, searchCustomersController);

// Get customer by ID
router.get("/:id", authenticateToken, getCustomerById);

// Create new customer
router.post("/", [authenticateToken, ...customerValidators.create], createCustomer);

// Update customer
router.put("/:id", [authenticateToken, ...customerValidators.update], updateCustomer);

// Deactivate customer (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], deactivateCustomer);

// Add loyalty points
router.post(
  "/:id/loyalty",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...customerValidators.addLoyalty],
  addLoyaltyPoints
);

// Redeem loyalty points
router.post("/:id/redeem", [authenticateToken, ...customerValidators.redeemLoyalty], redeemLoyaltyPoints);

export const CustomerRoutes = router;
