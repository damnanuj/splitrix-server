import mongoose from "mongoose";

export const connectMongoDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDb Connected`);
  } catch (error) {
    console.log(`MongoDb connection failed : ${error.message}`);
    process.exit(1);
  }
};
