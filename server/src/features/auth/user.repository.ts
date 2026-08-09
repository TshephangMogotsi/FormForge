import { UserModel } from "./user.model.js";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  googleSubject: string | null;
  facebookSubject: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserRecord = Pick<UserRecord, "name" | "email" | "passwordHash"> &
  Partial<Pick<UserRecord, "emailVerifiedAt" | "googleSubject" | "facebookSubject">>;

export type SocialIdentityProvider = "google" | "facebook";

export interface UserRepository {
  create(input: CreateUserRecord): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  findBySocialIdentity(provider: SocialIdentityProvider, subject: string): Promise<UserRecord | null>;
  linkSocialIdentity(
    userId: string,
    provider: SocialIdentityProvider,
    subject: string,
    verifiedAt: Date | null
  ): Promise<UserRecord | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  markEmailVerified(userId: string, verifiedAt: Date): Promise<UserRecord | null>;
  updateEmail(userId: string, email: string): Promise<UserRecord | null>;
}

function toUserRecord(document: {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  googleSubject?: string | null;
  facebookSubject?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: document.id,
    name: document.name,
    email: document.email,
    emailVerifiedAt: document.emailVerifiedAt,
    passwordHash: document.passwordHash,
    googleSubject: document.googleSubject ?? null,
    facebookSubject: document.facebookSubject ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

export class MongooseUserRepository implements UserRepository {
  async create(input: CreateUserRecord): Promise<UserRecord> {
    const user = await UserModel.create(input);
    return toUserRecord(user);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await UserModel.findOne({ email }).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const user = await UserModel.findById(userId).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }

  async findBySocialIdentity(
    provider: SocialIdentityProvider,
    subject: string
  ): Promise<UserRecord | null> {
    const field = provider === "google" ? "googleSubject" : "facebookSubject";
    const user = await UserModel.findOne({ [field]: subject }).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }

  async linkSocialIdentity(
    userId: string,
    provider: SocialIdentityProvider,
    subject: string,
    verifiedAt: Date | null
  ): Promise<UserRecord | null> {
    const field = provider === "google" ? "googleSubject" : "facebookSubject";
    const update: Record<string, unknown> = { [field]: subject };
    if (verifiedAt) update.emailVerifiedAt = verifiedAt;
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const result = await UserModel.updateOne(
      { _id: userId },
      { $set: { passwordHash } }
    ).exec();
    return result.matchedCount === 1;
  }

  async markEmailVerified(userId: string, verifiedAt: Date): Promise<UserRecord | null> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { emailVerifiedAt: verifiedAt } },
      { new: true }
    ).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }

  async updateEmail(userId: string, email: string): Promise<UserRecord | null> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { email, emailVerifiedAt: null } },
      { new: true, runValidators: true }
    ).select("+passwordHash").exec();
    return user ? toUserRecord(user) : null;
  }
}
