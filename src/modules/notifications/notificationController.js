import { sendSuccess } from "../../utils/response.js";
import { sendError } from "../../utils/response.js";
import {
  deleteNotificationService,
  getNotificationsService,
  markNotificationAsReadService,
} from "./notificationService.js";

// Get all notifications
export async function getAllNotifications(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getNotificationsService(page, limit);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to fetch notifications");
  }
}

// Mark notification as read
export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    await markNotificationAsReadService(id);
    sendSuccess(res, { success: true });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to mark notification as read");
  }
}

// Delete notification
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    await deleteNotificationService(id);
    sendSuccess(res, { success: true });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to delete notification");
  }
}
