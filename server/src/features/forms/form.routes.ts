import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuthentication } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  createFormSchema,
  formIdSchema,
  listFormsQuerySchema,
  listSubmissionsQuerySchema,
  updateFormSchema
} from "./form.schemas.js";
import type { FormService } from "./form.service.js";

export function createFormRouter(authService: AuthService, formService: FormService) {
  const router = Router();

  router.use(requireAuthentication(authService));

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      const { page, limit } = listFormsQuerySchema.parse(request.query);
      const result = await formService.list(request.auth!.userId, page, limit);
      response.json({
        data: {
          forms: result.items,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: Math.ceil(result.total / result.limit)
          }
        }
      });
    })
  );

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const input = createFormSchema.parse(request.body);
      const form = await formService.create(request.auth!.userId, input);
      response.status(201).json({ data: { form } });
    })
  );

  router.post(
    "/:formId/duplicate",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const form = await formService.duplicate(request.auth!.userId, formId);
      response.status(201).json({ data: { form } });
    })
  );

  router.get(
    "/analytics",
    asyncHandler(async (request, response) => {
      const analytics = await formService.getOwnerAnalytics(request.auth!.userId);
      response.json({ data: { analytics } });
    })
  );

  router.get(
    "/:formId/submissions",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const { page, limit } = listSubmissionsQuerySchema.parse(request.query);
      const result = await formService.listSubmissions(
        request.auth!.userId,
        formId,
        page,
        limit
      );
      response.json({
        data: {
          submissions: result.items,
          versions: result.versions,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: Math.ceil(result.total / result.limit)
          }
        }
      });
    })
  );

  router.get(
    "/:formId/analytics",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const analytics = await formService.getAnalytics(request.auth!.userId, formId);
      response.json({ data: { analytics } });
    })
  );

  router.get(
    "/:formId",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const form = await formService.get(request.auth!.userId, formId);
      response.json({ data: { form } });
    })
  );

  router.patch(
    "/:formId",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const input = updateFormSchema.parse(request.body);
      const form = await formService.update(request.auth!.userId, formId, input);
      response.json({ data: { form } });
    })
  );

  router.post(
    "/:formId/publish",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      const result = await formService.publish(request.auth!.userId, formId);
      response.status(201).json({ data: result });
    })
  );

  router.delete(
    "/:formId",
    asyncHandler(async (request, response) => {
      const formId = formIdSchema.parse(request.params.formId);
      await formService.delete(request.auth!.userId, formId);
      response.status(204).end();
    })
  );

  return router;
}
