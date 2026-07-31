import mongoose, { type Model, type Types } from "mongoose";

const { Schema } = mongoose;

export type PasswordResetDatabaseRecord = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const passwordResetSchema = new Schema<PasswordResetDatabaseRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: "User"
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PasswordResetModel =
  (mongoose.models.PasswordReset as Model<PasswordResetDatabaseRecord> | undefined) ??
  mongoose.model<PasswordResetDatabaseRecord>("PasswordReset", passwordResetSchema);
