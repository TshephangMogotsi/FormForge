import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { createRateLimiter, rateLimitPolicies } from "../../middleware/rate-limit.js";
import { funnelEventSchema } from "./funnel.schemas.js";
import type { FunnelService } from "./funnel.service.js";

export function createFunnelRouter(funnel: FunnelService) {
  const router = Router();
  router.post(
    "/",
    createRateLimiter(rateLimitPolicies.funnelEvents),
    asyncHandler(async (request, response) => {
      const input = funnelEventSchema.parse(request.body);
      await funnel.record(input);
      response.status(202).end();
    })
  );
  return router;
}
