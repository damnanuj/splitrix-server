import express from "express";
import {
  handleGoogleAuth,
  login,
  signup,
  demoController,
} from "../controllers/authController.js";
import { ensureDbConnection } from "../middleware/ensureDbConnection.js";

const router = express.Router();

// Ensure DB connection for all auth routes (especially critical for Google OAuth)
router.use(ensureDbConnection);

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", handleGoogleAuth);
router.get("/demo", demoController);

export default router;
