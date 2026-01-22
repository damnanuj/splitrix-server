import express from "express";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
  getBalancesSummaryForUser,
  addMembersToGroup,
} from "../controllers/groupController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all group routes
router.use(ensureDbConnection);

router.post("/", isAuthenticated, createGroup);
router.get("/mine", isAuthenticated, getMyGroups);
router.get(
  "/balances-summary/:groupId",
  isAuthenticated,
  getBalancesSummaryForUser
);
router.put("/add-members/:groupId", isAuthenticated, addMembersToGroup);
router.get("/:groupId", isAuthenticated, getGroupDetails);

export default router;
