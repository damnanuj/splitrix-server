import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "invite_sent",
        "invite_accepted",
        "invite_declined",
        "group_joined",
        "bill_added",
        "settlement_made",
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


