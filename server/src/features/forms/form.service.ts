import { AppError } from "../../lib/app-error.js";
import type { CreateFormInput, UpdateFormInput } from "./form.schemas.js";
import type { FormPage, FormRecord, FormRepository } from "./form.repository.js";

export class FormService {
  constructor(private readonly forms: FormRepository) {}

  list(ownerId: string, page: number, limit: number): Promise<FormPage> {
    return this.forms.listByOwner(ownerId, page, limit);
  }

  create(ownerId: string, input: CreateFormInput): Promise<FormRecord> {
    return this.forms.create({
      ownerId,
      title: input.title,
      description: input.description
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

  async delete(ownerId: string, formId: string): Promise<void> {
    const deleted = await this.forms.deleteByOwnerAndId(ownerId, formId);
    if (!deleted) {
      throw new AppError(404, "FORM_NOT_FOUND", "Form not found.");
    }
  }
}
