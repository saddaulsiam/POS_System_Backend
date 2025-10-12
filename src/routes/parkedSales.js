import express from "express";
import { parkSaleValidator, parkedSaleIdParam } from "../validators/parkedSalesValidator.js";
import * as parkedSalesController from "../controllers/parkedSalesController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

router.get("/", parkedSalesController.getAllParkedSales);

router.post("/", parkSaleValidator, parkedSalesController.parkSale);

router.get("/:id", parkedSaleIdParam, parkedSalesController.getParkedSale);

router.delete("/:id", parkedSaleIdParam, parkedSalesController.deleteParkedSale);

router.delete("/cleanup/expired", parkedSalesController.cleanupExpiredParkedSales);

export default router;
