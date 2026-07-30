import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import type { SessionRepository } from "./session.repository.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly ttlHours = env.SESSION_TTL_HOURS
  ) {}

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.sessions.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlHours * 60 * 60 * 1000)
    });
    return token;
  }

  async verify(token: string): Promise<string> {
    const tokenHash = hashToken(token);
    const session = await this.sessions.findByTokenHash(tokenHash);

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) await this.sessions.deleteByTokenHash(tokenHash);
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    return session.userId;
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.deleteByTokenHash(hashToken(token));
  }
}
