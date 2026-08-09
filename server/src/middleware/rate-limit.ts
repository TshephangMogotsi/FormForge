import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

type RateLimitPolicy = {
  windowMs: number;
  limit: number;
};

export const rateLimitPolicies = {
  api: { windowMs: 60_000, limit: 180 },
  credentials: { windowMs: 15 * 60_000, limit: 20 },
  passwordRecovery: { windowMs: 15 * 60_000, limit: 5 },
  publicSubmissions: { windowMs: 60_000, limit: 20 }
} as const satisfies Record<string, RateLimitPolicy>;

export function createRateLimiter(policy: RateLimitPolicy) {
  return rateLimit({
    ...policy,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (request: Request, response: Response) => {
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again later.",
          requestId: request.requestId
        }
      });
    }
  });
}
