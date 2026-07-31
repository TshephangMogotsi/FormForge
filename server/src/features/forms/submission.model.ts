import mongoose, { type Model, type Types } from "mongoose";
import type { SubmissionAnswer } from "./form.schemas.js";

const { Schema } = mongoose;

export type SubmissionDatabaseRecord = {
  formId: Types.ObjectId;
  formVersion: number;
  answers: SubmissionAnswer[];
  createdAt: Date;
  updatedAt: Date;
};

const answerSchema = new Schema<SubmissionAnswer>(
  {
    fieldId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const submissionSchema = new Schema<SubmissionDatabaseRecord>(
  {
    formId: { type: Schema.Types.ObjectId, required: true, ref: "Form", index: true },
    formVersion: { type: Number, required: true, min: 1 },
    answers: { type: [answerSchema], required: true }
  },
  { timestamps: true, versionKey: false }
);

submissionSchema.index({ formId: 1, createdAt: -1 });
submissionSchema.index({ formId: 1, formVersion: 1, createdAt: -1 });

export const SubmissionModel =
  (mongoose.models.Submission as Model<SubmissionDatabaseRecord> | undefined) ??
  mongoose.model<SubmissionDatabaseRecord>("Submission", submissionSchema);
