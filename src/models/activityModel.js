import mongoose, { Schema } from "mongoose";

const ActivitySchema = new Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["group_created", "invite_sent", "invite_responded", "bill_added", "settlement_made"],
      required: true,
    },
    summary: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ group: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", ActivitySchema);


