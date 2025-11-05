import { Notification } from "../../models/notificationModel.js";

export async function sendNotification({
  user,
  type,
  title,
  message = "",
  data = {},
}) {
  try {
    console.log("Creating notification for user:", user, "type:", type);
    const notification = await Notification.create({ user, type, title, message, data });
    console.log("Notification created successfully:", notification._id);
    return notification;
  } catch (e) {
    console.error("Failed to create notification:", e);
    // best-effort notification; do not throw
    return null;
  }
}
