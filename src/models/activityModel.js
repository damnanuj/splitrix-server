import mongoose, { Schema } from "mongoose";

const ActivitySchema = new Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "group_created",
        "group_invite",
        "invite_responded",
        "group_joined",
        "bill_added",
        "settlement_made",
        "settlement_updated",
        "settlement_deleted",
        "bill_updated",
        "bill_deleted",
      ],
      required: true,
    },
    summary: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ group: 1, createdAt: -1 });

export const Activity = mongoose.model("Activity", ActivitySchema);
