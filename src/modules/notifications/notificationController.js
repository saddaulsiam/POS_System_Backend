import {
  deleteNotificationService,
  getNotificationsService,
  markNotificationAsReadService,
} from "./notificationService.js";

// Get all notifications
export async function getAllNotifications(req, res) {
  try {
    const notifications = await getNotificationsService();
    res.json({ data: notifications });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch notifications" });
  }
}

// Mark notification as read
export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    await markNotificationAsReadService(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to mark notification as read" });
  }
}

// Delete notification
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    await deleteNotificationService(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete notification" });
  }
}
