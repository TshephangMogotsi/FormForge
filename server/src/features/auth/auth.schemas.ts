import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254)
  .transform((email) => email.toLowerCase());

const newPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must contain at most 72 characters.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/\d/, "Password must contain a number.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().max(72)
  })
  .strict()
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72)
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: newPasswordSchema,
    confirmPassword: z.string().max(72)
  })
  .strict()
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

export const verifyEmailSchema = z
  .object({
    token: z.string().min(32).max(256)
  })
  .strict();

export const changeEmailSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72)
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
