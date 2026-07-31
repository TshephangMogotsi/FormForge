import { randomBytes } from "node:crypto";
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

  async delete(ownerId: string, formId: string): Promise<void> {
    const deleted = await this.forms.deleteByOwnerAndId(ownerId, formId);
    if (!deleted) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }
  }
}
