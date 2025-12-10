import mongoose from "mongoose";
import { Group } from "../models/groupModel.js";
import { Activity } from "../models/activityModel.js";
import { Bill } from "../models/billSchema.js";
import { Settlement } from "../models/settlementModel.js";
import { User } from "../models/userModel.js";
import { sendNotification } from "../utils/notifications/send.js";

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds = [], description, avatar } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Group name is required" });
    }

    const createdBy = req.user?.id;

    // Validate and filter memberIds
    const validMemberIds = Array.isArray(memberIds)
      ? memberIds
          .map((id) => String(id).trim())
          .filter((id) => {
            // Check if valid ObjectId and not the creator
            return (
              mongoose.Types.ObjectId.isValid(id) &&
              String(id) !== String(createdBy)
            );
          })
      : [];

    // Remove duplicates
    const uniqueMemberIds = [...new Set(validMemberIds)];

    // Step 1: Create the group with all members (creator + selected friends)
    const allMembers = [createdBy, ...uniqueMemberIds];
    const group = await Group.create({
      name,
      createdBy,
      members: allMembers,
      description,
      avatar,
    });

    // Step 2: Log group creation activity
    await Activity.create({
      group: group._id,
      actor: createdBy,
      type: "group_created",
      summary: `Group ${name} created`,
      data: { name },
    });

    // Step 3: Fetch creator details
    const creatorUser = await User.findById(createdBy).select(
      "name email profilePicture"
    );

    if (!creatorUser) {
      return res
        .status(404)
        .json({ success: false, message: "Creator user not found" });
    }

    // Step 4: Send notifications to all added members (excluding creator)
    if (uniqueMemberIds.length > 0) {
      console.log(
        `📨 Sending notifications to ${uniqueMemberIds.length} users added to group ${group._id}`
      );

      // Send notifications to all added members
      const notificationPromises = uniqueMemberIds.map(async (friendId) => {
        try {
          const notificationResult = await sendNotification({
            user: friendId,
            type: "group_added",
            title: "You have been added to a group",
            message: `You have been added to a group called "${group.name}" by ${creatorUser.name}`,
            data: {
              groupId: group._id,
              creatorId: createdBy,
              creatorName: creatorUser.name,
              creatorProfilePicture: creatorUser.profilePicture,
              groupName: group.name,
              groupDescription: group.description,
              groupAvatar: group.avatar,
            },
          });

          if (notificationResult) {
            console.log(
              `✅ Notification sent successfully for user ${friendId}`
            );
            return { friendId: String(friendId), status: "ok" };
          } else {
            console.log(`⚠️ Notification failed for user ${friendId}`);
            return {
              friendId: String(friendId),
              status: "notification_failed",
            };
          }
        } catch (err) {
          console.error(
            `❌ Failed to send notification to ${friendId}:`,
            err.message
          );
          return {
            friendId: String(friendId),
            status: "notification_error",
            error: err.message,
          };
        }
      });

      // Wait for all notifications to be sent
      const notificationResults = await Promise.allSettled(
        notificationPromises
      );
      const processedNotifications = notificationResults.map(
        (result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            return {
              friendId: String(uniqueMemberIds[index] || ""),
              status: "notification_error",
              error: result.reason?.message || "Unknown error",
            };
          }
        }
      );

      const successfulNotifications = processedNotifications.filter(
        (r) => r.status === "ok"
      );
      console.log(
        `📨 Notification results: ${successfulNotifications.length}/${uniqueMemberIds.length} sent successfully`
      );

      // Log group joined activity for each added member
      for (const friendId of uniqueMemberIds) {
        try {
          const friendUser = await User.findById(friendId).select(
            "name profilePicture"
          );
          if (friendUser) {
            await Activity.create({
              group: group._id,
              actor: friendId,
              type: "group_joined",
              summary: `${friendUser.name} was added to the group`,
              data: {
                groupId: group._id,
                addedUserId: friendId,
                addedUserName: friendUser.name,
                addedUserProfilePicture: friendUser.profilePicture,
                groupName: group.name,
                addedBy: createdBy,
                addedByName: creatorUser.name,
              },
            });
          }
        } catch (activityErr) {
          console.error(
            `⚠️ Failed to create activity log for user ${friendId}:`,
            activityErr.message
          );
          // Don't fail the request if activity creation fails
        }
      }
    }

    // Step 5: Fetch updated group with populated members
    const updatedGroup = await Group.findById(group._id)
      .populate("members", "name email profilePicture")
      .populate("createdBy", "name email profilePicture");

    // Step 6: Respond success
    return res.status(201).json({
      success: true,
      msg:
        uniqueMemberIds.length > 0
          ? "Group created and members added successfully"
          : "Group created successfully",
      data: updatedGroup,
    });
  } catch (e) {
    console.error("❌ Error in createGroup:", e);
    return res.status(500).json({
      success: false,
      msg: "Failed to create group",
      error: e.message,
    });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user?.id;
    const groups = await Group.find({ members: userId })
      .select("-members") // exclude members array from response
      .sort({
        createdAt: -1,
      })
      .populate({
        path: "createdBy",
        select: "name email profilePicture _id",
      });

    // Calculate balances for each group
    const groupsWithBalances = await Promise.all(
      groups.map(async (group) => {
        const groupId = group._id;
        const bills = await Bill.find({ group: groupId });
        const settlements = await Settlement.find({ group: groupId });

        // Calculate net balance for the current user in this group
        let netBalance = 0;
        let amountOwed = 0;
        let amountToReceive = 0;

        // Process bills
        for (const bill of bills) {
          for (const split of bill.splitDetails) {
            if (String(split.from) === String(userId)) {
              netBalance -= split.amount;
              amountOwed += split.amount;
            }
            if (String(split.to) === String(userId)) {
              netBalance += split.amount;
              amountToReceive += split.amount;
            }
          }
        }

        // Process settlements
        for (const settlement of settlements) {
          if (String(settlement.from) === String(userId)) {
            netBalance -= settlement.amount;
            amountOwed += settlement.amount;
          }
          if (String(settlement.to) === String(userId)) {
            netBalance += settlement.amount;
            amountToReceive += settlement.amount;
          }
        }

        return {
          ...group.toObject(),
          balance: {
            net: netBalance,
            amountOwed: amountOwed,
            amountToReceive: amountToReceive,
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      msg: "Groups fetched successfully",
      data: groupsWithBalances,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch groups" });
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    // console.log(groupId, userId);

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, msg: "Group ID is required" });
    }

    // Get group details with populated members and creator
    const group = await Group.findById(groupId)
      .populate({
        path: "createdBy",
        select: "name email profilePicture _id",
      })
      .populate({
        path: "members",
        select: "name email profilePicture _id",
      });

    if (!group) {
      return res.status(404).json({ success: false, msg: "Group not found" });
    }

    const response = {
      _id: group._id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      createdBy: group.createdBy,
      members: group.members,
      memberCount: group.members.length,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    return res.status(200).json({
      success: true,
      msg: "Group details fetched successfully",
      data: response,
    });
  } catch (e) {
    console.error("Error in getGroupDetails:", e);
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch group details" });
  }
};

export const getBalancesSummaryForUser = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = String(req.user?.id || "");

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, msg: "Group ID is required" });
    }

    // Ensure the group exists and the user belongs to it
    const group = await Group.findById(groupId).populate({
      path: "members",
      select: "name _id",
    });

    if (!group) {
      return res.status(404).json({ success: false, msg: "Group not found" });
    }

    const isMember = group.members.some(
      (member) => String(member._id) === userId
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        msg: "You are not a member of this group",
      });
    }

    // Build a quick lookup for member names
    const memberNameById = new Map(
      group.members.map((m) => [String(m._id), m.name || ""])
    );

    // Track net amounts between the logged-in user and each member
    const netWithMember = new Map();
    const addAmount = (memberId, amount) => {
      if (String(memberId) === userId) return; // skip self
      const key = String(memberId);
      netWithMember.set(key, (netWithMember.get(key) || 0) + amount);
    };

    // Pull only the fields we need
    const bills = await Bill.find({ group: groupId }).select("splitDetails");
    const settlements = await Settlement.find({ group: groupId }).select(
      "from to amount"
    );

    // Bills: splitDetails.from owes splitDetails.to
    for (const bill of bills) {
      for (const split of bill.splitDetails || []) {
        if (String(split.from) === userId) addAmount(split.to, -split.amount);
        if (String(split.to) === userId) addAmount(split.from, split.amount);
      }
    }

    // Settlements: from pays to
    for (const settlement of settlements) {
      if (String(settlement.from) === userId) {
        addAmount(settlement.to, -settlement.amount);
      }
      if (String(settlement.to) === userId) {
        addAmount(settlement.from, settlement.amount);
      }
    }

    const balances = Array.from(netWithMember.entries())
      .map(([memberId, amount]) => ({
        memberId,
        name: memberNameById.get(memberId) || "Unknown",
        amount,
      }))
      // keep only members where there is any balance to settle
      .filter((b) => b.amount !== 0);

    return res.status(200).json({
      success: true,
      msg: "Balance summary fetched successfully",
      data: balances,
    });
  } catch (e) {
    console.error("Error in getBalancesSummaryForUser:", e);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch balance summary",
      error: e.message,
    });
  }
};
