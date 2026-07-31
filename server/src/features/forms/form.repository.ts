import mongoose from "mongoose";
import { FormModel } from "./form.model.js";
import { PublishedFormModel } from "./published-form.model.js";
import type { FormField, SubmissionAnswer } from "./form.schemas.js";
import { SubmissionModel } from "./submission.model.js";

export type FormStatus = "draft" | "published";

export type FormRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  fields: FormField[];
  status: FormStatus;
  slug: string | null;
  publishedVersion: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateFormRecord = Pick<FormRecord, "ownerId" | "title" | "description" | "fields">;
export type UpdateFormRecord = Partial<Pick<FormRecord, "title" | "description" | "fields">>;

export type FormPage = {
  items: FormRecord[];
  page: number;
  limit: number;
  total: number;
};

export type PublishedFormRecord = {
  formId: string;
  slug: string;
  version: number;
  title: string;
  description: string;
  fields: FormField[];
  publishedAt: Date;
};

export type SubmissionRecord = {
  id: string;
  formId: string;
  formVersion: number;
  answers: SubmissionAnswer[];
  createdAt: Date;
};

export interface FormRepository {
  create(input: CreateFormRecord): Promise<FormRecord>;
  listByOwner(ownerId: string, page: number, limit: number): Promise<FormPage>;
  findByOwnerAndId(ownerId: string, formId: string): Promise<FormRecord | null>;
  updateByOwnerAndId(
    ownerId: string,
    formId: string,
    input: UpdateFormRecord
  ): Promise<FormRecord | null>;
  publishByOwnerAndId(ownerId: string, formId: string, slug: string): Promise<{
    form: FormRecord;
    publication: PublishedFormRecord;
  } | null>;
  findPublishedBySlug(slug: string): Promise<PublishedFormRecord | null>;
  createSubmission(input: {
    formId: string;
    formVersion: number;
    answers: SubmissionAnswer[];
  }): Promise<SubmissionRecord>;
  deleteByOwnerAndId(ownerId: string, formId: string): Promise<boolean>;
}

function cloneFields(fields: FormField[]): FormField[] {
  return fields.map((field) => ({
    id: field.id,
    type: field.type,
    label: field.label,
    description: field.description,
    placeholder: field.placeholder,
    required: field.required,
    options: [...field.options]
  }));
}

function toFormRecord(document: {
  id: string;
  ownerId: { toString(): string } | string;
  title: string;
  description: string;
  fields: FormField[];
  status: FormStatus;
  slug?: string;
  publishedVersion?: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}): FormRecord {
  return {
    id: document.id,
    ownerId: document.ownerId.toString(),
    title: document.title,
    description: document.description,
    fields: cloneFields(document.fields),
    status: document.status,
    slug: document.slug ?? null,
    publishedVersion: document.publishedVersion ?? 0,
    publishedAt: document.publishedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function toPublishedFormRecord(
  document: {
    formId: { toString(): string } | string;
    version: number;
    title: string;
    description: string;
    fields: FormField[];
    publishedAt: Date;
  },
  slug: string
): PublishedFormRecord {
  return {
    formId: document.formId.toString(),
    slug,
    version: document.version,
    title: document.title,
    description: document.description,
    fields: cloneFields(document.fields),
    publishedAt: document.publishedAt
  };
}

export class MongooseFormRepository implements FormRepository {
  async create(input: CreateFormRecord): Promise<FormRecord> {
    const form = await FormModel.create(input);
    return toFormRecord(form);
  }

  async listByOwner(ownerId: string, page: number, limit: number): Promise<FormPage> {
    const filter = { ownerId };
    const [forms, total] = await Promise.all([
      FormModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      FormModel.countDocuments(filter).exec()
    ]);

    return {
      items: forms.map(toFormRecord),
      page,
      limit,
      total
    };
  }

  async findByOwnerAndId(ownerId: string, formId: string): Promise<FormRecord | null> {
    const form = await FormModel.findOne({ _id: formId, ownerId }).exec();
    return form ? toFormRecord(form) : null;
  }

  async updateByOwnerAndId(
    ownerId: string,
    formId: string,
    input: UpdateFormRecord
  ): Promise<FormRecord | null> {
    const form = await FormModel.findOneAndUpdate({ _id: formId, ownerId }, input, {
      new: true,
      runValidators: true
    }).exec();

    return form ? toFormRecord(form) : null;
  }

  async publishByOwnerAndId(
    ownerId: string,
    formId: string,
    slug: string
  ): Promise<{ form: FormRecord; publication: PublishedFormRecord } | null> {
    const session = await mongoose.startSession();
    let result: { form: FormRecord; publication: PublishedFormRecord } | null = null;

    try {
      await session.withTransaction(async () => {
        const form = await FormModel.findOne({ _id: formId, ownerId }).session(session).exec();
        if (!form) return;

        const publishedAt = new Date();
        const version = (form.publishedVersion ?? 0) + 1;
        const publicSlug = form.slug ?? slug;
        const [snapshot] = await PublishedFormModel.create(
          [
            {
              formId: form._id,
              ownerId: form.ownerId,
              version,
              title: form.title,
              description: form.description,
              fields: cloneFields(form.fields),
              publishedAt
            }
          ],
          { session }
        );

        if (!snapshot) throw new Error("Published form snapshot was not created.");

        form.status = "published";
        form.slug = publicSlug;
        form.publishedVersion = version;
        form.publishedAt = publishedAt;
        await form.save({ session });

        result = {
          form: toFormRecord(form),
          publication: toPublishedFormRecord(snapshot, publicSlug)
        };
      });
    } finally {
      await session.endSession();
    }

    return result;
  }

  async findPublishedBySlug(slug: string): Promise<PublishedFormRecord | null> {
    const form = await FormModel.findOne({ slug, status: "published" }).exec();
    if (!form || !form.slug || !form.publishedVersion) return null;

    const snapshot = await PublishedFormModel.findOne({
      formId: form._id,
      version: form.publishedVersion
    }).exec();

    return snapshot ? toPublishedFormRecord(snapshot, form.slug) : null;
  }

  async createSubmission(input: {
    formId: string;
    formVersion: number;
    answers: SubmissionAnswer[];
  }): Promise<SubmissionRecord> {
    const submission = await SubmissionModel.create(input);
    return {
      id: submission.id,
      formId: submission.formId.toString(),
      formVersion: submission.formVersion,
      answers: submission.answers.map((answer) => ({
        fieldId: answer.fieldId,
        value: answer.value
      })),
      createdAt: submission.createdAt
    };
  }

  async deleteByOwnerAndId(ownerId: string, formId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    let deleted = false;
    try {
      await session.withTransaction(async () => {
        const form = await FormModel.findOneAndDelete({ _id: formId, ownerId })
          .session(session)
          .exec();
        if (!form) return;

        await Promise.all([
          PublishedFormModel.deleteMany({ formId: form._id }).session(session).exec(),
          SubmissionModel.deleteMany({ formId: form._id }).session(session).exec()
        ]);
        deleted = true;
      });
    } finally {
      await session.endSession();
    }
    return deleted;
  }
}
