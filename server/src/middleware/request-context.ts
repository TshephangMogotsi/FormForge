import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

export const requestContext: RequestHandler = (request, response, next) => {
  const requestId = request.header("x-request-id")?.slice(0, 128) || randomUUID();
  const startedAt = performance.now();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  if (env.NODE_ENV !== "test") {
    response.on("finish", () => {
      console.info(
        JSON.stringify({
          level: "info",
          event: "request.completed",
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - startedAt)
        })
      );
    });
  }

  next();
};
