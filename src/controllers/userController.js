import { User } from "../models/userModel.js";

import { consoleError } from "../utils/helpers/consoleError.js";

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    // console.log(users);
    if (users.length < 1) {
      return res.status(404).json({
        success: true,
        msg: "No users found",
        data: users || [],
      });
    }
    res.status(200).json({
      success: true,
      msg: "Users fetched successfully",
      data: users || [],
    });
  } catch (error) {
    consoleError("fetching users");
    console.log(error);
    res.status(500).json({
      success: false,
      msg: "Internal server error",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, msg: "User found", user });
  } catch (error) {
    consoleError("fetching userByid", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
