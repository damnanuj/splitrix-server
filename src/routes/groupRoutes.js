import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
} from "../controllers/groupController.js";

const router = express.Router();

router.post("/", isAuthenticated, createGroup);
router.get("/mine", isAuthenticated, getMyGroups);
router.get("/:groupId", isAuthenticated, getGroupDetails);

export default router;
