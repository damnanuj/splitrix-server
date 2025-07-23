import express from "express";
import { consoleError } from "../utils/helpers/consoleError.js";
import { getUserById, getUsers } from "../controllers/userController.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";

const router = express.Router();

router.get("/", isAuthenticated, getUsers);
router.get("/:id", getUserById);

export default router;
