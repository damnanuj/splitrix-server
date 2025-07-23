import express from "express";
import {
  handleGoogleAuth,
  login,
  signup,
} from "../controllers/authController.js";
import { consoleError } from "../utils/helpers/consoleError.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", handleGoogleAuth);

export default router;
