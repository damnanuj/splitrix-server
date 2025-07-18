import express from "express";
import { consoleError } from "../utils/helpers/consoleError.js";

const router = express.Router();

router.get("/", (req, res) => {
  try {
    res.status(200).json({
      success: true,
      msg: "User fetched successfully",
      data: [],
    });
  } catch (error) {
    consoleError("fetching users");
    res.status(500).json({
      success: true,
      msg: "Server error",
    });
  }
});

export default router;
