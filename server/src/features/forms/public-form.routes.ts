import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  createRateLimiter,
  rateLimitPolicies
} from "../../middleware/rate-limit.js";
import {
  abuseReportSchema,
  createSubmissionSchema,
  publicFormSlugSchema
} from "./form.schemas.js";
import type { FormService } from "./form.service.js";

export function createPublicFormRouter(formService: FormService) {
  const router = Router();

  router.get(
    "/:slug",
    asyncHandler(async (request, response) => {
      const slug = publicFormSlugSchema.parse(request.params.slug);
      const form = await formService.getPublic(slug);
      response.json({ data: { form } });
    })
  );

  router.post(
    "/:slug/submissions",
    createRateLimiter(rateLimitPolicies.publicSubmissions),
    asyncHandler(async (request, response) => {
      const slug = publicFormSlugSchema.parse(request.params.slug);
      const input = createSubmissionSchema.parse(request.body);
      const submission = await formService.submit(slug, input);
      response.status(201).json({
        data: {
          submission: {
            id: submission.id,
            formVersion: submission.formVersion,
            submittedAt: submission.createdAt
          }
        }
      });
    })
  );

  router.post(
    "/:slug/reports",
    createRateLimiter(rateLimitPolicies.abuseReports),
    asyncHandler(async (request, response) => {
      const slug = publicFormSlugSchema.parse(request.params.slug);
      const input = abuseReportSchema.parse(request.body);
      const report = await formService.reportAbuse(slug, input);
      response.status(201).json({
        data: { report: { id: report.id, submittedAt: report.createdAt } }
      });
    })
  );

  return router;
}
