import express from "express";
import * as sslcommerzController from "./sslcommerzController.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// Initiate payment (requires authentication)
router.post("/initiate", authenticateToken, sslcommerzController.initiatePayment);

// SSL Commerz callbacks (no authentication required - called by SSL Commerz)
router.post("/success", sslcommerzController.handleSuccess);
router.post("/fail", sslcommerzController.handleFailure);
router.post("/cancel", sslcommerzController.handleCancel);
router.post("/ipn", sslcommerzController.handleIPN);

export const sslcommerzRoutes = router;
