import mongoose, { Schema } from "mongoose";

const GroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    description: { type: String, default: "" },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Group = mongoose.model("Group", GroupSchema);


