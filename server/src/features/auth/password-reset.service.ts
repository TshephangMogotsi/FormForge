import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import type { PasswordResetNotifier } from "./password-reset.notifier.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getDeliveryErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };

  return {
    ...(typeof candidate.name === "string" ? { errorName: candidate.name } : {}),
    ...(typeof candidate.code === "string" ? { errorCode: candidate.code } : {}),
    ...(typeof candidate.$metadata?.httpStatusCode === "number"
      ? { httpStatusCode: candidate.$metadata.httpStatusCode }
      : {})
  };
}

export class PasswordResetService {
  constructor(
    private readonly resets: PasswordResetRepository,
    private readonly notifier: PasswordResetNotifier,
    private readonly publicAppOrigin: string,
    private readonly ttlMinutes = 30
  ) {}

  async request(user: { id: string; name: string; email: string }): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    await this.resets.replaceForUser({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000)
    });

    const resetUrl = new URL("/", this.publicAppOrigin);
    resetUrl.searchParams.set("resetToken", token);

    try {
      await this.notifier.send({
        recipientName: user.name,
        recipientEmail: user.email,
        resetUrl: resetUrl.toString(),
        expiresInMinutes: this.ttlMinutes
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "password_reset.delivery_failed",
          ...getDeliveryErrorMetadata(error)
        })
      );
    }
  }

  async consume(token: string): Promise<string> {
    const userId = await this.resets.consumeValidToken(hashToken(token), new Date());
    if (!userId) {
      throw new AppError(
        400,
        "INVALID_RESET_TOKEN",
        "This password reset link is invalid or has expired."
      );
    }

    return userId;
  }
}
