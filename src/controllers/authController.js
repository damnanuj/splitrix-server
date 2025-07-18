import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export default async function login({ email, password }) {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return {
      token,
      user: user,
    };
  } catch (error) {
    console.error("Login controller error:", error.message);
    throw new Error("Login failed");
  }
}
