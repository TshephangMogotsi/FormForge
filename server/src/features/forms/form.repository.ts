import { FormModel } from "./form.model.js";

export type FormStatus = "draft" | "published";

export type FormRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: FormStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateFormRecord = Pick<FormRecord, "ownerId" | "title" | "description">;
export type UpdateFormRecord = Partial<Pick<FormRecord, "title" | "description">>;

export type FormPage = {
  items: FormRecord[];
  page: number;
  limit: number;
  total: number;
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
  deleteByOwnerAndId(ownerId: string, formId: string): Promise<boolean>;
}

function toFormRecord(document: {
  id: string;
  ownerId: { toString(): string } | string;
  title: string;
  description: string;
  status: FormStatus;
  createdAt: Date;
  updatedAt: Date;
}): FormRecord {
  return {
    id: document.id,
    ownerId: document.ownerId.toString(),
    title: document.title,
    description: document.description,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
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

  async deleteByOwnerAndId(ownerId: string, formId: string): Promise<boolean> {
    const result = await FormModel.deleteOne({ _id: formId, ownerId }).exec();
    return result.deletedCount === 1;
  }
}
