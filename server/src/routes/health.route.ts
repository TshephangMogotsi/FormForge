import { Router } from "express";
import mongoose from "mongoose";

export type DatabaseReadinessCheck = () => Promise<boolean>;

const serviceName = "formforge-api";

export async function checkDatabaseReadiness() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Database readiness timed out.")), 2_000);
        timeout.unref();
      })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function processHealth() {
  return {
    status: "ok",
    service: serviceName,
    timestamp: new Date().toISOString()
  };
}

export function createHealthRouter(
  databaseReadinessCheck: DatabaseReadinessCheck = checkDatabaseReadiness
) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      ...processHealth(),
      database: mongoose.connection.readyState === 1 ? "connected" : "not-connected"
    });
  });

  router.get("/live", (_request, response) => {
    response.json(processHealth());
  });

  router.get("/ready", async (_request, response) => {
    const databaseReady = await databaseReadinessCheck();
    response.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? "ready" : "not-ready",
      service: serviceName,
      dependencies: {
        database: databaseReady ? "ready" : "not-ready"
      },
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
