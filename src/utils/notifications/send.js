import { Notification } from "../../models/notificationModel.js";

export async function sendNotification({ user, type, title, message = "", data = {} }) {
  try {
    await Notification.create({ user, type, title, message, data });
  } catch (e) {
    // best-effort notification; do not throw
  }
}


