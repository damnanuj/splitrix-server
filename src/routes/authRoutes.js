import express from "express";
import {
  handleGoogleAuth,
  login,
  signup,
  demoController,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", handleGoogleAuth);
router.get("/demo", demoController);

export default router;
