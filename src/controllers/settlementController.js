import { Settlement } from "../models/settlementModel.js";
import { Activity } from "../models/activityModel.js";
import { sendNotification } from "../utils/notifications/send.js";

export const createSettlement = async (req, res) => {
  try {
    const { group, from, to, amount, note } = req.body;
    if (!group || !from || !to || !amount) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    const settlement = await Settlement.create({ group, from, to, amount, note });
    await Activity.create({ group, actor: from, type: "settlement_made", summary: `Settlement of ${amount}`, data: { settlementId: settlement._id } });
    await sendNotification({ user: to, type: "settlement_made", title: "Settlement received", message: `You received a settlement of ${amount}`, data: { settlementId: settlement._id } });
    return res.status(201).json({ success: true, settlement });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to create settlement" });
  }
};

export const getGroupSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;
    const settlements = await Settlement.find({ group: groupId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, settlements });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to fetch settlements" });
  }
};


