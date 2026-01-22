import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
} from "../controllers/notificationController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all notification routes
router.use(ensureDbConnection);

// Get user's notifications
router.get("/", isAuthenticated, getMyNotifications);

// Get unread notification count
router.get("/unread-count", isAuthenticated, getUnreadCount);

// Mark a specific notification as read
router.put("/:notificationId/read", isAuthenticated, markNotificationAsRead);

// Mark all notifications as read
router.put("/read-all", isAuthenticated, markAllNotificationsAsRead);

export default router;
