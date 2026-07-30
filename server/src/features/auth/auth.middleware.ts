import type { RequestHandler } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { authCookieName } from "./auth.constants.js";
import type { AuthService } from "./auth.service.js";

export function requireAuthentication(authService: AuthService): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const token = request.cookies[authCookieName] as string | undefined;
    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const user = await authService.authenticate(token);
    request.auth = { userId: user.id };
    next();
  });
}
