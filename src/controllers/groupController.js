import mongoose from "mongoose";
import { Group } from "../models/groupModel.js";
import { Invite } from "../models/inviteModel.js";
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

    // Step 1: Create the group (only creator is a member, invited users go to invitedUsers)
    const group = await Group.create({
      name,
      createdBy,
      members: [createdBy],
      invitedUsers: uniqueMemberIds,
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

    // Step 3: Fetch inviter (creator) details once
    const inviterUser = await User.findById(createdBy).select(
      "name email profilePicture"
    );

    if (!inviterUser) {
      return res
        .status(404)
        .json({ success: false, message: "Creator user not found" });
    }

    // Step 4: Handle invites (if any friends selected)
    if (uniqueMemberIds.length > 0) {
      console.log(
        `📨 Creating invite for ${uniqueMemberIds.length} users in group ${group._id}`
      );

      // Convert string IDs to ObjectIds and create invitedUsers array with status
      const invitedUsers = uniqueMemberIds.map((id) => ({
        userId: new mongoose.Types.ObjectId(id),
        status: "pending",
      }));

      try {
        // Create or update invite (one invite per group with all users)
        let invite = await Invite.findOne({ group: group._id });

        if (invite) {
          // Update existing invite - add new users if not already present
          const existingUserIds = invite.invitedUsers.map((u) =>
            String(u.userId)
          );
          const newInvitedUsers = invitedUsers.filter(
            (u) => !existingUserIds.includes(String(u.userId))
          );

          if (newInvitedUsers.length > 0) {
            invite.invitedUsers.push(...newInvitedUsers);
            await invite.save();
            console.log(
              `✅ Updated existing invite ${invite._id} with ${newInvitedUsers.length} new users`
            );
          } else {
            console.log(
              `ℹ️ All users already in existing invite ${invite._id}`
            );
          }
        } else {
          // Create new invite with all users
          invite = await Invite.create({
            group: new mongoose.Types.ObjectId(group._id),
            invitedBy: new mongoose.Types.ObjectId(createdBy),
            invitedUsers: invitedUsers,
          });
          console.log(
            `✅ Created new invite ${invite._id} for ${invitedUsers.length} users`
          );
        }

        // Send notifications to all invited users (each user gets their own notification)
        const notificationPromises = invitedUsers.map(async (invitedUser) => {
          const friendId = invitedUser.userId;
          try {
            const notificationResult = await sendNotification({
              user: friendId,
              type: "group_invite",
              title: "You have a new group invite",
              message: `${inviterUser.name} invited you to join "${group.name}"`,
              data: {
                inviteId: invite._id, // Same inviteId for all users
                groupId: group._id,
                inviterId: createdBy,
                inviterName: inviterUser.name,
                inviterProfilePicture: inviterUser.profilePicture,
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
                friendId: String(invitedUsers[index]?.userId || ""),
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
          `📨 Notification results: ${successfulNotifications.length}/${invitedUsers.length} sent successfully`
        );

        // Log invite activity (after notifications are sent)
        try {
          await Activity.create({
            group: group._id,
            actor: createdBy,
            type: "group_invite",
            summary: `Group invite sent to ${invitedUsers.length} users`,
            data: {
              inviteId: invite._id,
              groupId: group._id,
              inviterId: createdBy,
              inviterName: inviterUser.name,
              inviterProfilePicture: inviterUser.profilePicture,
              groupName: group.name,
              groupDescription: group.description,
              groupAvatar: group.avatar,
              invitedUsersCount: invitedUsers.length,
            },
          });
        } catch (activityErr) {
          console.error(
            `⚠️ Failed to create activity log:`,
            activityErr.message
          );
          // Don't fail the request if activity creation fails
        }
      } catch (err) {
        console.error(
          `❌ Failed to create/update invite:`,
          err.message,
          err.stack
        );
        // Don't fail the entire request, just log the error
      }
    }
    // Step 5: Fetch updated group with populated invitedUsers
    const updatedGroup = await Group.findById(group._id)
      .populate("invitedUsers", "name email profilePicture")
      .populate("members", "name email profilePicture");

    // Step 6: Respond success
    return res.status(201).json({
      success: true,
      msg:
        uniqueMemberIds.length > 0
          ? "Group created and invites sent successfully"
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
      .sort({
        createdAt: -1,
      })
      .populate({
        path: "createdBy",
        select: "name email profilePicture _id",
      })
      .populate({
        path: "members",
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

export const inviteToGroup = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    if (!groupId || !userId)
      return res
        .status(400)
        .json({ success: false, msg: "groupId and userId required" });
    const inviter = req.user?.id;

    // Get group and inviter details for the notification
    const group = await Group.findById(groupId).select(
      "name description avatar members"
    );
    if (!group) {
      return res.status(404).json({ success: false, msg: "Group not found" });
    }

    const inviterUser = await User.findById(inviter).select(
      "name email profilePicture"
    );
    if (!inviterUser) {
      return res.status(404).json({ success: false, msg: "Inviter not found" });
    }

    const invitedUserId = new mongoose.Types.ObjectId(userId);

    // Find or create invite for this group
    let invite = await Invite.findOne({ group: groupId });

    if (invite) {
      // Check if user is already invited
      const isAlreadyInvited = invite.invitedUsers.some(
        (u) => String(u.userId) === String(invitedUserId)
      );

      if (isAlreadyInvited) {
        return res
          .status(409)
          .json({ success: false, msg: "User already invited" });
      }

      // Add user to existing invite
      invite.invitedUsers.push({ userId: invitedUserId, status: "pending" });
      await invite.save();
    } else {
      // Create new invite
      invite = await Invite.create({
        group: new mongoose.Types.ObjectId(groupId),
        invitedBy: new mongoose.Types.ObjectId(inviter),
        invitedUsers: [{ userId: invitedUserId, status: "pending" }],
      });
    }

    // Add user to invitedUsers array in group
    await Group.updateOne(
      { _id: groupId },
      { $addToSet: { invitedUsers: userId } }
    );

    await Activity.create({
      group: groupId,
      actor: inviter,
      type: "group_invite",
      summary: `Group invite sent`,
      data: {
        inviteId: invite._id,
        groupId: groupId,
        inviterId: inviter,
        inviterName: inviterUser.name,
        inviterProfilePicture: inviterUser.profilePicture,
        groupName: group.name,
        groupDescription: group.description,
        groupAvatar: group.avatar,
        groupMembersCount: group.members.length,
      },
    });

    await sendNotification({
      user: userId,
      type: "group_invite",
      title: "You have a new group invite",
      message: `${inviterUser.name} invited you to join "${group.name}" group`,
      data: {
        inviteId: invite._id,
        groupId: groupId,
        inviterId: inviter,
        inviterName: inviterUser.name,
        inviterProfilePicture: inviterUser.profilePicture,
        groupName: group.name,
        groupDescription: group.description,
        groupAvatar: group.avatar,
        groupMembersCount: group.members.length,
      },
    });

    return res
      .status(201)
      .json({ success: true, msg: "Invite sent successfully", data: invite });
  } catch (e) {
    console.error("Error in inviteToGroup:", e);
    if (e?.code === 11000)
      return res
        .status(409)
        .json({ success: false, msg: "Invite already exists" });
    return res
      .status(500)
      .json({ success: false, msg: "Failed to send invite", error: e.message });
  }
};

export const respondToInvite = async (req, res) => {
  try {
    const { inviteId, action } = req.body; // action: accepted | declined
    const userId = req.user?.id;

    // Get invite with populated data
    const invite = await Invite.findById(inviteId)
      .populate("group", "name description avatar members")
      .populate("invitedBy", "name email profilePicture")
      .populate("invitedUsers.userId", "name email profilePicture");

    if (!invite) {
      return res.status(404).json({ success: false, msg: "Invite not found" });
    }

    // Find the user's entry in invitedUsers array
    // Handle both populated (User object) and unpopulated (ObjectId) userId
    const userInviteIndex = invite.invitedUsers.findIndex((u) => {
      const uId = u.userId?._id || u.userId; // Handle populated or unpopulated
      return String(uId) === String(userId);
    });

    if (userInviteIndex === -1) {
      return res
        .status(404)
        .json({ success: false, msg: "You are not invited to this group" });
    }

    // Check if user has already responded
    const currentStatus = invite.invitedUsers[userInviteIndex].status;
    if (currentStatus !== "pending") {
      return res.status(400).json({
        success: false,
        msg: "You have already responded to this invite",
      });
    }

    // Update user's status
    invite.invitedUsers[userInviteIndex].status =
      action === "accepted" ? "accepted" : "declined";
    await invite.save();

    // Get the user details for notifications (populated userId)
    const userInviteEntry = invite.invitedUsers[userInviteIndex];
    const respondingUser = userInviteEntry.userId; // This is populated, so it's the User object

    if (!respondingUser || !respondingUser._id) {
      return res.status(400).json({
        success: false,
        msg: "User not found in invite",
      });
    }

    const userStatus = invite.invitedUsers[userInviteIndex].status;

    if (userStatus === "accepted") {
      // Add user to group members and remove from invitedUsers
      await Group.updateOne(
        { _id: invite.group._id },
        {
          $addToSet: { members: userId },
          $pull: { invitedUsers: userId },
        }
      );

      // Get updated group with all members
      const updatedGroup = await Group.findById(invite.group._id).populate(
        "members",
        "name email profilePicture"
      );

      // Create activity for invite acceptance
      await Activity.create({
        group: invite.group._id,
        actor: userId,
        type: "invite_responded",
        summary: `${respondingUser.name} accepted the invite`,
        data: {
          inviteId: invite._id,
          acceptedBy: userId,
          acceptedByName: respondingUser.name,
          acceptedByProfilePicture: respondingUser.profilePicture,
        },
      });

      // Create activity for group joined
      await Activity.create({
        group: invite.group._id,
        actor: userId,
        type: "group_joined",
        summary: `${respondingUser.name} joined the group`,
        data: {
          joinedUser: userId,
          joinedUserName: respondingUser.name,
          joinedUserProfilePicture: respondingUser.profilePicture,
          groupName: invite.group.name,
        },
      });

      // Notify the inviter
      await sendNotification({
        user: invite.invitedBy._id,
        type: "invite_accepted",
        title: "Invite accepted",
        message: `${respondingUser.name} accepted your invite to join "${invite.group.name}"`,
        data: {
          inviteId: invite._id,
          groupId: invite.group._id,
          groupName: invite.group.name,
          acceptedBy: userId,
          acceptedByName: respondingUser.name,
          acceptedByProfilePicture: respondingUser.profilePicture,
        },
      });

      // Notify all other group members about the new member
      const otherMembers = updatedGroup.members.filter(
        (member) =>
          String(member._id) !== String(userId) &&
          String(member._id) !== String(invite.invitedBy._id)
      );

      for (const member of otherMembers) {
        await sendNotification({
          user: member._id,
          type: "group_joined",
          title: "New member joined",
          message: `${respondingUser.name} joined "${invite.group.name}"`,
          data: {
            groupId: invite.group._id,
            groupName: invite.group.name,
            newMember: userId,
            newMemberName: respondingUser.name,
            newMemberProfilePicture: respondingUser.profilePicture,
          },
        });
      }

      // Calculate initial balance for the new member
      const bills = await Bill.find({ group: invite.group._id });
      const settlements = await Settlement.find({ group: invite.group._id });

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

      const response = {
        invite: invite,
        group: {
          _id: invite.group._id,
          name: invite.group.name,
          description: invite.group.description,
          avatar: invite.group.avatar,
          memberCount: updatedGroup.members.length,
        },
        userBalance: {
          net: netBalance,
          amountOwed: amountOwed,
          amountToReceive: amountToReceive,
        },
      };

      return res.status(200).json({
        success: true,
        msg: "Invite accepted successfully",
        data: response,
      });
    } else {
      // Handle declined invite
      await Activity.create({
        group: invite.group._id,
        actor: userId,
        type: "invite_responded",
        summary: `${respondingUser.name} declined the invite`,
        data: {
          inviteId: invite._id,
          declinedBy: userId,
          declinedByName: respondingUser.name,
          declinedByProfilePicture: respondingUser.profilePicture,
        },
      });

      await sendNotification({
        user: invite.invitedBy._id,
        type: "invite_declined",
        title: "Invite declined",
        message: `${respondingUser.name} declined your invite to join "${invite.group.name}"`,
        data: {
          inviteId: invite._id,
          groupId: invite.group._id,
          groupName: invite.group.name,
          declinedBy: userId,
          declinedByName: respondingUser.name,
          declinedByProfilePicture: respondingUser.profilePicture,
        },
      });

      return res.status(200).json({
        success: true,
        msg: "Invite declined",
        data: { invite },
      });
    }
  } catch (e) {
    console.error("Error in respondToInvite:", e);
    return res.status(500).json({
      success: false,
      msg: "Failed to respond to invite",
      error: e.message,
    });
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user?.id;

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, msg: "Group ID is required" });
    }

    // Get group details with populated members, invitedUsers, and creator
    const group = await Group.findById(groupId)
      .populate({
        path: "createdBy",
        select: "name email profilePicture _id",
      })
      .populate({
        path: "members",
        select: "name email profilePicture _id",
      })
      .populate({
        path: "invitedUsers",
        select: "name email profilePicture _id",
      });

    if (!group) {
      return res.status(404).json({ success: false, msg: "Group not found" });
    }

    // Check if user is a member
    const isMember = group.members.some(
      (member) => String(member._id) === String(userId)
    );

    // Check if user is the creator
    const isCreator = String(group.createdBy._id) === String(userId);

    // Check if user has a pending invite (user is in invitedUsers array with pending status)
    const pendingInvite = await Invite.findOne({
      group: groupId,
      "invitedUsers.userId": userId,
      "invitedUsers.status": "pending",
    });

    // Calculate user's balance in this group if they are a member
    let userBalance = null;
    if (isMember) {
      const bills = await Bill.find({ group: groupId });
      const settlements = await Settlement.find({ group: groupId });

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

      userBalance = {
        net: netBalance,
        amountOwed: amountOwed,
        amountToReceive: amountToReceive,
      };
    }

    // Determine membership status
    let membershipStatus = "not_member";
    if (isCreator) {
      membershipStatus = "creator";
    } else if (isMember) {
      membershipStatus = "member";
    } else if (pendingInvite) {
      membershipStatus = "invited";
    }

    const response = {
      group: {
        _id: group._id,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        createdBy: group.createdBy,
        members: group.members,
        invitedUsers: group.invitedUsers || [],
        memberCount: group.members.length,
        invitedUsersCount: (group.invitedUsers || []).length,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
      userMembership: {
        isMember,
        isCreator,
        membershipStatus,
        hasPendingInvite: !!pendingInvite,
        pendingInviteId: pendingInvite?._id || null,
        balance: userBalance,
      },
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

export const getMyInvites = async (req, res) => {
  try {
    const userId = req.user?.id;
    // Find invites where user is in the invitedUsers array
    const invites = await Invite.find({ "invitedUsers.userId": userId })
      .populate("group", "name description avatar createdBy")
      .populate("invitedBy", "name email profilePicture")
      .populate("invitedUsers.userId", "name email profilePicture")
      .populate("group.createdBy", "name email profilePicture")
      .sort({ createdAt: -1 });

    // Filter to only include invites where user has pending status
    const pendingInvites = invites.filter((invite) => {
      const userInvite = invite.invitedUsers.find((u) => {
        const uId = u.userId?._id || u.userId; // Handle populated or unpopulated
        return String(uId) === String(userId);
      });
      return userInvite && userInvite.status === "pending";
    });

    return res.status(200).json({
      success: true,
      msg: "Invites fetched successfully",
      data: pendingInvites,
    });
  } catch (e) {
    console.error("Error in getMyInvites:", e);
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch invites" });
  }
};
