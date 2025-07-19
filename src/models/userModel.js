import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name must be less than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    // username: {
    //   type: String,
    //   required: [true, "Username is required"],
    //   unique: true,
    //   trim: true,
    //   lowercase: true,
    //   minlength: [3, "Username must be at least 3 characters"],
    //   maxlength: [30, "Username must be less than 30 characters"],
    //   match: [
    //     /^[a-zA-Z0-9_]+$/,
    //     "Username can only contain letters, numbers, and underscores",
    //   ],
    // },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
