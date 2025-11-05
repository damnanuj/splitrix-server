import express from "express";
const app = express();
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import settlementRoutes from "./routes/settlementRoutes.js";
import balanceRoutes from "./routes/balanceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
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

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    msg: "Splitrix server is running",
  });
});

// app.listen(PORT, () => {
//   console.log(`Server is running on PORT = ${PORT}`);
//   connectMongoDb();
// });
connectMongoDb();

if (process.env.NODE_ENV !== "prod") {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running locally at http://localhost:${PORT}`);
  });
}

export default app;
