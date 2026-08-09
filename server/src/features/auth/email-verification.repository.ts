import { EmailVerificationModel } from "./email-verification.model.js";

export type EmailVerificationRecord = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export interface EmailVerificationRepository {
  replaceForUser(record: EmailVerificationRecord): Promise<void>;
  consumeValidToken(tokenHash: string, now: Date): Promise<string | null>;
  deleteForUser(userId: string): Promise<void>;
}

export class MongooseEmailVerificationRepository implements EmailVerificationRepository {
  async replaceForUser(record: EmailVerificationRecord): Promise<void> {
    await EmailVerificationModel.findOneAndUpdate(
      { userId: record.userId },
      record,
      { upsert: true, runValidators: true }
    ).exec();
  }

  async consumeValidToken(tokenHash: string, now: Date): Promise<string | null> {
    const token = await EmailVerificationModel.findOneAndDelete({
      tokenHash,
      expiresAt: { $gt: now }
    }).exec();
    return token?.userId.toString() ?? null;
  }

  async deleteForUser(userId: string): Promise<void> {
    await EmailVerificationModel.deleteOne({ userId }).exec();
  }
}
