import { OAuth2Client } from "google-auth-library";
import { AppError } from "../../lib/app-error.js";
import type {
  SocialAuthorizationInput,
  SocialCodeInput,
  SocialOAuthProvider,
  SocialProfile
} from "./social-oauth.provider.js";

export class GoogleOAuthProvider implements SocialOAuthProvider {
  readonly name = "google" as const;
  private readonly verifier: OAuth2Client;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string
  ) {
    this.verifier = new OAuth2Client(clientId);
  }

  authorizationUrl(input: SocialAuthorizationInput): string {
    const query = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256"
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
  }

  async exchangeCode(input: SocialCodeInput): Promise<SocialProfile> {
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: input.code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code",
          code_verifier: input.codeVerifier
        }),
        signal: AbortSignal.timeout(8_000)
      });
    } catch {
      throw new AppError(502, "SOCIAL_AUTH_UNAVAILABLE", "Google sign-in is temporarily unavailable.");
    }

    const body = (await response.json()) as { id_token?: unknown };
    if (!response.ok || typeof body.id_token !== "string") {
      throw new AppError(401, "SOCIAL_AUTH_FAILED", "Google could not verify this sign-in.");
    }

    let payload;
    try {
      const ticket = await this.verifier.verifyIdToken({ idToken: body.id_token, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AppError(401, "SOCIAL_AUTH_FAILED", "Google could not verify this sign-in.");
    }

    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      payload.nonce !== input.nonce
    ) {
      throw new AppError(401, "SOCIAL_AUTH_FAILED", "Google did not return a verified identity.");
    }

    const name = payload.name?.trim().slice(0, 80) || "FormForge User";
    return {
      provider: "google",
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name: name.length >= 2 ? name : "FormForge User"
    };
  }
}
