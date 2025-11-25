import { Bill } from "../models/billSchema.js";
import { Activity } from "../models/activityModel.js";
import { sendNotification } from "../utils/notifications/send.js";
import { Group } from "../models/groupModel.js";

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `₹${currencyFormatter.format(amount)}`;
};

const buildYourStake = (balance, isParticipant) => {
  if (!isParticipant) {
    return { amount: 0, displayMsg: "You are not part of this expense" };
  }

  const resolvedBalance = Number(balance || 0);
  const absolute = Number(Math.abs(resolvedBalance).toFixed(2));

  if (resolvedBalance > 0) {
    return {
      amount: absolute,
      displayMsg: `You get back ${formatCurrency(absolute)}`,
    };
  }
  if (resolvedBalance < 0) {
    return {
      amount: -absolute,
      displayMsg: `You owe ${formatCurrency(absolute)}`,
    };
  }
  return { amount: 0, displayMsg: "You're settled" };
};

export const createBill = async (req, res) => {
  try {
    const {
      title,
      amount,
      group,
      paidBy,
      splitType,
      shares = [],
      createdBy,
    } = req.body;

    if (!title || amount == null || !group || !paidBy || !shares.length) {
      return res.status(400).json({ success: false, msg: "Missing fields" });
    }

    const normalizedShares = shares
      .map((share) => ({
        user: share.user,
        amount: Number(share.amount),
      }))
      .filter((share) => share.user && !Number.isNaN(share.amount));

    if (normalizedShares.length === 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Shares payload is invalid" });
    }

    const splitMode = splitType || "amount";
    const allowedSplitModes = ["amount", "share", "percent"];
    if (!allowedSplitModes.includes(splitMode)) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid splitType provided" });
    }

    const totalShares = normalizedShares.reduce(
      (sum, share) => sum + share.amount,
      0
    );
    if (Math.round(totalShares * 100) !== Math.round(Number(amount) * 100)) {
      return res.status(400).json({
        success: false,
        msg: "Shares must add up to the bill amount",
      });
    }

    const participantSet = new Set(
      normalizedShares.map((share) => String(share.user))
    );
    const participantIds = Array.from(participantSet);
    const participants = Array.from(
      new Set([...participantIds, String(paidBy)])
    );

    const splitDetails = normalizedShares
      .filter((share) => String(share.user) !== String(paidBy))
      .map((share) => ({
        from: share.user,
        to: paidBy,
        amount: share.amount,
      }));

    const creatorId = req.user?.id || createdBy || paidBy;

    const bill = await Bill.create({
      title,
      amount,
      group,
      paidBy,
      createdBy: creatorId,
      participants,
      splitType: splitMode,
      shares: normalizedShares,
      items: [],
      splitDetails,
    });

    const actorId = creatorId;

    await Activity.create({
      group,
      actor: actorId,
      type: "bill_added",
      summary: `Added bill ${title}`,
      data: {
        billId: bill._id,
        amount,
        paidBy,
        participants,
      },
    });
    // notify participants
    for (const uid of participantIds) {
      if (String(uid) === String(actorId)) continue;
      await sendNotification({
        user: uid,
        type: "bill_added",
        title: "New bill added",
        message: `You were added to "${title}"`,
        data: { billId: bill._id, group },
      });
    }

    res
      .status(201)
      .json({ success: true, msg: "Bill created successfully", data: bill });
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const getGroupBills = async (req, res) => {
  try {
    const { groupId } = req.params;
    const requesterId = req.user?.id ? String(req.user.id) : null;

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, msg: "Group ID is required" });
    }

    const group = await Group.findById(groupId)
      .populate("members", "name email profilePicture")
      .lean();

    if (!group) {
      return res.status(404).json({ success: false, msg: "Group not found" });
    }

    const isGroupMember = group.members.some(
      (member) => toIdString(member._id || member) === requesterId
    );

    if (!isGroupMember) {
      return res
        .status(403)
        .json({ success: false, msg: "You are not a member of this group" });
    }

    const membersDirectory = (group.members || []).reduce((acc, member) => {
      const memberId = toIdString(member._id || member);
      if (!memberId) return acc;
      acc[memberId] = {
        name: member.name,
        email: member.email,
        avatar: member.profilePicture || "",
      };
      return acc;
    }, {});

    const hydrateUser = (user) => {
      const userId = toIdString(user);
      if (!userId) return null;
      const cached = membersDirectory[userId];
      if (cached) {
        return {
          id: userId,
          name: cached.name,
          email: cached.email,
          avatar: cached.avatar,
        };
      }
      if (typeof user === "object") {
        return {
          id: userId,
          name: user.name,
          email: user.email,
          avatar: user.profilePicture || "",
        };
      }
      return { id: userId, name: "", email: "", avatar: "" };
    };

    const bills = await Bill.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("paidBy", "name email profilePicture")
      .populate("createdBy", "name email profilePicture")
      .populate("participants", "name email profilePicture")
      .populate("shares.user", "name email profilePicture")
      .populate("splitDetails.from", "name email profilePicture")
      .populate("splitDetails.to", "name email profilePicture")
      .populate("items.paidBy", "name email profilePicture")
      .populate("items.involved", "name email profilePicture")
      .lean({ virtuals: true });

    const serializedBills = bills.map((bill) => {
      const shares = bill.shares || [];
      const payerId = toIdString(bill.paidBy);
      const billAmount = Number(bill.amount) || 0;

      const splits = shares.map((share) => {
        const userId = toIdString(share.user);
        const shareAmount = Number(share.amount) || 0;
        const paidAmount = userId === payerId ? billAmount : 0;
        const balance = Number((paidAmount - shareAmount).toFixed(2));
        return {
          user: hydrateUser(share.user),
          share: shareAmount,
          paid: paidAmount,
          balance,
        };
      });

      const requesterSplit = splits.find(
        (split) => requesterId && split.userId === requesterId
      );
      const isParticipant = !!requesterSplit;
      const stakeBalance = requesterSplit ? requesterSplit.balance : 0;

      return {
        id: toIdString(bill._id),
        description: bill.title,
        amount: billAmount,
        date: bill.createdAt,
        payerId,
        splitType: bill.splitType,
        splits,
        yourStake: buildYourStake(stakeBalance, isParticipant),
      };
    });

    return res.status(200).json({
      success: true,
      msg: "Bills fetched successfully",
      data: {
        group: { id: groupId },
        members: membersDirectory,
        expenses: serializedBills,
      },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch bills" });
  }
};
