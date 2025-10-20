import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { createSettlement, getGroupSettlements } from "../controllers/settlementController.js";

const router = express.Router();

router.post("/", isAuthenticated, createSettlement);
router.get("/group/:groupId", isAuthenticated, getGroupSettlements);

export default router;


