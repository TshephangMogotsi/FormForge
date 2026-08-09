import { FunnelEventModel } from "./funnel-event.model.js";
import type { FunnelEventInput } from "./funnel.schemas.js";

export interface FunnelRepository {
  create(input: FunnelEventInput, expiresAt: Date): Promise<void>;
}

export class MongooseFunnelRepository implements FunnelRepository {
  async create(input: FunnelEventInput, expiresAt: Date): Promise<void> {
    await FunnelEventModel.create({ ...input, occurredAt: new Date(input.occurredAt), expiresAt });
  }
}
