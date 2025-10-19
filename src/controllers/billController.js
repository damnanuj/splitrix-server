import { Bill } from "../models/billSchema.js"; 

export const createBill = async (req, res) => {
  try {
    const { title, amount, group, paidBy, participants } = req.body;

    if (
      !title ||
      !amount ||
      !group ||
      !paidBy ||
      !participants ||
      participants.length < 2
    ) {
      return res
        .status(400)
        .json({ message: "Missing fields or not enough participants" });
    }

    const sharePerPerson = amount / participants.length;
    const splitDetails = [];

    // Add entry for each participant (except the one who paid)
    participants.forEach((userId) => {
      if (userId !== paidBy) {
        splitDetails.push({
          from: userId,
          to: paidBy,
          amount: sharePerPerson,
        });
      }
    });

    const bill = await Bill.create({
      title,
      amount,
      group,
      paidBy,
      participants,
      splitDetails,
    });

    res.status(201).json({
      message: "Bill created and split successfully",
      bill,
    });
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).json({ message: "Server error" });
  }
};
