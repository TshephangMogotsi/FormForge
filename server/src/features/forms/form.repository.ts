import mongoose from "mongoose";
import { FormModel } from "./form.model.js";
import { AbuseReportModel } from "./abuse-report.model.js";
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

export type SubmissionPage = {
  items: SubmissionRecord[];
  versions: Array<{
    version: number;
    fields: FormField[];
    publishedAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
};

export type SubmissionAnalyticsCounts = {
  total: number;
  sinceTotal: number;
  trend: Array<{ date: string; count: number }>;
  options: Array<{ fieldId: string; value: string; count: number }>;
};

export type OwnerAnalyticsCounts = {
  totalForms: number;
  publishedForms: number;
  total: number;
  sinceTotal: number;
  trend: Array<{ date: string; count: number }>;
  forms: Array<{
    formId: string;
    title: string;
    status: FormStatus;
    publishedVersion: number;
    total: number;
    sinceTotal: number;
  }>;
};

export interface FormRepository {
  create(input: CreateFormRecord): Promise<FormRecord>;
  claimGuestDraft(
    input: CreateFormRecord & { sourceGuestDraftId: string }
  ): Promise<FormRecord>;
  findByOwnerAndGuestDraftId(ownerId: string, sourceGuestDraftId: string): Promise<FormRecord | null>;
  countByOwner(ownerId: string): Promise<number>;
  countPublishedByOwner(ownerId: string): Promise<number>;
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
  createAbuseReport(input: {
    formId: string;
    slug: string;
    reason: "spam" | "phishing" | "harmful" | "other";
    details: string;
    reporterEmail: string | null;
  }): Promise<{ id: string; createdAt: Date }>;
  createSubmission(input: {
    formId: string;
    formVersion: number;
    answers: SubmissionAnswer[];
  }): Promise<SubmissionRecord>;
  listSubmissions(formId: string, page: number, limit: number): Promise<SubmissionPage>;
  getSubmissionAnalytics(
    formId: string,
    since: Date,
    selectFieldIds: string[]
  ): Promise<SubmissionAnalyticsCounts>;
  getOwnerAnalytics(ownerId: string, since: Date): Promise<OwnerAnalyticsCounts>;
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

  async claimGuestDraft(
    input: CreateFormRecord & { sourceGuestDraftId: string }
  ): Promise<FormRecord> {
    const { ownerId, sourceGuestDraftId, title, description, fields } = input;
    const filter = { ownerId, sourceGuestDraftId };

    try {
      const form = await FormModel.findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            ownerId,
            sourceGuestDraftId,
            title,
            description,
            fields
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      ).exec();

      if (!form) throw new Error("Guest draft claim did not return a form.");
      return toFormRecord(form);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await FormModel.findOne(filter).exec();
      if (!existing) throw error;
      return toFormRecord(existing);
    }
  }

  async findByOwnerAndGuestDraftId(
    ownerId: string,
    sourceGuestDraftId: string
  ): Promise<FormRecord | null> {
    const form = await FormModel.findOne({ ownerId, sourceGuestDraftId }).exec();
    return form ? toFormRecord(form) : null;
  }

  countByOwner(ownerId: string): Promise<number> {
    return FormModel.countDocuments({ ownerId }).exec();
  }

  countPublishedByOwner(ownerId: string): Promise<number> {
    return FormModel.countDocuments({ ownerId, status: "published" }).exec();
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

  async createAbuseReport(input: {
    formId: string;
    slug: string;
    reason: "spam" | "phishing" | "harmful" | "other";
    details: string;
    reporterEmail: string | null;
  }): Promise<{ id: string; createdAt: Date }> {
    const report = await AbuseReportModel.create(input);
    return { id: report.id, createdAt: report.createdAt };
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

  async listSubmissions(formId: string, page: number, limit: number): Promise<SubmissionPage> {
    const filter = { formId };
    const [submissions, total] = await Promise.all([
      SubmissionModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      SubmissionModel.countDocuments(filter).exec()
    ]);
    const versionNumbers = [...new Set(submissions.map((submission) => submission.formVersion))];
    const versions = versionNumbers.length
      ? await PublishedFormModel.find({ formId, version: { $in: versionNumbers } })
          .sort({ version: -1 })
          .exec()
      : [];

    return {
      items: submissions.map((submission) => ({
        id: submission.id,
        formId: submission.formId.toString(),
        formVersion: submission.formVersion,
        answers: submission.answers.map((answer) => ({
          fieldId: answer.fieldId,
          value: answer.value
        })),
        createdAt: submission.createdAt
      })),
      versions: versions.map((version) => ({
        version: version.version,
        fields: cloneFields(version.fields),
        publishedAt: version.publishedAt
      })),
      page,
      limit,
      total
    };
  }

  async getSubmissionAnalytics(
    formId: string,
    since: Date,
    selectFieldIds: string[]
  ): Promise<SubmissionAnalyticsCounts> {
    const objectId = new mongoose.Types.ObjectId(formId);
    const [total, sinceTotal, trendRows, optionRows] = await Promise.all([
      SubmissionModel.countDocuments({ formId: objectId }).exec(),
      SubmissionModel.countDocuments({ formId: objectId, createdAt: { $gte: since } }).exec(),
      SubmissionModel.aggregate<{ _id: string; count: number }>([
        { $match: { formId: objectId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).exec(),
      selectFieldIds.length
        ? SubmissionModel.aggregate<{
            _id: { fieldId: string; value: string };
            count: number;
          }>([
            { $match: { formId: objectId } },
            { $unwind: "$answers" },
            {
              $match: {
                "answers.fieldId": { $in: selectFieldIds },
                "answers.value": { $type: "string" }
              }
            },
            {
              $group: {
                _id: { fieldId: "$answers.fieldId", value: "$answers.value" },
                count: { $sum: 1 }
              }
            }
          ]).exec()
        : Promise.resolve([])
    ]);

    return {
      total,
      sinceTotal,
      trend: trendRows.map((row) => ({ date: row._id, count: row.count })),
      options: optionRows.map((row) => ({
        fieldId: row._id.fieldId,
        value: row._id.value,
        count: row.count
      }))
    };
  }

  async getOwnerAnalytics(ownerId: string, since: Date): Promise<OwnerAnalyticsCounts> {
    const forms = await FormModel.find({ ownerId })
      .select({ _id: 1, title: 1, status: 1, publishedVersion: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    const formIds = forms.map((form) => form._id);

    const [counts = { perForm: [], trend: [] }] = formIds.length
      ? await SubmissionModel.aggregate<{
          perForm: Array<{
            _id: mongoose.Types.ObjectId;
            total: number;
            sinceTotal: number;
          }>;
          trend: Array<{ _id: string; count: number }>;
        }>([
          { $match: { formId: { $in: formIds } } },
          {
            $facet: {
              perForm: [
                {
                  $group: {
                    _id: "$formId",
                    total: { $sum: 1 },
                    sinceTotal: {
                      $sum: { $cond: [{ $gte: ["$createdAt", since] }, 1, 0] }
                    }
                  }
                }
              ],
              trend: [
                { $match: { createdAt: { $gte: since } } },
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt",
                        timezone: "UTC"
                      }
                    },
                    count: { $sum: 1 }
                  }
                },
                { $sort: { _id: 1 } }
              ]
            }
          }
        ]).exec()
      : [];
    const countsByForm = new Map(
      counts.perForm.map((entry) => [entry._id.toString(), entry])
    );
    const formCounts = forms.map((form) => {
      const count = countsByForm.get(form._id.toString());
      return {
        formId: form._id.toString(),
        title: form.title,
        status: form.status,
        publishedVersion: form.publishedVersion ?? 0,
        total: count?.total ?? 0,
        sinceTotal: count?.sinceTotal ?? 0
      };
    });

    return {
      totalForms: forms.length,
      publishedForms: forms.filter((form) => form.status === "published").length,
      total: formCounts.reduce((sum, form) => sum + form.total, 0),
      sinceTotal: formCounts.reduce((sum, form) => sum + form.sinceTotal, 0),
      trend: counts.trend.map((entry) => ({ date: entry._id, count: entry.count })),
      forms: formCounts
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
