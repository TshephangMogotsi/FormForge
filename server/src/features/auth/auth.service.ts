import { compare, hash } from "bcryptjs";
import { AppError } from "../../lib/app-error.js";
import type {
  ChangeEmailInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput
} from "./auth.schemas.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { PasswordResetService } from "./password-reset.service.js";
import { SessionService } from "./session.service.js";
import type { SocialProfile } from "./social-oauth.provider.js";
import type { UserRecord, UserRepository } from "./user.repository.js";

export type PublicUser = Omit<
  UserRecord,
  "passwordHash" | "googleSubject" | "facebookSubject" | "updatedAt"
>;

export type AuthResult = {
  user: PublicUser;
  token: string;
};

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt
  };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
    private readonly passwordResets: PasswordResetService,
    private readonly emailVerifications: EmailVerificationService,
    private readonly passwordCost = 12
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existingUser = await this.users.findByEmail(input.email);
    if (existingUser) {
      throw new AppError(409, "EMAIL_IN_USE", "An account already exists for this email.");
    }

    const passwordHash = await hash(input.password, this.passwordCost);
    const user = await this.users.create({
      name: input.name ?? "FormForge User",
      email: input.email,
      passwordHash
    });
    await this.emailVerifications.request(user);

    return {
      user: toPublicUser(user),
      token: await this.sessions.issue(user.id)
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const validPassword = user?.passwordHash
      ? await compare(input.password, user.passwordHash)
      : false;

    if (!user || !validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    return {
      user: toPublicUser(user),
      token: await this.sessions.issue(user.id)
    };
  }

  async authenticateSocial(profile: SocialProfile): Promise<AuthResult> {
    let user = await this.users.findBySocialIdentity(profile.provider, profile.subject);
    const verifiedAt = profile.emailVerified ? new Date() : null;

    if (user) {
      if (verifiedAt && !user.emailVerifiedAt) {
        user = await this.users.linkSocialIdentity(
          user.id,
          profile.provider,
          profile.subject,
          verifiedAt
        );
      }
    } else {
      const existingEmailUser = await this.users.findByEmail(profile.email);
      if (existingEmailUser) {
        if (!profile.emailVerified) {
          throw new AppError(
            409,
            "SOCIAL_EMAIL_CONFLICT",
            "Sign in with your existing method before connecting Facebook."
          );
        }
        user = await this.users.linkSocialIdentity(
          existingEmailUser.id,
          profile.provider,
          profile.subject,
          verifiedAt
        );
      } else {
        user = await this.users.create({
          name: profile.name,
          email: profile.email,
          emailVerifiedAt: verifiedAt,
          passwordHash: null,
          ...(profile.provider === "google"
            ? { googleSubject: profile.subject }
            : { facebookSubject: profile.subject })
        });
        if (!profile.emailVerified) await this.emailVerifications.request(user);
      }
    }

    if (!user) {
      throw new AppError(500, "SOCIAL_AUTH_FAILED", "The social account could not be connected.");
    }
    return {
      user: toPublicUser(user),
      token: await this.sessions.issue(user.id)
    };
  }

  async authenticate(token: string): Promise<PublicUser> {
    const userId = await this.sessions.verify(token);
    const user = await this.users.findById(userId);

    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    return toPublicUser(user);
  }

  async requireVerifiedEmail(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }
    if (!user.emailVerifiedAt) {
      throw new AppError(
        403,
        "EMAIL_VERIFICATION_REQUIRED",
        "Verify your email before publishing your first form."
      );
    }
  }

  async requestEmailVerification(userId: string): Promise<{
    alreadyVerified: boolean;
    user: PublicUser;
  }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }
    if (user.emailVerifiedAt) {
      await this.emailVerifications.clear(user.id);
      return { alreadyVerified: true, user: toPublicUser(user) };
    }

    await this.emailVerifications.request(user);
    return { alreadyVerified: false, user: toPublicUser(user) };
  }

  async verifyEmail(token: string): Promise<PublicUser> {
    const userId = await this.emailVerifications.consume(token);
    const user = await this.users.markEmailVerified(userId, new Date());
    if (!user) {
      throw new AppError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or has expired.");
    }
    return toPublicUser(user);
  }

  async changeEmail(userId: string, input: ChangeEmailInput): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    const validPassword = user?.passwordHash
      ? await compare(input.password, user.passwordHash)
      : false;
    if (!user || !validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Your password is incorrect.");
    }

    if (user.emailVerifiedAt) {
      if (user.email === input.email) return toPublicUser(user);
      throw new AppError(
        409,
        "VERIFIED_EMAIL_CHANGE_UNAVAILABLE",
        "Verified email changes are not available during the public trial."
      );
    }

    if (user.email !== input.email) {
      const existing = await this.users.findByEmail(input.email);
      if (existing && existing.id !== user.id) {
        throw new AppError(409, "EMAIL_IN_USE", "An account already exists for this email.");
      }
    }

    let updated = user;
    if (user.email !== input.email) {
      try {
        updated = (await this.users.updateEmail(user.id, input.email)) ?? user;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          throw new AppError(409, "EMAIL_IN_USE", "An account already exists for this email.");
        }
        throw error;
      }
    }
    await this.emailVerifications.request(updated);
    return toPublicUser(updated);
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }

  async requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
    const user = await this.users.findByEmail(input.email);
    if (user) {
      await this.passwordResets.request(user);
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const userId = await this.passwordResets.consume(input.token);
    const passwordHash = await hash(input.password, this.passwordCost);
    const updated = await this.users.updatePasswordHash(userId, passwordHash);

    if (!updated) {
      throw new AppError(
        400,
        "INVALID_RESET_TOKEN",
        "This password reset link is invalid or has expired."
      );
    }

    await this.sessions.revokeAll(userId);
  }
}
