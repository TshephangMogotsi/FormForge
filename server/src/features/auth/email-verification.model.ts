import mongoose, { type Model, type Types } from "mongoose";

const { Schema } = mongoose;

export type EmailVerificationDatabaseRecord = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const emailVerificationSchema = new Schema<EmailVerificationDatabaseRecord>(
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
  { timestamps: true, versionKey: false }
);

export const EmailVerificationModel =
  (mongoose.models.EmailVerification as Model<EmailVerificationDatabaseRecord> | undefined) ??
  mongoose.model<EmailVerificationDatabaseRecord>("EmailVerification", emailVerificationSchema);
