import mongoose, { type Model } from "mongoose";

const { Schema } = mongoose;

export type UserDatabaseRecord = {
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  googleSubject?: string | null;
  facebookSubject?: string | null;
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
      default: null,
      select: false
    },
    googleSubject: {
      type: String,
      maxlength: 255,
      sparse: true,
      unique: true,
      index: true
    },
    facebookSubject: {
      type: String,
      maxlength: 255,
      sparse: true,
      unique: true,
      index: true
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
