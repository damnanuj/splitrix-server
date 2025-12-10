import mongoose, { Schema } from "mongoose";

// itemized entries within a bill (optional)
const itemSchema = new Schema(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    involved: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    // per-user share definition (frontend sends resolved amounts)
    shares: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: { type: Number, required: true }, // resolved amount owed
      },
    ],
    items: [itemSchema],
    splitDetails: [splitSchema],
  },
  {
    timestamps: true,
    versionKey: false, // avoid __v noisy field
  }
);

billSchema.index({ group: 1, createdAt: -1 });
billSchema.index({ createdBy: 1 });

export const Bill = mongoose.model("Bill", billSchema);
