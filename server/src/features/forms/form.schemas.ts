import { z } from "zod";

const titleSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(500);

export const formFieldTypeSchema = z.enum([
  "shortText",
  "longText",
  "number",
  "select",
  "checkbox"
]);

const optionSchema = z.string().trim().min(1).max(80);

export const formFieldSchema = z
  .object({
    id: z.uuid(),
    type: formFieldTypeSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(240).default(""),
    placeholder: z.string().trim().max(120).default(""),
    required: z.boolean().default(false),
    options: z.array(optionSchema).max(20).default([])
  })
  .strict()
  .superRefine((field, context) => {
    if (field.type === "select" && field.options.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Dropdown fields require at least one option."
      });
    }

    if (field.type === "select" && new Set(field.options).size !== field.options.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Dropdown options must be unique."
      });
    }

    if (field.type !== "select" && field.options.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Only dropdown fields can define options."
      });
    }
  });

const fieldsSchema = z
  .array(formFieldSchema)
  .max(50)
  .superRefine((fields, context) => {
    const seenIds = new Set<string>();
    fields.forEach((field, index) => {
      if (seenIds.has(field.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Field identifiers must be unique within a form."
        });
      }
      seenIds.add(field.id);
    });
  });

export const createFormSchema = z
  .object({
    title: titleSchema.default("Untitled form"),
    description: descriptionSchema.default(""),
    fields: fieldsSchema.default([])
  })
  .strict();

export const updateFormSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    fields: fieldsSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one form property."
  });

export const formIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid form identifier.");

export const publicFormSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Enter a valid public form slug.");

export const submissionAnswerSchema = z
  .object({
    fieldId: z.uuid(),
    value: z.union([z.string().max(5000), z.number().finite(), z.boolean()])
  })
  .strict();

export const createSubmissionSchema = z
  .object({
    answers: z.array(submissionAnswerSchema).max(50)
  })
  .strict()
  .superRefine((submission, context) => {
    const seenFieldIds = new Set<string>();
    submission.answers.forEach((answer, index) => {
      if (seenFieldIds.has(answer.fieldId)) {
        context.addIssue({
          code: "custom",
          path: ["answers", index, "fieldId"],
          message: "Each field can be answered only once."
        });
      }
      seenFieldIds.add(answer.fieldId);
    });
  });

export const listFormsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const listSubmissionsQuerySchema = listFormsQuerySchema;

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormFieldType = z.infer<typeof formFieldTypeSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionAnswer = z.infer<typeof submissionAnswerSchema>;
