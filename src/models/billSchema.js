import mongoose, { Schema } from "mongoose";

const splitSchema = new Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // who owes
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // who is owed
  amount: { type: Number, required: true },
});

const billSchema = new Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    group: { type: String, required: true },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    splitDetails: [splitSchema], // details of who owes whom and how much
  },
  { timestamps: true }
);

export const Bill = mongoose.model("Bill", billSchema);
