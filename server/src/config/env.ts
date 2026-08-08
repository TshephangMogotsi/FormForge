import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
dotenv.config({ path: path.join(projectRoot, ".env") });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    PUBLIC_APP_ORIGIN: z.string().url().default("http://localhost:5173"),
    MONGODB_URI: z.string().min(1).optional(),
    MONGODB_DATABASE: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
    PASSWORD_RESET_FROM_EMAIL: z.string().trim().email().optional()
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV === "production" && !values.MONGODB_URI) {
      context.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message: "MONGODB_URI is required in production."
      });
    }
  });

export const env = envSchema.parse(process.env);
