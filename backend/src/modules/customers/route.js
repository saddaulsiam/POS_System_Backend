import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import customerValidators from "./customerValidators.js";
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

const router = express.Router();

router
  .route("/")
  .post([authenticateToken, ...customerValidators.create], createCustomer)
  .get([authenticateToken, ...customerValidators.list], getCustomers);

router
  .route("/:id")
  .get(authenticateToken, getCustomerById)
  .put([authenticateToken, ...customerValidators.update], updateCustomer)
  .delete([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], deactivateCustomer);

// Add loyalty points
router.post(
  "/:id/loyalty",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...customerValidators.addLoyalty],
  addLoyaltyPoints
);

// Redeem loyalty points
router.post("/:id/redeem", [authenticateToken, ...customerValidators.redeemLoyalty], redeemLoyaltyPoints);

// Get customer by phone number (for POS lookup)
router.get("/phone/:phone", authenticateToken, getCustomerByPhone);

// Search customers by phone number or name (for POS lookup)
router.get("/search/:query", authenticateToken, searchCustomersController);

export const CustomerRoutes = router;
