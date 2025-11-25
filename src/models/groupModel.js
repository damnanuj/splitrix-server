import mongoose, { Schema } from "mongoose";

const GroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    description: { type: String, default: "" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

// 🔥 Add indexes for fast lookups
GroupSchema.index({ members: 1 }); // find all groups a user is in
GroupSchema.index({ createdBy: 1 }); // find groups created by user
// Optional: for faster search by name
// GroupSchema.index({ name: 1 });

export const Group = mongoose.model("Group", GroupSchema);
