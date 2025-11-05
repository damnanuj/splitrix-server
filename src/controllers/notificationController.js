import { Notification } from "../models/notificationModel.js";
import { Invite } from "../models/inviteModel.js";
import { Group } from "../models/groupModel.js";
import { User } from "../models/userModel.js";

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    // console.log(userId);
    const { unreadOnly = false } = req.query;

    const query = { user: userId };
    if (unreadOnly === "true") {
      query.readAt = null;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      // .populate("user", "name email profilePicture")
      .lean();

    const minimalNotifications = notifications.map((n) => ({
      _id: n._id,
      user: n.user,
      type: n.type,
      inviteId: n?.data?.inviteId ?? null,
      groupId: n?.data?.groupId ?? null,
      inviterId: n?.data?.inviterId ?? null,
      inviterName: n?.data?.inviterName ?? null,
      groupName: n?.data?.groupName ?? null,
      groupAvatar: n?.data?.groupAvatar ?? "",
      inviterProfilePicture: n?.data?.inviterProfilePicture ?? "",
      title: n.title,
      message: n.message,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      __v: n.__v,
    }));

    return res.status(200).json({
      success: true,
      msg: "Notifications fetched successfully",
      data: minimalNotifications,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch notifications" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        msg: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      msg: "Notification marked as read",
      notificationId: notification._id,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to mark notification as read" });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await Notification.updateMany(
      { user: userId, readAt: null },
      { readAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      msg: "All notifications marked as read",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      msg: "Failed to mark all notifications as read",
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    const unreadCount = await Notification.countDocuments({
      user: userId,
      readAt: null,
    });

    return res.status(200).json({
      success: true,
      msg: "Unread count fetched successfully",
      data: { unreadCount },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch unread count" });
  }
};
