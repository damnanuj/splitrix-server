import { Bill } from "../models/billSchema.js";
import { Activity } from "../models/activityModel.js";
import { sendNotification } from "../utils/notifications/send.js";
import { Settlement } from "../models/settlementModel.js";
import { User } from "../models/userModel.js";

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

// Aggregate pairwise balances within a group, netting opposite directions.
const computeNetGroupBalances = async (groupId) => {
  const bills = await Bill.find({ group: groupId }, { splitDetails: 1 }).lean();
  const settlements = await Settlement.find(
    { group: groupId },
    { from: 1, to: 1, amount: 1 }
  ).lean();

  const ledger = new Map(); // key: "low|high" -> signed amount (low owes high if >0)

  const applyEdge = (from, to, amount) => {
    const amt = Number(amount);
    if (!from || !to || !Number.isFinite(amt) || amt <= 0) return;

    const a = String(from);
    const b = String(to);
    if (a === b) return;

    const low = a < b ? a : b;
    const high = a < b ? b : a;
    const key = `${low}|${high}`;
    const sign = a < b ? 1 : -1;

    const current = ledger.get(key) || 0;
    ledger.set(key, current + sign * amt);
  };

  for (const bill of bills) {
    for (const split of bill.splitDetails || []) {
      applyEdge(split.from, split.to, split.amount);
    }
  }
  for (const settlement of settlements) {
    applyEdge(settlement.from, settlement.to, settlement.amount);
  }

  const balances = [];
  for (const [key, value] of ledger.entries()) {
    const [low, high] = key.split("|");
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(rounded) < 0.01) continue; // effectively settled

    if (rounded > 0) {
      balances.push({ from: low, to: high, amount: rounded });
    } else {
      balances.push({ from: high, to: low, amount: Math.abs(rounded) });
    }
  }

  return balances;
};

export const createBill = async (req, res) => {
  try {
    const { title, amount, group, paidBy, shares = [], createdBy } = req.body;

    const resolvedAmount = Number(amount);

    if (
      !group ||
      !paidBy ||
      !Array.isArray(shares) ||
      shares.length === 0 ||
      Number.isNaN(resolvedAmount) ||
      resolvedAmount < 0
    ) {
      return res
        .status(400)
        .json({ success: false, msg: "Missing or invalid fields" });
    }

    const normalizedShares = shares
      .map((share) => ({
        user: share?.user,
        amount: Number(share?.amount),
      }))
      .filter(
        (share) =>
          share.user && Number.isFinite(share.amount) && share.amount >= 0
      );

    if (normalizedShares.length === 0) {
      return res
        .status(400)
        .json({ success: false, msg: "Shares payload is invalid" });
    }

    const totalShares = normalizedShares.reduce(
      (sum, share) => sum + share.amount,
      0
    );
    if (Math.round(totalShares * 100) !== Math.round(resolvedAmount * 100)) {
      return res.status(400).json({
        success: false,
        msg: "Shares must add up to the bill amount",
      });
    }

    const participantIds = Array.from(
      new Set(normalizedShares.map((share) => String(share.user)))
    );
    const participants = Array.from(
      new Set([...participantIds, String(paidBy)])
    );

    const splitDetails = normalizedShares
      .filter(
        (share) => String(share.user) !== String(paidBy) && share.amount > 0
      )
      .map((share) => ({
        from: share.user,
        to: paidBy,
        amount: share.amount,
      }));

    const creatorId = req.user?.id || createdBy || paidBy;

    const bill = await Bill.create({
      title: title && title.trim() ? title.trim() : "an expense",
      amount: resolvedAmount,
      group,
      paidBy,
      createdBy: creatorId,
      participants,
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

    // notify participants with a richer, per-user message
    const payerDoc = await User.findById(paidBy).select("name").lean();
    const payerName = payerDoc?.name || "Someone";
    const billLabel = title && title.trim() ? title.trim() : "an expense";

    for (const uid of participantIds) {
      if (String(uid) === String(actorId)) continue;

      const share = normalizedShares.find(
        (s) => String(s.user) === String(uid)
      );
      const shareAmount = Number(share?.amount || 0);

      let stakePart = "You're settled for this one.";
      if (shareAmount > 0) {
        stakePart = `You owe ${formatCurrency(shareAmount)}.`;
      }

      const message = `${payerName} paid ${formatCurrency(
        resolvedAmount
      )} for ${billLabel}. ${stakePart}`;

      await sendNotification({
        user: uid,
        type: "bill_added",
        title: `${billLabel}`,
        message,
        data: { billId: bill._id, groupId: group },
      });
    }

    const balances = await computeNetGroupBalances(group);

    res.status(201).json({
      success: true,
      msg: "Bill created successfully",
      data: { bill, balances },
    });
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

    // Fetch bills with user fields populated
    const bills = await Bill.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate("paidBy", "name email profilePicture")
      .populate("createdBy", "name email profilePicture")
      .populate("shares.user", "name email profilePicture")
      .lean({ virtuals: true });

    // Serialize each bill
    const serializedBills = bills.map((bill) => {
      const billAmount = Number(bill.amount) || 0;
      const payerId = toIdString(bill.paidBy);

      // Extract payer info from populated paidBy
      const payerInfo = bill.paidBy || {};
      const paidBy = {
        id: payerId,
        name: payerInfo.name || "",
        email: payerInfo.email || "",
        avatar: payerInfo.profilePicture || "",
      };

      // Convert shares[] into proper split data
      const splits = (bill.shares || []).map((share) => {
        const uid = toIdString(share.user);
        const shareAmount = Number(share.amount) || 0;

        // User paid full amount ONLY if they are the payer
        const paidAmount = uid === payerId ? billAmount : 0;
        const balance = Number((paidAmount - shareAmount).toFixed(2));

        // Extract user info from populated share.user
        const userInfo = share.user || {};
        return {
          user: {
            id: uid,
            name: userInfo.name || "",
            email: userInfo.email || "",
            avatar: userInfo.profilePicture || "",
          },
          share: shareAmount,
          paid: paidAmount,
          balance,
        };
      });

      // Check requester participation
      const requesterSplit = splits.find((s) => s.user.id === requesterId);
      const isParticipant = !!requesterSplit;
      const stakeBalance = requesterSplit?.balance || 0;

      return {
        id: toIdString(bill._id),
        description: bill.title,
        amount: billAmount,
        date: bill.createdAt,
        paidBy,
        splits,
        yourStake: buildYourStake(stakeBalance, isParticipant),
      };
    });

    // Return response
    return res.status(200).json({
      success: true,
      msg: "Bills fetched successfully",
      data: serializedBills,
    });
  } catch (err) {
    console.error("getGroupBills error:", err);
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch bills" });
  }
};
