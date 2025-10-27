import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import * as parkedSalesController from "./parkedSalesController.js";
import { parkSaleValidator, parkedSaleIdParam } from "./parkedSalesValidator.js";

const router = express.Router();

router.use(authenticateToken);

router
  .route("/")
  .get(parkedSalesController.getAllParkedSales)
  .post(parkSaleValidator, parkedSalesController.parkSale);

router
  .route("/:id")
  .get(parkedSaleIdParam, parkedSalesController.getParkedSale)
  .delete(parkedSaleIdParam, parkedSalesController.deleteParkedSale);

router.delete("/cleanup/expired", parkedSalesController.cleanupExpiredParkedSales);

export const ParkedSalesRoutes = router;
