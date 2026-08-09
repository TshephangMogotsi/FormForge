import mongoose, { type Model } from "mongoose";
import { funnelEventNames } from "./funnel.schemas.js";

const { Schema } = mongoose;

type FunnelEventDatabaseRecord = {
  name: (typeof funnelEventNames)[number];
  occurredAt: Date;
  anonymousId: string;
  sessionId: string;
  sourceCampaign: string | null;
  deviceClass: "mobile" | "tablet" | "desktop";
  failureCategory: string | null;
  expiresAt: Date;
  createdAt: Date;
};

const funnelEventSchema = new Schema<FunnelEventDatabaseRecord>(
  {
    name: { type: String, required: true, enum: funnelEventNames, index: true },
    occurredAt: { type: Date, required: true, index: true },
    anonymousId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    sourceCampaign: { type: String, default: null },
    deviceClass: { type: String, required: true, enum: ["mobile", "tablet", "desktop"] },
    failureCategory: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const FunnelEventModel =
  (mongoose.models.FunnelEvent as Model<FunnelEventDatabaseRecord> | undefined) ??
  mongoose.model<FunnelEventDatabaseRecord>("FunnelEvent", funnelEventSchema);
