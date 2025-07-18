import express from "express";
const app = express();
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 8000;

// app.get("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on PORT = ${PORT}`);
});
