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
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Group name is required" });
    const createdBy = req.user?.id;
    const members = Array.from(new Set([createdBy, ...memberIds]));
    const group = await Group.create({
      name,
      createdBy,
      members,
      description,
      avatar,
    });
    await Activity.create({
      group: group._id,
      actor: createdBy,
      type: "group_created",
      summary: `Group ${name} created`,
      data: { name },
    });
    return res
      .status(201)
      .json({ success: true, msg: "Group created successfully", data: group });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to create group" });
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

    const invite = await Invite.create({
      group: groupId,
      invitedBy: inviter,
      invitedUser: userId,
    });

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
      .populate("invitedUser", "name email profilePicture");

    if (!invite || String(invite.invitedUser._id) !== String(userId)) {
      return res.status(404).json({ success: false, msg: "Invite not found" });
    }

    // Check if invite is still pending
    if (invite.status !== "pending") {
      return res.status(400).json({
        success: false,
        msg: "Invite has already been responded to",
      });
    }

    invite.status = action === "accepted" ? "accepted" : "declined";
    await invite.save();

    if (invite.status === "accepted") {
      // Add user to group
      await Group.updateOne(
        { _id: invite.group._id },
        { $addToSet: { members: userId } }
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
        summary: `${invite.invitedUser.name} accepted the invite`,
        data: {
          inviteId: invite._id,
          acceptedBy: userId,
          acceptedByName: invite.invitedUser.name,
          acceptedByProfilePicture: invite.invitedUser.profilePicture,
        },
      });

      // Create activity for group joined
      await Activity.create({
        group: invite.group._id,
        actor: userId,
        type: "group_joined",
        summary: `${invite.invitedUser.name} joined the group`,
        data: {
          joinedUser: userId,
          joinedUserName: invite.invitedUser.name,
          joinedUserProfilePicture: invite.invitedUser.profilePicture,
          groupName: invite.group.name,
        },
      });

      // Notify the inviter
      await sendNotification({
        user: invite.invitedBy._id,
        type: "invite_accepted",
        title: "Invite accepted",
        message: `${invite.invitedUser.name} accepted your invite to join "${invite.group.name}"`,
        data: {
          inviteId: invite._id,
          groupId: invite.group._id,
          groupName: invite.group.name,
          acceptedBy: userId,
          acceptedByName: invite.invitedUser.name,
          acceptedByProfilePicture: invite.invitedUser.profilePicture,
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
          message: `${invite.invitedUser.name} joined "${invite.group.name}"`,
          data: {
            groupId: invite.group._id,
            groupName: invite.group.name,
            newMember: userId,
            newMemberName: invite.invitedUser.name,
            newMemberProfilePicture: invite.invitedUser.profilePicture,
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
        summary: `${invite.invitedUser.name} declined the invite`,
        data: {
          inviteId: invite._id,
          declinedBy: userId,
          declinedByName: invite.invitedUser.name,
          declinedByProfilePicture: invite.invitedUser.profilePicture,
        },
      });

      await sendNotification({
        user: invite.invitedBy._id,
        type: "invite_declined",
        title: "Invite declined",
        message: `${invite.invitedUser.name} declined your invite to join "${invite.group.name}"`,
        data: {
          inviteId: invite._id,
          groupId: invite.group._id,
          groupName: invite.group.name,
          declinedBy: userId,
          declinedByName: invite.invitedUser.name,
          declinedByProfilePicture: invite.invitedUser.profilePicture,
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

    // Check if user is a member
    const isMember = group.members.some(
      (member) => String(member._id) === String(userId)
    );

    // Check if user is the creator
    const isCreator = String(group.createdBy._id) === String(userId);

    // Check if user has a pending invite
    const pendingInvite = await Invite.findOne({
      group: groupId,
      invitedUser: userId,
      status: "pending",
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
        memberCount: group.members.length,
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
    const invites = await Invite.find({ invitedUser: userId })
      .populate("group", "name description avatar createdBy")
      .populate("invitedBy", "name email profilePicture")
      .populate("group.createdBy", "name email profilePicture")
      .sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      msg: "Invites fetched successfully",
      data: invites,
    });
  } catch (e) {
    console.error("Error in getMyInvites:", e);
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch invites" });
  }
};
