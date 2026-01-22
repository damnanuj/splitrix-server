import { connectMongoDb } from "../db/dbConnection.js";

/**
 * Middleware to ensure MongoDB connection is established before handling the request.
 * This is critical for serverless environments where connections may not persist.
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const ensureDbConnection = async (req, res, next) => {
  try {
    await connectMongoDb();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    return res.status(503).json({
      success: false,
      msg: "Database connection failed. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
