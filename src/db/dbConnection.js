import mongoose from "mongoose";
import { ENV } from "../utils/env/env.js";

export const connectMongoDb = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log(`MongoDb Connected`);
  } catch (error) {
    console.log(`MongoDb connection failed : ${error.message}`);
    process.exit(1);
  }
};
