import { Group } from "../models/groupModel.js";
import { Invite } from "../models/inviteModel.js";
import { Activity } from "../models/activityModel.js";
import { Bill } from "../models/billSchema.js";
import { Settlement } from "../models/settlementModel.js";
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
    const invite = await Invite.create({
      group: groupId,
      invitedBy: inviter,
      invitedUser: userId,
    });
    await Activity.create({
      group: groupId,
      actor: inviter,
      type: "invite_sent",
      summary: `Invite sent`,
      data: { invitedUser: userId },
    });
    await sendNotification({
      user: userId,
      type: "invite_sent",
      title: "Group invite",
      msg: "You have been invited to join a group",
      data: { groupId },
    });
    return res
      .status(201)
      .json({ success: true, msg: "Invite sent successfully", data: invite });
  } catch (e) {
    if (e?.code === 11000)
      return res
        .status(409)
        .json({ success: false, msg: "Invite already exists" });
    return res
      .status(500)
      .json({ success: false, msg: "Failed to send invite" });
  }
};

export const respondToInvite = async (req, res) => {
  try {
    const { inviteId, action } = req.body; // action: accepted | declined
    const userId = req.user?.id;
    const invite = await Invite.findById(inviteId);
    if (!invite || String(invite.invitedUser) !== String(userId)) {
      return res.status(404).json({ success: false, msg: "Invite not found" });
    }
    invite.status = action === "accepted" ? "accepted" : "declined";
    await invite.save();
    if (invite.status === "accepted") {
      await Group.updateOne(
        { _id: invite.group },
        { $addToSet: { members: userId } }
      );
      await Activity.create({
        group: invite.group,
        actor: userId,
        type: "invite_responded",
        summary: `Invite accepted`,
        data: { inviteId },
      });
      await sendNotification({
        user: invite.invitedBy,
        type: "invite_accepted",
        title: "Invite accepted",
        msg: "Your invite was accepted",
        data: { inviteId },
      });
    } else {
      await sendNotification({
        user: invite.invitedBy,
        type: "invite_declined",
        title: "Invite declined",
        msg: "Your invite was declined",
        data: { inviteId },
      });
    }
    return res
      .status(200)
      .json({ success: true, msg: "Invite response recorded", data: invite });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to respond to invite" });
  }
};
