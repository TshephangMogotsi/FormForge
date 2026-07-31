import { SessionModel } from "./session.model.js";

export type SessionRecord = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export class MongooseSessionRepository implements SessionRepository {
  async create(session: SessionRecord): Promise<void> {
    await SessionModel.create(session);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = await SessionModel.findOne({ tokenHash }).exec();
    if (!session) return null;

    return {
      userId: session.userId.toString(),
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt
    };
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await SessionModel.deleteOne({ tokenHash }).exec();
  }

  async deleteByUserId(userId: string): Promise<void> {
    await SessionModel.deleteMany({ userId }).exec();
  }
}
