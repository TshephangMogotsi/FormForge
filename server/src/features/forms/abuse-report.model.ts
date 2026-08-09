import mongoose, { type Model, type Types } from "mongoose";

const { Schema } = mongoose;

export type AbuseReportDatabaseRecord = {
  formId: Types.ObjectId;
  slug: string;
  reason: "spam" | "phishing" | "harmful" | "other";
  details: string;
  reporterEmail: string | null;
  status: "new" | "reviewed";
  createdAt: Date;
  updatedAt: Date;
};

const abuseReportSchema = new Schema<AbuseReportDatabaseRecord>(
  {
    formId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "Form" },
    slug: { type: String, required: true, index: true },
    reason: { type: String, required: true, enum: ["spam", "phishing", "harmful", "other"] },
    details: { type: String, trim: true, maxlength: 1000, default: "" },
    reporterEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
    status: { type: String, required: true, enum: ["new", "reviewed"], default: "new", index: true }
  },
  { timestamps: true, versionKey: false }
);

export const AbuseReportModel =
  (mongoose.models.AbuseReport as Model<AbuseReportDatabaseRecord> | undefined) ??
  mongoose.model<AbuseReportDatabaseRecord>("AbuseReport", abuseReportSchema);
