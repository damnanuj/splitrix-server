import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "group_invite",
        "invite_accepted",
        "invite_declined",
        "invite_expired",
        "group_joined",
        "bill_added",
        "bill_updated",
        "bill_deleted",
        "settlement_made",
        "settlement_updated",
        "settlement_deleted",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", NotificationSchema);
