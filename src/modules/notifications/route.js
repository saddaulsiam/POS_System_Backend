import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { deleteNotification, getAllNotifications, markNotificationAsRead } from "./notificationController.js";

const router = express.Router();

router.use(authenticateToken);

// Get all notifications
router.get("/", getAllNotifications);

// Delete notification
router.delete("/:id", deleteNotification);

// Mark notification as read
router.post("/:id/read", markNotificationAsRead);

export const NotificationRoutes = router;
