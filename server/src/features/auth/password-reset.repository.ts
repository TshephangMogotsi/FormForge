import { PasswordResetModel } from "./password-reset.model.js";

export type PasswordResetRecord = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export interface PasswordResetRepository {
  replaceForUser(record: PasswordResetRecord): Promise<void>;
  consumeValidToken(tokenHash: string, now: Date): Promise<string | null>;
}

export class MongoosePasswordResetRepository implements PasswordResetRepository {
  async replaceForUser(record: PasswordResetRecord): Promise<void> {
    await PasswordResetModel.findOneAndUpdate(
      { userId: record.userId },
      record,
      { upsert: true, runValidators: true }
    ).exec();
  }

  async consumeValidToken(tokenHash: string, now: Date): Promise<string | null> {
    const token = await PasswordResetModel.findOneAndDelete({
      tokenHash,
      expiresAt: { $gt: now }
    }).exec();

    return token?.userId.toString() ?? null;
  }
}
