import { sendError, sendSuccess } from "../../utils/response.js";
import * as sslcommerzService from "./sslcommerzService.js";

/**
 * Initiate SSL Commerz Payment
 */
export async function initiatePayment(req, res) {
  try {
    const { id: userId, storeId } = req.user;
    const { plan, amount, customerName, customerEmail, customerPhone } = req.body;

    // Validate required fields
    if (!plan || !amount || !customerName || !customerEmail || !customerPhone) {
      return sendError(res, 400, "Missing required payment information");
    }

    const result = await sslcommerzService.initiatePayment({
      storeId,
      userId,
      plan,
      amount,
      customerName,
      customerEmail,
      customerPhone,
    });

    if (!result.success) {
      return sendError(res, 400, result.error);
    }

    return sendSuccess(
      res,
      {
        gatewayUrl: result.gatewayUrl,
        transactionId: result.transactionId,
        paymentId: result.paymentId,
      },
      200
    );
  } catch (error) {
    console.error("Payment initiation error:", error);
    return sendError(res, 500, "Failed to initiate payment");
  }
}

/**
 * Handle SSL Commerz Success Callback
 */
export async function handleSuccess(req, res) {
  try {
    const paymentData = req.body;
    const result = await sslcommerzService.handlePaymentSuccess(paymentData);

    if (!result.success) {
      // Redirect to frontend failure page
      return res.redirect(
        `${process.env.FRONTEND_URL}/subscription?status=failed&message=${encodeURIComponent(result.error)}`
      );
    }

    // Redirect to frontend success page
    return res.redirect(`${process.env.FRONTEND_URL}/subscription?status=success&transaction=${paymentData.tran_id}`);
  } catch (error) {
    console.error("Payment success callback error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/subscription?status=error&message=Payment%20processing%20failed`);
  }
}

/**
 * Handle SSL Commerz Failure Callback
 */
export async function handleFailure(req, res) {
  try {
    const { tran_id, error } = req.body;
    await sslcommerzService.handlePaymentFailure(tran_id, error);

    return res.redirect(
      `${process.env.FRONTEND_URL}/subscription?status=failed&message=${encodeURIComponent(error || "Payment failed")}`
    );
  } catch (error) {
    console.error("Payment failure callback error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/subscription?status=error&message=Payment%20processing%20failed`);
  }
}

/**
 * Handle SSL Commerz Cancel Callback
 */
export async function handleCancel(req, res) {
  try {
    const { tran_id } = req.body;
    await sslcommerzService.handlePaymentCancellation(tran_id);

    return res.redirect(`${process.env.FRONTEND_URL}/subscription?status=cancelled&message=Payment%20cancelled`);
  } catch (error) {
    console.error("Payment cancellation callback error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/subscription?status=error&message=Payment%20processing%20failed`);
  }
}

/**
 * Handle SSL Commerz IPN (Instant Payment Notification)
 */
export async function handleIPN(req, res) {
  try {
    const paymentData = req.body;

    // Validate payment
    const validation = await sslcommerzService.validatePayment(paymentData.tran_id);

    if (validation.success && validation.data?.status === "VALID") {
      await sslcommerzService.handlePaymentSuccess(paymentData);
      return res.status(200).send("IPN processed successfully");
    }

    return res.status(400).send("Invalid payment");
  } catch (error) {
    console.error("IPN handling error:", error);
    return res.status(500).send("IPN processing failed");
  }
}
