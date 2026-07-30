import { Schema, model, models, type Model, type Types } from "mongoose";

export type FormDatabaseRecord = {
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
};

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
  (models.Form as Model<FormDatabaseRecord> | undefined) ??
  model<FormDatabaseRecord>("Form", formSchema);
