import mongoose, { Schema } from "mongoose";

const SettlementSchema = new Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
    billRef: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
  },
  { timestamps: true }
);

SettlementSchema.index({ group: 1, from: 1, to: 1, createdAt: -1 });

export const Settlement = mongoose.model("Settlement", SettlementSchema);


