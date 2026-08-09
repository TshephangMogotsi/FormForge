import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import type { SocialOAuthProvider, SocialProfile } from "./social-oauth.provider.js";

export type SocialOAuthTransientState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function safeOAuthReturnTo(candidate: unknown): string {
  if (candidate === "/dashboard") return candidate;
  if (
    typeof candidate === "string" &&
    /^\/build\/new\?resume=(save|publish)$/.test(candidate)
  ) {
    return candidate;
  }
  return "/dashboard";
}

export class SocialOAuthFlow {
  constructor(private readonly provider: SocialOAuthProvider) {}

  start(returnTo: unknown): { url: string; transient: SocialOAuthTransientState } {
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const transient = { state, nonce, codeVerifier, returnTo: safeOAuthReturnTo(returnTo) };
    return {
      url: this.provider.authorizationUrl({ state, nonce, codeChallenge }),
      transient
    };
  }

  validateState(returnedState: string, expectedState: string): void {
    if (!safeEqual(returnedState, expectedState)) {
      throw new AppError(400, "INVALID_OAUTH_STATE", "The social sign-in request expired or was invalid.");
    }
  }

  async complete(
    code: string,
    returnedState: string,
    transient: SocialOAuthTransientState
  ): Promise<SocialProfile> {
    this.validateState(returnedState, transient.state);
    return this.provider.exchangeCode({
      code,
      nonce: transient.nonce,
      codeVerifier: transient.codeVerifier
    });
  }
}
