import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { createBill, getGroupBills, getMyTransactions } from "../controllers/billController.js";

const router = express.Router();

router.post("/", isAuthenticated, createBill);
router.get("/group/:groupId", isAuthenticated, getGroupBills);
router.get("/my-transactions", isAuthenticated, getMyTransactions);

export default router;
