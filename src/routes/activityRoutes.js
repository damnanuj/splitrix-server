import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getGroupActivities, getAllUserActivities } from "../controllers/activityController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all activity routes
router.use(ensureDbConnection);

router.get("/group/:groupId", isAuthenticated, getGroupActivities);
router.get("/me", isAuthenticated, getAllUserActivities);

export default router;

