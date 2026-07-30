import { z } from "zod";

const titleSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(500);

export const createFormSchema = z
  .object({
    title: titleSchema.default("Untitled form"),
    description: descriptionSchema.default("")
  })
  .strict();

export const updateFormSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one form property."
  });

export const formIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid form identifier.");

export const listFormsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
