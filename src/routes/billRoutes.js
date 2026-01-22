import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { createBill, getGroupBills, getMyTransactions, getMyRecentExpenses } from "../controllers/billController.js";

const router = express.Router();

router.post("/", isAuthenticated, createBill);
router.get("/group/:groupId", isAuthenticated, getGroupBills);
router.get("/my-transactions", isAuthenticated, getMyTransactions);
router.get("/my-recent-expenses", isAuthenticated, getMyRecentExpenses);

export default router;
