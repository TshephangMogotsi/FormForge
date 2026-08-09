import { z } from "zod";
import { AppError } from "../../lib/app-error.js";
import type {
  SocialAuthorizationInput,
  SocialCodeInput,
  SocialOAuthProvider,
  SocialProfile
} from "./social-oauth.provider.js";

const tokenSchema = z.object({ access_token: z.string().min(1) }).passthrough();
const profileSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(254)
});

export class FacebookOAuthProvider implements SocialOAuthProvider {
  readonly name = "facebook" as const;

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly redirectUri: string,
    private readonly graphVersion = "v25.0"
  ) {}

  authorizationUrl(input: SocialAuthorizationInput): string {
    const query = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "public_profile,email",
      state: input.state
    });
    return `https://www.facebook.com/${this.graphVersion}/dialog/oauth?${query.toString()}`;
  }

  async exchangeCode(input: SocialCodeInput): Promise<SocialProfile> {
    const tokenUrl = new URL(`https://graph.facebook.com/${this.graphVersion}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code: input.code
    }).toString();

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(8_000) });
    } catch {
      throw new AppError(502, "SOCIAL_AUTH_UNAVAILABLE", "Facebook sign-in is temporarily unavailable.");
    }
    const token = tokenSchema.safeParse(await tokenResponse.json());
    if (!tokenResponse.ok || !token.success) {
      throw new AppError(401, "SOCIAL_AUTH_FAILED", "Facebook could not verify this sign-in.");
    }

    const profileUrl = new URL(`https://graph.facebook.com/${this.graphVersion}/me`);
    profileUrl.search = new URLSearchParams({ fields: "id,name,email" }).toString();
    let profileResponse: Response;
    try {
      profileResponse = await fetch(profileUrl, {
        headers: { authorization: `Bearer ${token.data.access_token}` },
        signal: AbortSignal.timeout(8_000)
      });
    } catch {
      throw new AppError(502, "SOCIAL_AUTH_UNAVAILABLE", "Facebook sign-in is temporarily unavailable.");
    }
    const profile = profileSchema.safeParse(await profileResponse.json());
    if (!profileResponse.ok || !profile.success) {
      throw new AppError(
        401,
        "SOCIAL_EMAIL_REQUIRED",
        "Facebook must share an email address to create a FormForge account."
      );
    }

    const name = profile.data.name?.slice(0, 80) || "FormForge User";
    return {
      provider: "facebook",
      subject: profile.data.id,
      email: profile.data.email.toLowerCase(),
      emailVerified: false,
      name: name.length >= 2 ? name : "FormForge User"
    };
  }
}
