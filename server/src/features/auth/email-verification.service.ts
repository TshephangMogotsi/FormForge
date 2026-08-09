import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import type { EmailVerificationNotifier } from "./email-verification.notifier.js";
import type { EmailVerificationRepository } from "./email-verification.repository.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function deliveryErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") return {};
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

export class EmailVerificationService {
  constructor(
    private readonly verifications: EmailVerificationRepository,
    private readonly notifier: EmailVerificationNotifier,
    private readonly publicAppOrigin: string,
    private readonly ttlMinutes = 60
  ) {}

  async request(user: { id: string; name: string; email: string }): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    const verificationUrl = new URL("/verify-email", this.publicAppOrigin);
    verificationUrl.searchParams.set("token", token);
    try {
      await this.verifications.replaceForUser({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000)
      });
      await this.notifier.send({
        recipientName: user.name,
        recipientEmail: user.email,
        verificationUrl: verificationUrl.toString(),
        expiresInMinutes: this.ttlMinutes
      });
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "email_verification.delivery_failed",
        ...deliveryErrorMetadata(error)
      }));
    }
  }

  async consume(token: string): Promise<string> {
    const userId = await this.verifications.consumeValidToken(hashToken(token), new Date());
    if (!userId) {
      throw new AppError(
        400,
        "INVALID_VERIFICATION_TOKEN",
        "This verification link is invalid or has expired."
      );
    }
    return userId;
  }

  clear(userId: string): Promise<void> {
    return this.verifications.deleteForUser(userId);
  }
}
