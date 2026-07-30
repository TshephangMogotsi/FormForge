import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
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

function createDefaultServices(): AppServices {
  return {
    auth: new AuthService(
      new MongooseUserRepository(),
      new SessionService(new MongooseSessionRepository())
    ),
    forms: new FormService(new MongooseFormRepository())
  };
}

export function createApp(services = createDefaultServices()) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true
    })
  );
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
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
