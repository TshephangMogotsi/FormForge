import mongoose, { type Model, type Types } from "mongoose";

const { Schema } = mongoose;

export type SessionDatabaseRecord = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const sessionSchema = new Schema<SessionDatabaseRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
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

export const SessionModel =
  (mongoose.models.Session as Model<SessionDatabaseRecord> | undefined) ??
  mongoose.model<SessionDatabaseRecord>("Session", sessionSchema);
