import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import { createSettlement, getGroupSettlements } from "../controllers/settlementController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all settlement routes
router.use(ensureDbConnection);

router.post("/", isAuthenticated, createSettlement);
router.get("/group/:groupId", isAuthenticated, getGroupSettlements);

export default router;


