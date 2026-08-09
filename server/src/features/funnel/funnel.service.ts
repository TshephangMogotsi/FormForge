import type { FunnelRepository } from "./funnel.repository.js";
import type { FunnelEventInput } from "./funnel.schemas.js";

export class FunnelService {
  constructor(
    private readonly events: FunnelRepository,
    private readonly retentionDays = 90
  ) {}

  record(input: FunnelEventInput): Promise<void> {
    const expiresAt = new Date(Date.now() + this.retentionDays * 24 * 60 * 60_000);
    return this.events.create(input, expiresAt);
  }
}
