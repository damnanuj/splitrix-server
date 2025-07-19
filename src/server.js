import express from "express";
const app = express();
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cors from "cors";

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

app.listen(PORT, () => {
  console.log(`Server is running on PORT = ${PORT}`);
  connectMongoDb();
});
