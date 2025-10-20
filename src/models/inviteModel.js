import mongoose, { Schema } from "mongoose";

const InviteSchema = new Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invitedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "expired"], default: "pending" },
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

InviteSchema.index({ group: 1, invitedUser: 1 }, { unique: true });

export const Invite = mongoose.model("Invite", InviteSchema);


