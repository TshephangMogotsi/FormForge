import mongoose, { type Model, type Types } from "mongoose";
import type { FormField } from "./form.schemas.js";

const { Schema } = mongoose;

export type FormDatabaseRecord = {
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  fields: FormField[];
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
};

const formFieldSchema = new Schema<FormField>(
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

const formSchema = new Schema<FormDatabaseRecord>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User"
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120
    },
    description: {
      type: String,
      default: "",
      maxlength: 500
    },
    fields: {
      type: [formFieldSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

formSchema.index({ ownerId: 1, updatedAt: -1 });

export const FormModel =
  (mongoose.models.Form as Model<FormDatabaseRecord> | undefined) ??
  mongoose.model<FormDatabaseRecord>("Form", formSchema);
