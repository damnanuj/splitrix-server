import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { createGroup, getMyGroups, inviteToGroup, respondToInvite } from "../controllers/groupController.js";

const router = express.Router();

router.post("/", isAuthenticated, createGroup);
router.get("/mine", isAuthenticated, getMyGroups);
router.post("/invite", isAuthenticated, inviteToGroup);
router.post("/invite/respond", isAuthenticated, respondToInvite);

export default router;


