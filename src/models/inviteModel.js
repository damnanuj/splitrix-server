import mongoose, { Schema } from "mongoose";
import { isValidObjectId } from "mongoose";

const InvitedUserSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
    },
  },
  { _id: false }
);

const InviteSchema = new Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      unique: true, // One invite per group
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedUsers: [InvitedUserSchema], // Array of { userId, status }
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index for finding invites by user (using dot notation for nested field)
InviteSchema.index({ "invitedUsers.userId": 1 });

InviteSchema.pre("validate", function (next) {
  // Validate all invitedUsers have valid ObjectIds
  if (this.invitedUsers && Array.isArray(this.invitedUsers)) {
    for (const invitedUser of this.invitedUsers) {
      if (!invitedUser.userId || !isValidObjectId(invitedUser.userId)) {
        return next(new Error(`Invalid invitedUser userId: ${invitedUser.userId}`));
      }
    }
  }
  if (!isValidObjectId(this.group)) {
    return next(new Error("Invalid group ObjectId"));
  }
  next();
});

export const Invite = mongoose.model("Invite", InviteSchema);
