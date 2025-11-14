import { Bill } from "../models/billSchema.js";
import { Settlement } from "../models/settlementModel.js";

export const getGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const bills = await Bill.find({ group: groupId });
    const settlements = await Settlement.find({ group: groupId });

    const net = new Map();
    const add = (u, v) => net.set(u, (net.get(u) || 0) + v);

    for (const bill of bills) {
      for (const s of bill.splitDetails) {
        add(String(s.from), -s.amount);
        add(String(s.to), s.amount);
      }
    }
    for (const setl of settlements) {
      add(String(setl.from), -setl.amount);
      add(String(setl.to), setl.amount);
    }

    const balances = Array.from(net.entries()).map(([userId, amount]) => ({
      userId,
      amount,
    }));
    return res.status(200).json({
      success: true,
      msg: "Balances calculated successfully",
      data: balances,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to compute balances" });
  }
};

export const getMyBalances = async (req, res) => {
  try {
    const me = String(req.user?.id);
    const bills = await Bill.find({ "splitDetails.0": { $exists: true } });
    const settlements = await Settlement.find({});

    let net = 0;
    for (const bill of bills) {
      for (const s of bill.splitDetails) {
        if (String(s.from) === me) net -= s.amount;
        if (String(s.to) === me) net += s.amount;
      }
    }
    for (const setl of settlements) {
      if (String(setl.from) === me) net -= setl.amount;
      if (String(setl.to) === me) net += setl.amount;
    }
    return res.status(200).json({
      success: true,
      msg: "Net balance calculated successfully",
      data: { net },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to compute balances" });
  }
};
