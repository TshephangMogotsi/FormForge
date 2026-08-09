import { z } from "zod";

export const funnelEventNames = [
  "builder_opened",
  "first_meaningful_edit",
  "publish_selected",
  "auth_prompt_shown",
  "auth_succeeded",
  "draft_claimed",
  "publish_succeeded",
  "auth_failed",
  "claim_failed",
  "publish_failed",
  "draft_storage_failed"
] as const;

export const funnelEventSchema = z
  .object({
    name: z.enum(funnelEventNames),
    occurredAt: z.iso.datetime(),
    anonymousId: z.uuid(),
    sessionId: z.uuid(),
    sourceCampaign: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._~-]+$/).nullable(),
    deviceClass: z.enum(["mobile", "tablet", "desktop"]),
    failureCategory: z
      .enum([
        "network",
        "authentication",
        "validation",
        "verification",
        "rate_limit",
        "account_limit",
        "server",
        "storage",
        "unknown"
      ])
      .nullable()
  })
  .strict();

export type FunnelEventInput = z.infer<typeof funnelEventSchema>;
