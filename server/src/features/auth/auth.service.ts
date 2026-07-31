import { compare, hash } from "bcryptjs";
import { AppError } from "../../lib/app-error.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput
} from "./auth.schemas.js";
import { PasswordResetService } from "./password-reset.service.js";
import { SessionService } from "./session.service.js";
import type { UserRecord, UserRepository } from "./user.repository.js";

export type PublicUser = Omit<UserRecord, "passwordHash" | "updatedAt">;

export type AuthResult = {
  user: PublicUser;
  token: string;
};

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
    private readonly passwordResets: PasswordResetService,
    private readonly passwordCost = 12
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existingUser = await this.users.findByEmail(input.email);
    if (existingUser) {
      throw new AppError(409, "EMAIL_IN_USE", "An account already exists for this email.");
    }

    const passwordHash = await hash(input.password, this.passwordCost);
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash
    });

    return {
      user: toPublicUser(user),
      token: await this.sessions.issue(user.id)
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const validPassword = user ? await compare(input.password, user.passwordHash) : false;

    if (!user || !validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
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
