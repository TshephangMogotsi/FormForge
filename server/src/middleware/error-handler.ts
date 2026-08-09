import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AppError } from "../lib/app-error.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No route matches ${request.method} ${request.path}.`,
      requestId: request.requestId
    }
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (
    typeof error === "object" &&
    error !== null &&
    (("type" in error && error.type === "entity.too.large") ||
      ("status" in error && error.status === 413))
  ) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the 100 KB limit.",
        requestId: request.requestId
      }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId: request.requestId
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The submitted data is invalid.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })),
        requestId: request.requestId
      }
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The submitted identifier is invalid.",
        requestId: request.requestId
      }
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    response.status(409).json({
      error: {
        code: "RESOURCE_CONFLICT",
        message: "A resource with these details already exists.",
        requestId: request.requestId
      }
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "request.failed",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Unknown error"
    })
  );

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong.",
      requestId: request.requestId
    }
  });
};
