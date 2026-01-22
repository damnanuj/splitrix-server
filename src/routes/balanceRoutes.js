import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getGroupBalances, getMyBalances } from "../controllers/balanceController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all balance routes
router.use(ensureDbConnection);

router.get("/group/:groupId", isAuthenticated, getGroupBalances);
router.get("/me", isAuthenticated, getMyBalances);

export default router;


