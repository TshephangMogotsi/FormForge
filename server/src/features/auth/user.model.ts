import mongoose, { type Model } from "mongoose";

const { Schema } = mongoose;

export type UserDatabaseRecord = {
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDatabaseRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const UserModel =
  (mongoose.models.User as Model<UserDatabaseRecord> | undefined) ??
  mongoose.model<UserDatabaseRecord>("User", userSchema);
