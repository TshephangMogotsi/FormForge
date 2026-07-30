import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuthentication } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  createFormSchema,
  formIdSchema,
  listFormsQuerySchema,
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
