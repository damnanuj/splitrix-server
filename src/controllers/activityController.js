import { Activity } from "../models/activityModel.js";
import { Group } from "../models/groupModel.js";

export const getGroupActivities = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, message: "Group ID is required" });
    }

    // Verify the group exists and the user is a member
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = (group.members || []).some(
      (m) => String(m) === String(userId)
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Only group members can view activities",
      });
    }

    // Fetch activities for the group, sorted by most recent first
    const activities = await Activity.find({ group: groupId })
      .populate("actor", "name email profilePicture")
      .populate("group", "name")
      .sort({ createdAt: -1 })
      .limit(100); // Limit to most recent 100 activities

    return res.status(200).json({
      success: true,
      message: "Activities fetched successfully",
      data: activities,
    });
  } catch (e) {
    console.error("Error in getGroupActivities:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: e.message,
    });
  }
};

export const getAllUserActivities = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Find all groups where the user is a member
    const userGroups = await Group.find({ members: userId }).select("_id");

    if (!userGroups || userGroups.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Activities fetched successfully",
        data: [],
      });
    }

    // Extract group IDs
    const groupIds = userGroups.map((group) => group._id);

    // Fetch all activities from groups the user is a member of
    // Also include activities where the user is the actor (in case they're not in a group anymore)
    const activities = await Activity.find({
      $or: [
        { group: { $in: groupIds } },
        { actor: userId }
      ]
    })
      .populate("actor", "name email profilePicture")
      .populate("group", "name description avatar")
      .sort({ createdAt: -1 })
      .limit(200); // Limit to most recent 200 activities

    return res.status(200).json({
      success: true,
      message: "All user activities fetched successfully",
      data: activities,
    });
  } catch (e) {
    console.error("Error in getAllUserActivities:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user activities",
      error: e.message,
    });
  }
};

