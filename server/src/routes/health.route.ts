import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  const databaseState = mongoose.connection.readyState;
  response.json({
    status: "ok",
    service: "formforge-api",
    database: databaseState === 1 ? "connected" : "not-connected",
    timestamp: new Date().toISOString()
  });
});
