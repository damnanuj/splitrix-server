import express from "express";
import {
  getUserById,
  getUsers,
  addFriend,
  listFriends,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = express.Router();

router.get("/", isAuthenticated, getUsers);
router.get("/:id", isAuthenticated, getUserById);
router.post("/friends", isAuthenticated, addFriend);
router.get("/friends/list", isAuthenticated, listFriends);

export default router;
