import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  if (!env.MONGODB_URI) {
    console.warn("MONGODB_URI is not set; starting without a database connection.");
    return;
  }

  await mongoose.connect(env.MONGODB_URI, {
    ...(env.MONGODB_DATABASE ? { dbName: env.MONGODB_DATABASE } : {})
  });
  console.info("MongoDB connected.");
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
