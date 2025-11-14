import mongoose, { Schema } from "mongoose";

// itemized entries within a bill (optional)
const itemSchema = new Schema(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    involved: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  },
  { _id: false }
);

// flexible split entries (who owes whom and how much)
const splitSchema = new Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const billSchema = new Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    category: {
      type: String,
      enum: ["general", "food", "grocery", "travel", "party", "books", "utilities", "rent", "other"],
      default: "general",
    },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    involved: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // who is included in the split (subset of participants)
    splitType: { type: String, enum: ["equal", "unequal", "shares", "itemized", "custom"], required: true },
    // optional per-user share definition for unequal/shares splits
    shares: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        amount: { type: Number }, // for unequal exact amounts
        weight: { type: Number }, // for share/ratio based splits
      },
    ],
    items: [itemSchema],
    splitDetails: [splitSchema],
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

billSchema.index({ group: 1, createdAt: -1 });

export const Bill = mongoose.model("Bill", billSchema);
