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

export const addFriend = async (req, res) => {
  try {
    const me = req.user?.id;
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ success: false, message: "friendId is required" });
    await User.updateOne({ _id: me }, { $addToSet: { friends: friendId } });
    await User.updateOne({ _id: friendId }, { $addToSet: { friends: me } });
    return res.status(200).json({ success: true, message: "Friend added" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add friend" });
  }
};

export const listFriends = async (req, res) => {
  try {
    const me = req.user?.id;
    const user = await User.findById(me).populate("friends", "name email profilePicture");
    return res.status(200).json({ success: true, friends: user?.friends || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch friends" });
  }
};
