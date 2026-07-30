import { UserModel } from "./user.model.js";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserRecord = Pick<UserRecord, "name" | "email" | "passwordHash">;

export interface UserRepository {
  create(input: CreateUserRecord): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
}

function toUserRecord(document: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: document.id,
    name: document.name,
    email: document.email,
    passwordHash: document.passwordHash,
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
}
