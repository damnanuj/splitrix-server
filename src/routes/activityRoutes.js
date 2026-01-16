import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getGroupActivities, getAllUserActivities } from "../controllers/activityController.js";

const router = express.Router();

router.get("/group/:groupId", isAuthenticated, getGroupActivities);
router.get("/me", isAuthenticated, getAllUserActivities);

export default router;

