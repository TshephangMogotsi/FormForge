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
  DisabledPasswordResetNotifier
} from "./features/auth/password-reset.notifier.js";
import { MongoosePasswordResetRepository } from "./features/auth/password-reset.repository.js";
import { PasswordResetService } from "./features/auth/password-reset.service.js";
import { MongooseSessionRepository } from "./features/auth/session.repository.js";
import { SessionService } from "./features/auth/session.service.js";
import { SesPasswordResetNotifier } from "./features/auth/ses-password-reset.notifier.js";
import { MongooseUserRepository } from "./features/auth/user.repository.js";
import { MongooseFormRepository } from "./features/forms/form.repository.js";
import { createFormRouter } from "./features/forms/form.routes.js";
import { FormService } from "./features/forms/form.service.js";
import { createPublicFormRouter } from "./features/forms/public-form.routes.js";
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

  return {
    auth: new AuthService(
      new MongooseUserRepository(),
      new SessionService(new MongooseSessionRepository()),
      new PasswordResetService(
        new MongoosePasswordResetRepository(),
        passwordResetNotifier,
        env.PUBLIC_APP_ORIGIN,
        env.PASSWORD_RESET_TTL_MINUTES
      )
    ),
    forms: new FormService(new MongooseFormRepository())
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
  app.use("/api/v1/auth", createAuthRouter(services.auth));
  app.use("/api/v1/forms", createFormRouter(services.auth, services.forms));
  app.use("/api/v1/public/forms", createPublicFormRouter(services.forms));

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
