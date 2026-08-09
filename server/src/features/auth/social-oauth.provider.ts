export type SocialProviderName = "google" | "facebook";

export type SocialProfile = {
  provider: SocialProviderName;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export type SocialAuthorizationInput = {
  state: string;
  nonce: string;
  codeChallenge: string;
};

export type SocialCodeInput = {
  code: string;
  nonce: string;
  codeVerifier: string;
};

export interface SocialOAuthProvider {
  readonly name: SocialProviderName;
  authorizationUrl(input: SocialAuthorizationInput): string;
  exchangeCode(input: SocialCodeInput): Promise<SocialProfile>;
}
