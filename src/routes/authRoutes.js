import express from "express";
import login from "../controllers/authController.js";
import { consoleError } from "../utils/helpers/consoleError.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await login({ email, password });

    if (!result) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    consoleError("logging");
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
