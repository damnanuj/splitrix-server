import { Bill } from "../models/billSchema.js";
import { Activity } from "../models/activityModel.js";
import { sendNotification } from "../utils/notifications/send.js";
import {
  calculateEqualSplits,
  calculateUnequalSplits,
  calculateShareWeightSplits,
  calculateItemizedSplits,
  mergeSplits,
} from "../utils/splits/calc.js";

export const createBill = async (req, res) => {
  try {
    const {
      title,
      amount,
      group,
      paidBy,
      participants,
      involved,
      splitType,
      shares = [],
      items = [],
      note,
      category,
    } = req.body;

    if (
      !title ||
      !amount ||
      !group ||
      !paidBy ||
      !participants ||
      participants.length < 1
    ) {
      return res.status(400).json({ success: false, msg: "Missing fields" });
    }

    let rawSplits = [];
    switch (splitType) {
      case "equal":
        rawSplits = calculateEqualSplits({
          amount,
          payerId: paidBy,
          participantIds: involved?.length ? involved : participants,
        });
        break;
      case "unequal":
        rawSplits = calculateUnequalSplits({ payerId: paidBy, shares });
        break;
      case "shares":
        rawSplits = calculateShareWeightSplits({
          amount,
          payerId: paidBy,
          shares,
        });
        break;
      case "itemized":
        rawSplits = calculateItemizedSplits({ items });
        break;
      case "custom":
        // expect caller to send shares: [{from,to,amount}] in shares
        rawSplits = shares.map((s) => ({
          from: s.from,
          to: s.to,
          amount: s.amount,
        }));
        break;
      default:
        return res
          .status(400)
          .json({ success: false, msg: "Invalid splitType" });
    }

    const splitDetails = mergeSplits(rawSplits);

    const bill = await Bill.create({
      title,
      amount,
      group,
      paidBy,
      participants,
      involved: involved?.length ? involved : participants,
      splitType,
      shares,
      items,
      splitDetails,
      note,
      category,
    });

    await Activity.create({
      group,
      actor: paidBy,
      type: "bill_added",
      summary: `Added bill ${title}`,
      data: { billId: bill._id },
    });
    // notify participants
    for (const uid of participants) {
      if (String(uid) === String(paidBy)) continue;
      await sendNotification({
        user: uid,
        type: "bill_added",
        title: "New bill added",
        message: title,
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
    const bills = await Bill.find({ group: groupId }).sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ success: true, msg: "Bills fetched successfully", data: bills });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to fetch bills" });
  }
};
