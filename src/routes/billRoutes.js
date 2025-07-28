import express from "express";
import { createBill } from "../controllers/billController.js";

const router = express.Router();

router.post("/", createBill);

export default router;
