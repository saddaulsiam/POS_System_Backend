import express from "express";
import { deleteNotification, getAllNotifications, markNotificationAsRead } from "./notificationController.js";
// import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// router.use(authenticateToken);

// Get all notifications
router.get("/", getAllNotifications);

// Mark notification as read
router.post("/:id/read", markNotificationAsRead);

// Delete notification
router.delete("/:id", deleteNotification);

export const NotificationRoutes = router;
