import mongoose from "mongoose";
import { ENV } from "../utils/env/env.js";

// Serverless-safe MongoDB connection caching
// Uses global.mongoose to persist connection across serverless function invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connects to MongoDB Atlas with serverless-safe connection pooling.
 * Uses a cached connection to prevent multiple connection attempts.
 * 
 * @returns {Promise<mongoose.Connection>} The MongoDB connection
 */
export const connectMongoDb = async () => {
  // Check if mongoose is already connected (readyState: 1 = connected)
  // readyState values: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress (readyState: 2), wait for existing promise
  if (mongoose.connection.readyState === 2 && cached.promise) {
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (error) {
      cached.promise = null;
      // Fall through to create a new connection
    }
  }

  // If there's already a connection promise in progress, wait for it
  // This handles concurrent requests during cold starts
  if (cached.promise) {
    try {
      cached.conn = await cached.promise;
      // Verify the connection is still valid
      if (mongoose.connection.readyState === 1) {
        return cached.conn;
      }
      // Connection promise resolved but connection is dead, clear it
      cached.promise = null;
      cached.conn = null;
    } catch (error) {
      // If connection failed, clear the promise so we can retry
      cached.promise = null;
      cached.conn = null;
      throw error;
    }
  }

  // Clear any stale cached connection if mongoose is disconnected
  if (cached.conn && mongoose.connection.readyState === 0) {
    cached.conn = null;
  }

  // Create a new connection promise (don't await it yet - let concurrent requests share it)
  if (!ENV.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  cached.promise = mongoose
    .connect(ENV.MONGO_URI, {
      bufferCommands: false, // Disable mongoose buffering for serverless
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    })
    .then((mongoose) => {
      console.log("MongoDB Connected ✅");
      cached.conn = mongoose.connection;
      return cached.conn;
    })
    .catch((error) => {
      // Clear promise on error so we can retry
      cached.promise = null;
      cached.conn = null;
      console.error("MongoDB connection error:", error);
      throw error;
    });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
};
