import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { getGroupBalances, getMyBalances } from "../controllers/balanceController.js";

const router = express.Router();

router.get("/group/:groupId", isAuthenticated, getGroupBalances);
router.get("/me", isAuthenticated, getMyBalances);

export default router;


