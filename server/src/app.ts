import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { createAuthRouter } from "./features/auth/auth.routes.js";
import { AuthService } from "./features/auth/auth.service.js";
import { MongooseSessionRepository } from "./features/auth/session.repository.js";
import { SessionService } from "./features/auth/session.service.js";
import { MongooseUserRepository } from "./features/auth/user.repository.js";
import { MongooseFormRepository } from "./features/forms/form.repository.js";
import { createFormRouter } from "./features/forms/form.routes.js";
import { FormService } from "./features/forms/form.service.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { healthRouter } from "./routes/health.route.js";

export type AppServices = {
  auth: AuthService;
  forms: FormService;
};

export type AppOptions = {
  corsOrigin?: string | false;
};

const clientDistPath = fileURLToPath(new URL("../../client/dist", import.meta.url));

function createDefaultServices(): AppServices {
  return {
    auth: new AuthService(
      new MongooseUserRepository(),
      new SessionService(new MongooseSessionRepository())
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
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false
    })
  );

  app.use("/api/health", healthRouter);
  app.use("/api/v1/auth", createAuthRouter(services.auth));
  app.use("/api/v1/forms", createFormRouter(services.auth, services.forms));

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
