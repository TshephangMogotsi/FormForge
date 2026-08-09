import type { CookieOptions } from "express";
import { Router } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  createRateLimiter,
  rateLimitPolicies
} from "../../middleware/rate-limit.js";
import { authCookieName } from "./auth.constants.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000
};

export function createAuthRouter(authService: AuthService) {
  const router = Router();
  const credentialLimiter = createRateLimiter(rateLimitPolicies.credentials);
  const recoveryLimiter = createRateLimiter(rateLimitPolicies.passwordRecovery);

  router.post(
    "/register",
    credentialLimiter,
    asyncHandler(async (request, response) => {
      const input = registerSchema.parse(request.body);
      const result = await authService.register(input);

      response.cookie(authCookieName, result.token, authCookieOptions);
      response.status(201).json({ data: { user: result.user } });
    })
  );

  router.post(
    "/login",
    credentialLimiter,
    asyncHandler(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);

      response.cookie(authCookieName, result.token, authCookieOptions);
      response.json({ data: { user: result.user } });
    })
  );

  router.post(
    "/forgot-password",
    recoveryLimiter,
    asyncHandler(async (request, response) => {
      const input = forgotPasswordSchema.parse(request.body);
      await authService.requestPasswordReset(input);

      response.status(202).json({
        data: {
          message: "If an account exists for that email, a reset link has been sent."
        }
      });
    })
  );

  router.post(
    "/reset-password",
    recoveryLimiter,
    asyncHandler(async (request, response) => {
      const input = resetPasswordSchema.parse(request.body);
      await authService.resetPassword(input);

      response.clearCookie(authCookieName, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
      response.status(204).end();
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const token = request.cookies[authCookieName] as string | undefined;
      if (token) await authService.logout(token);

      response.clearCookie(authCookieName, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
      response.status(204).end();
    })
  );

  router.get(
    "/me",
    asyncHandler(async (request, response) => {
      const token = request.cookies[authCookieName] as string | undefined;
      if (!token) {
        throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
      }

      const user = await authService.authenticate(token);
      response.json({ data: { user } });
    })
  );

  return router;
}
