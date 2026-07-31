import mongoose, { type Model, type Types } from "mongoose";
import type { FormField } from "./form.schemas.js";

const { Schema } = mongoose;

export type PublishedFormDatabaseRecord = {
  formId: Types.ObjectId;
  ownerId: Types.ObjectId;
  version: number;
  title: string;
  description: string;
  fields: FormField[];
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const publishedFieldSchema = new Schema<FormField>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["shortText", "longText", "number", "select", "checkbox"],
      required: true
    },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 240 },
    placeholder: { type: String, default: "", trim: true, maxlength: 120 },
    required: { type: Boolean, default: false },
    options: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      default: []
    }
  },
  { _id: false }
);

const publishedFormSchema = new Schema<PublishedFormDatabaseRecord>(
  {
    formId: { type: Schema.Types.ObjectId, required: true, ref: "Form", index: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    version: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    fields: { type: [publishedFieldSchema], required: true },
    publishedAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

publishedFormSchema.index({ formId: 1, version: 1 }, { unique: true });

export const PublishedFormModel =
  (mongoose.models.PublishedForm as Model<PublishedFormDatabaseRecord> | undefined) ??
  mongoose.model<PublishedFormDatabaseRecord>("PublishedForm", publishedFormSchema);
