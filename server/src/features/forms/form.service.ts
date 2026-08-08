import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import type {
  CreateFormInput,
  CreateSubmissionInput,
  FormField,
  SubmissionAnswer,
  UpdateFormInput
} from "./form.schemas.js";
import type {
  FormPage,
  FormRecord,
  FormRepository,
  PublishedFormRecord,
  SubmissionRecord
} from "./form.repository.js";
import type { SubmissionPage } from "./form.repository.js";

function createPublicSlug(title: string) {
  const prefix = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "form";

  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

function createDuplicateTitle(title: string) {
  const suffix = " (copy)";
  return `${title.slice(0, 120 - suffix.length)}${suffix}`;
}

function validateAnswer(field: FormField, value: SubmissionAnswer["value"]): string | null {
  if (field.type === "shortText" || field.type === "longText") {
    if (typeof value !== "string") return "Enter a text response.";
    if (field.required && !value.trim()) return "This field is required.";
    return null;
  }

  if (field.type === "number") {
    return typeof value === "number" && Number.isFinite(value)
      ? null
      : "Enter a valid number.";
  }

  if (field.type === "select") {
    return typeof value === "string" && field.options.includes(value)
      ? null
      : "Choose one of the available options.";
  }

  if (typeof value !== "boolean") return "Enter a valid checkbox response.";
  return field.required && !value ? "This confirmation is required." : null;
}

export class FormService {
  constructor(private readonly forms: FormRepository) {}

  list(ownerId: string, page: number, limit: number): Promise<FormPage> {
    return this.forms.listByOwner(ownerId, page, limit);
  }

  create(ownerId: string, input: CreateFormInput): Promise<FormRecord> {
    return this.forms.create({
      ownerId,
      title: input.title,
      description: input.description,
      fields: input.fields
    });
  }

  async get(ownerId: string, formId: string): Promise<FormRecord> {
    const form = await this.forms.findByOwnerAndId(ownerId, formId);
    if (!form) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }

    return form;
  }

  async duplicate(ownerId: string, formId: string): Promise<FormRecord> {
    const source = await this.forms.findByOwnerAndId(ownerId, formId);
    if (!source) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }

    return this.forms.create({
      ownerId,
      title: createDuplicateTitle(source.title),
      description: source.description,
      fields: source.fields.map((field) => ({
        ...field,
        id: randomUUID(),
        options: [...field.options]
      }))
    });
  }

  async update(
    ownerId: string,
    formId: string,
    input: UpdateFormInput
  ): Promise<FormRecord> {
    const form = await this.forms.updateByOwnerAndId(ownerId, formId, input);
    if (!form) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }

    return form;
  }

  async publish(ownerId: string, formId: string): Promise<{
    form: FormRecord;
    publication: PublishedFormRecord;
  }> {
    const draft = await this.get(ownerId, formId);
    if (draft.fields.length === 0) {
      throw new AppError(400, "EMPTY_FORM", "Add at least one field before publishing.");
    }

    const result = await this.forms.publishByOwnerAndId(
      ownerId,
      formId,
      draft.slug ?? createPublicSlug(draft.title)
    );
    if (!result) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }

    return result;
  }

  async getPublic(slug: string): Promise<PublishedFormRecord> {
    const form = await this.forms.findPublishedBySlug(slug);
    if (!form) {
      throw new AppError(404, "PUBLIC_FORM_NOT_FOUND", "This form is not available.");
    }
    return form;
  }

  async submit(slug: string, input: CreateSubmissionInput): Promise<SubmissionRecord> {
    const form = await this.getPublic(slug);
    const fieldsById = new Map(form.fields.map((field) => [field.id, field]));
    const answersByFieldId = new Map(input.answers.map((answer) => [answer.fieldId, answer]));
    const errors: Array<{ fieldId: string; message: string }> = [];

    for (const answer of input.answers) {
      const field = fieldsById.get(answer.fieldId);
      if (!field) {
        errors.push({ fieldId: answer.fieldId, message: "This field is not part of the published form." });
        continue;
      }

      const message = validateAnswer(field, answer.value);
      if (message) errors.push({ fieldId: field.id, message });
    }

    for (const field of form.fields) {
      if (field.required && !answersByFieldId.has(field.id)) {
        errors.push({ fieldId: field.id, message: "This field is required." });
      }
    }

    if (errors.length) {
      throw new AppError(
        400,
        "INVALID_SUBMISSION",
        "Review the highlighted responses and try again.",
        errors
      );
    }

    const normalizedAnswers = input.answers.map((answer) => ({
      fieldId: answer.fieldId,
      value: typeof answer.value === "string" ? answer.value.trim() : answer.value
    }));

    return this.forms.createSubmission({
      formId: form.formId,
      formVersion: form.version,
      answers: normalizedAnswers
    });
  }

  async listSubmissions(
    ownerId: string,
    formId: string,
    page: number,
    limit: number
  ): Promise<SubmissionPage> {
    await this.get(ownerId, formId);
    return this.forms.listSubmissions(formId, page, limit);
  }

  async getAnalytics(ownerId: string, formId: string) {
    const form = await this.get(ownerId, formId);
    const publication = form.slug ? await this.forms.findPublishedBySlug(form.slug) : null;
    const selectFields = publication?.fields.filter((field) => field.type === "select") ?? [];
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    const since = new Date(todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
    const counts = await this.forms.getSubmissionAnalytics(
      formId,
      since,
      selectFields.map((field) => field.id)
    );
    const trendByDate = new Map(counts.trend.map((entry) => [entry.date, entry.count]));
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since.getTime() + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return { date, count: trendByDate.get(date) ?? 0 };
    });

    const distributions = selectFields.map((field) => {
      const fieldCounts = counts.options.filter((entry) => entry.fieldId === field.id);
      const observedValues = fieldCounts.map((entry) => entry.value);
      const values = [...new Set([...field.options, ...observedValues])];
      const answered = fieldCounts.reduce((sum, entry) => sum + entry.count, 0);
      return {
        fieldId: field.id,
        label: field.label,
        answered,
        options: values.map((value) => {
          const count = fieldCounts.find((entry) => entry.value === value)?.count ?? 0;
          return {
            value,
            count,
            percentage: answered ? Math.round((count / answered) * 100) : 0
          };
        })
      };
    });

    return {
      totalResponses: counts.total,
      last7DaysResponses: counts.sinceTotal,
      trend,
      distributions
    };
  }

  async delete(ownerId: string, formId: string): Promise<void> {
    const deleted = await this.forms.deleteByOwnerAndId(ownerId, formId);
    if (!deleted) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }
  }
}
