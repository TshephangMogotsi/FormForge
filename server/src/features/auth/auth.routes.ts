import type { CookieOptions } from "express";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  createRateLimiter,
  rateLimitPolicies
} from "../../middleware/rate-limit.js";
import { authCookieName } from "./auth.constants.js";
import {
  changeEmailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from "./auth.schemas.js";
import { requireAuthentication } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import { safeOAuthReturnTo, SocialOAuthFlow } from "./social-oauth.flow.js";
import type { SocialOAuthProvider } from "./social-oauth.provider.js";

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000
};

const socialStartSchema = z.object({ returnTo: z.string().max(200).optional() }).passthrough();
const socialCallbackSchema = z
  .object({
    code: z.string().min(1).max(2_048).optional(),
    state: z.string().min(20).max(200).optional(),
    error: z.string().max(200).optional()
  })
  .passthrough();

function socialCookieNames(provider: string) {
  const prefix = `formforge_${provider}_oauth`;
  return {
    state: `${prefix}_state`,
    nonce: `${prefix}_nonce`,
    verifier: `${prefix}_verifier`,
    returnTo: `${prefix}_return_to`
  };
}

function socialCookieOptions(provider: string): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/v1/auth/${provider}`,
    maxAge: 10 * 60 * 1000
  };
}

function socialErrorReturnTo(returnTo: string, error: string): string {
  const url = new URL(safeOAuthReturnTo(returnTo), env.PUBLIC_APP_ORIGIN);
  url.searchParams.set("oauthError", error);
  return `${url.pathname}${url.search}`;
}

export function createAuthRouter(
  authService: AuthService,
  socialProviders: SocialOAuthProvider[] = []
) {
  const router = Router();
  const credentialLimiter = createRateLimiter(rateLimitPolicies.credentials);
  const recoveryLimiter = createRateLimiter(rateLimitPolicies.passwordRecovery);
  const verificationLimiter = createRateLimiter(rateLimitPolicies.emailVerification);

  router.get("/providers", (_request, response) => {
    const enabled = new Set(socialProviders.map((provider) => provider.name));
    response.json({
      data: {
        providers: {
          google: enabled.has("google"),
          facebook: enabled.has("facebook")
        }
      }
    });
  });

  for (const provider of socialProviders) {
    const flow = new SocialOAuthFlow(provider);
    const names = socialCookieNames(provider.name);
    const cookieOptions = socialCookieOptions(provider.name);

    router.get(
      `/${provider.name}`,
      credentialLimiter,
      asyncHandler(async (request, response) => {
        const input = socialStartSchema.parse(request.query);
        const { url, transient } = flow.start(input.returnTo);
        response.cookie(names.state, transient.state, cookieOptions);
        response.cookie(names.nonce, transient.nonce, cookieOptions);
        response.cookie(names.verifier, transient.codeVerifier, cookieOptions);
        response.cookie(names.returnTo, transient.returnTo, cookieOptions);
        response.redirect(url);
      })
    );

    router.get(
      `/${provider.name}/callback`,
      credentialLimiter,
      asyncHandler(async (request, response) => {
        const input = socialCallbackSchema.parse(request.query);
        const transient = {
          state: String(request.cookies[names.state] ?? ""),
          nonce: String(request.cookies[names.nonce] ?? ""),
          codeVerifier: String(request.cookies[names.verifier] ?? ""),
          returnTo: safeOAuthReturnTo(request.cookies[names.returnTo])
        };
        const clearOptions = { ...cookieOptions, maxAge: undefined };
        response.clearCookie(names.state, clearOptions);
        response.clearCookie(names.nonce, clearOptions);
        response.clearCookie(names.verifier, clearOptions);
        response.clearCookie(names.returnTo, clearOptions);

        if (!input.state || !transient.state) {
          throw new AppError(
            400,
            "INVALID_OAUTH_STATE",
            "The social sign-in request expired or was invalid."
          );
        }
        flow.validateState(input.state, transient.state);
        if (input.error) {
          response.redirect(socialErrorReturnTo(transient.returnTo, `${provider.name}_cancelled`));
          return;
        }
        if (!input.code || !transient.nonce || !transient.codeVerifier) {
          throw new AppError(400, "INVALID_OAUTH_CALLBACK", "The social sign-in response was incomplete.");
        }

        try {
          const profile = await flow.complete(input.code, input.state, transient);
          const result = await authService.authenticateSocial(profile);
          response.cookie(authCookieName, result.token, authCookieOptions);
          response.redirect(303, transient.returnTo);
        } catch (error) {
          if (error instanceof AppError && error.code === "INVALID_OAUTH_STATE") throw error;
          const code = error instanceof AppError ? error.code.toLowerCase() : `${provider.name}_failed`;
          response.redirect(303, socialErrorReturnTo(transient.returnTo, code));
        }
      })
    );
  }

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
    "/email-verification",
    requireAuthentication(authService),
    verificationLimiter,
    asyncHandler(async (request, response) => {
      const result = await authService.requestEmailVerification(request.auth!.userId);
      response.status(result.alreadyVerified ? 200 : 202).json({
        data: {
          user: result.user,
          message: result.alreadyVerified
            ? "Your email is already verified."
            : "A new verification link has been sent."
        }
      });
    })
  );

  router.post(
    "/verify-email",
    verificationLimiter,
    asyncHandler(async (request, response) => {
      const input = verifyEmailSchema.parse(request.body);
      await authService.verifyEmail(input.token);
      response.json({ data: { verified: true } });
    })
  );

  router.patch(
    "/email",
    requireAuthentication(authService),
    verificationLimiter,
    asyncHandler(async (request, response) => {
      const input = changeEmailSchema.parse(request.body);
      const user = await authService.changeEmail(request.auth!.userId, input);
      response.json({
        data: { user, message: "Email updated. A new verification link has been sent." }
      });
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
