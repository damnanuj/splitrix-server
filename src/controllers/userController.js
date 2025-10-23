import { User } from "../models/userModel.js";
import { Bill } from "../models/billSchema.js";
import { Settlement } from "../models/settlementModel.js";
import { consoleError } from "../utils/helpers/consoleError.js";

export const getUsers = async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const users = await User.find({ _id: { $ne: currentUserId } });
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
      return res.status(404).json({ success: false, msg: "User not found" });
    }
    res.status(200).json({ success: true, msg: "User found", data: user });
  } catch (error) {
    consoleError("fetching userByid", error);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const addFriend = async (req, res) => {
  try {
    const me = req.user?.id;
    const { friendId } = req.body;
    if (!friendId)
      return res
        .status(400)
        .json({ success: false, msg: "friendId is required" });

    // Prevent adding yourself as friend
    if (String(me) === String(friendId)) {
      return res.status(400).json({
        success: false,
        msg: "You cannot add yourself as a friend",
      });
    }

    await User.updateOne({ _id: me }, { $addToSet: { friends: friendId } });
    await User.updateOne({ _id: friendId }, { $addToSet: { friends: me } });
    return res.status(200).json({ success: true, msg: "Friend added" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, msg: "Failed to add friend" });
  }
};

export const listFriends = async (req, res) => {
  try {
    const me = req.user?.id;
    const user = await User.findById(me).populate(
      "friends",
      "name email profilePicture"
    );
    const friends = user?.friends || [];

    // Calculate balances between me and each friend
    const friendsWithBalances = await Promise.all(
      friends.map(async (friend) => {
        const friendId = String(friend._id);
        const myId = String(me);

        // Get all bills where both me and friend are involved
        const bills = await Bill.find({
          $or: [
            {
              "splitDetails.from": { $in: [myId, friendId] },
              "splitDetails.to": { $in: [myId, friendId] },
            },
            {
              "splitDetails.from": { $in: [myId, friendId] },
              "splitDetails.to": { $in: [myId, friendId] },
            },
          ],
        });

        // Get all settlements between me and friend
        const settlements = await Settlement.find({
          $or: [
            { from: myId, to: friendId },
            { from: friendId, to: myId },
          ],
        });

        let netBalance = 0;

        // Calculate from bills
        for (const bill of bills) {
          for (const split of bill.splitDetails) {
            const fromId = String(split.from);
            const toId = String(split.to);

            if (fromId === myId && toId === friendId) {
              netBalance -= split.amount; // I owe friend
            } else if (fromId === friendId && toId === myId) {
              netBalance += split.amount; // Friend owes me
            }
          }
        }

        // Calculate from settlements
        for (const settlement of settlements) {
          const fromId = String(settlement.from);
          const toId = String(settlement.to);

          if (fromId === myId && toId === friendId) {
            netBalance -= settlement.amount; // I paid friend
          } else if (fromId === friendId && toId === myId) {
            netBalance += settlement.amount; // Friend paid me
          }
        }

        return {
          ...friend.toObject(),
          balance: {
            net: netBalance,
            status:
              netBalance > 0
                ? "friend_owes_me"
                : netBalance < 0
                ? "i_owe_friend"
                : "settled",
            amount: Math.abs(netBalance),
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      msg: "Friends fetched successfully",
      data: friendsWithBalances,
    });
  } catch (error) {
    consoleError("fetching friends", error);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch friends",
    });
  }
};
