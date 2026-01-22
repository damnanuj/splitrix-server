import express from "express";
const app = express();
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import settlementRoutes from "./routes/settlementRoutes.js";
import balanceRoutes from "./routes/balanceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import cors from "cors";
import serverless from "serverless-http";
import { connectMongoDb } from "./db/dbConnection.js";
import { ENV } from "./utils/env/env.js";

const PORT = ENV.PORT || 8000;

app.use(express.json());

// app.use(
//   cors({
//     origin: ["*"],
//   })
// );

app.use(cors());

// app.get("/api/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/settlement", settlementRoutes);
app.use("/api/balance", balanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    msg: "Splitrix server is running",
  });
});

// For local development, connect to MongoDB on server start
// For serverless (Vercel), connection will be established lazily in route handlers
if (process.env.NODE_ENV !== "prod") {
  app.listen(PORT, async () => {
    console.log(`🚀 Server is running locally at http://localhost:${PORT}`);
    // Connect to MongoDB for local development
    try {
      await connectMongoDb();
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
    }
  });
}

export default app;
