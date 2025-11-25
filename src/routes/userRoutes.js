import express from "express";
import {
  getUserById,
  getUsers,
  addFriend,
  listFriends,
  removeFriend,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = express.Router();

router.get("/", isAuthenticated, getUsers);
router.get("/:id", isAuthenticated, getUserById);
router.post("/friends", isAuthenticated, addFriend);
router.get("/friends/list", isAuthenticated, listFriends);
router.delete("/friends/remove/:id", isAuthenticated, removeFriend);

export default router;
