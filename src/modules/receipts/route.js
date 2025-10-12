import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import * as receiptsController from "./receiptsController.js";

const router = express.Router();

router.get("/:saleId/pdf", authenticateToken, receiptsController.getPDFReceipt);

router.get("/:saleId/html", authenticateToken, receiptsController.getHTMLReceipt);

router.get("/:saleId/thermal", authenticateToken, receiptsController.getThermalReceipt);

router.post("/resend/:saleId", authenticateToken, receiptsController.resendReceipt);

router.get("/:saleId/preview", authenticateToken, receiptsController.getReceiptPreview);

router.post("/print-thermal", authenticateToken, receiptsController.printThermalReceipt);

export default router;
