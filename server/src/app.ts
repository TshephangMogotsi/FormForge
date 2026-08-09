import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { createAuthRouter } from "./features/auth/auth.routes.js";
import { AuthService } from "./features/auth/auth.service.js";
import {
  DisabledEmailVerificationNotifier
} from "./features/auth/email-verification.notifier.js";
import { MongooseEmailVerificationRepository } from "./features/auth/email-verification.repository.js";
import { EmailVerificationService } from "./features/auth/email-verification.service.js";
import {
  DisabledPasswordResetNotifier
} from "./features/auth/password-reset.notifier.js";
import { MongoosePasswordResetRepository } from "./features/auth/password-reset.repository.js";
import { PasswordResetService } from "./features/auth/password-reset.service.js";
import { MongooseSessionRepository } from "./features/auth/session.repository.js";
import { SessionService } from "./features/auth/session.service.js";
import { SesPasswordResetNotifier } from "./features/auth/ses-password-reset.notifier.js";
import { SesEmailVerificationNotifier } from "./features/auth/ses-email-verification.notifier.js";
import { MongooseUserRepository } from "./features/auth/user.repository.js";
import { GoogleOAuthProvider } from "./features/auth/google-oauth.provider.js";
import { FacebookOAuthProvider } from "./features/auth/facebook-oauth.provider.js";
import type { SocialOAuthProvider } from "./features/auth/social-oauth.provider.js";
import { MongooseFormRepository } from "./features/forms/form.repository.js";
import { createFormRouter } from "./features/forms/form.routes.js";
import { FormService } from "./features/forms/form.service.js";
import { createPublicFormRouter } from "./features/forms/public-form.routes.js";
import { MongooseFunnelRepository } from "./features/funnel/funnel.repository.js";
import { createFunnelRouter } from "./features/funnel/funnel.routes.js";
import { FunnelService } from "./features/funnel/funnel.service.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createRateLimiter, rateLimitPolicies } from "./middleware/rate-limit.js";
import { requestContext } from "./middleware/request-context.js";
import {
  createHealthRouter,
  type DatabaseReadinessCheck
} from "./routes/health.route.js";

export type AppServices = {
  auth: AuthService;
  forms: FormService;
  funnel: FunnelService;
  socialOAuthProviders: SocialOAuthProvider[];
};

export type AppOptions = {
  corsOrigin?: string | false;
  databaseReadinessCheck?: DatabaseReadinessCheck;
};

const clientDistPath = fileURLToPath(new URL("../../client/dist", import.meta.url));

function createDefaultServices(): AppServices {
  const passwordResetNotifier = env.PASSWORD_RESET_FROM_EMAIL
    ? new SesPasswordResetNotifier(env.PASSWORD_RESET_FROM_EMAIL)
    : new DisabledPasswordResetNotifier();
  const emailVerificationNotifier = env.PASSWORD_RESET_FROM_EMAIL
    ? new SesEmailVerificationNotifier(env.PASSWORD_RESET_FROM_EMAIL)
    : new DisabledEmailVerificationNotifier();

  const socialOAuthProviders: SocialOAuthProvider[] = [];
  if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
    socialOAuthProviders.push(
      new GoogleOAuthProvider(
        env.GOOGLE_OAUTH_CLIENT_ID,
        env.GOOGLE_OAUTH_CLIENT_SECRET,
        new URL("/api/v1/auth/google/callback", env.PUBLIC_APP_ORIGIN).toString()
      )
    );
  }
  if (env.FACEBOOK_OAUTH_ENABLED && env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
    socialOAuthProviders.push(
      new FacebookOAuthProvider(
        env.FACEBOOK_APP_ID,
        env.FACEBOOK_APP_SECRET,
        new URL("/api/v1/auth/facebook/callback", env.PUBLIC_APP_ORIGIN).toString(),
        env.FACEBOOK_GRAPH_API_VERSION
      )
    );
  }

  return {
    auth: new AuthService(
      new MongooseUserRepository(),
      new SessionService(new MongooseSessionRepository()),
      new PasswordResetService(
        new MongoosePasswordResetRepository(),
        passwordResetNotifier,
        env.PUBLIC_APP_ORIGIN,
        env.PASSWORD_RESET_TTL_MINUTES
      ),
      new EmailVerificationService(
        new MongooseEmailVerificationRepository(),
        emailVerificationNotifier,
        env.PUBLIC_APP_ORIGIN,
        env.EMAIL_VERIFICATION_TTL_MINUTES
      )
    ),
    forms: new FormService(new MongooseFormRepository(), {
      maxFormsPerOwner: env.TRIAL_MAX_FORMS_PER_ACCOUNT,
      maxPublishedFormsPerOwner: env.TRIAL_MAX_PUBLISHED_FORMS_PER_ACCOUNT
    }),
    funnel: new FunnelService(new MongooseFunnelRepository()),
    socialOAuthProviders
  };
}

export function createApp(
  services = createDefaultServices(),
  options: AppOptions = {}
) {
  const app = express();
  const corsOrigin =
    options.corsOrigin ??
    (env.NODE_ENV === "production" ? false : env.CLIENT_ORIGIN);

  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  if (corsOrigin) {
    app.use(
      cors({
        origin: corsOrigin,
        credentials: true
      })
    );
  }
  app.use(requestContext);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(
    "/api/health",
    createHealthRouter(options.databaseReadinessCheck)
  );
  app.use("/api", createRateLimiter(rateLimitPolicies.api));
  app.use("/api/v1/auth", createAuthRouter(services.auth, services.socialOAuthProviders));
  app.use("/api/v1/forms", createFormRouter(services.auth, services.forms));
  app.use("/api/v1/public/forms", createPublicFormRouter(services.forms));
  app.use("/api/v1/events", createFunnelRouter(services.funnel));

  if (env.NODE_ENV === "production") {
    app.use(
      express.static(clientDistPath, {
        index: false,
        maxAge: "1h"
      })
    );
    app.use((request, response, next) => {
      const isClientNavigation =
        request.method === "GET" &&
        !request.path.startsWith("/api/") &&
        Boolean(request.accepts("html"));

      if (!isClientNavigation) {
        next();
        return;
      }

      response.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
