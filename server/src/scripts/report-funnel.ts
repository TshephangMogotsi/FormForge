import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { FunnelEventModel } from "../features/funnel/funnel-event.model.js";

const successSteps = [
  "builder_opened",
  "first_meaningful_edit",
  "publish_selected",
  "auth_prompt_shown",
  "auth_succeeded",
  "draft_claimed",
  "publish_succeeded"
] as const;

async function report() {
  if (!env.MONGODB_URI) throw new Error("Set MONGODB_URI before generating a funnel report.");
  await connectDatabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const rows = await FunnelEventModel.aggregate<{
    _id: string;
    events: number;
    visitors: number;
  }>([
    { $match: { occurredAt: { $gte: since } } },
    { $group: { _id: "$name", events: { $sum: 1 }, visitorIds: { $addToSet: "$anonymousId" } } },
    { $project: { events: 1, visitors: { $size: "$visitorIds" } } }
  ]).exec();
  const failureRows = await FunnelEventModel.aggregate<{
    _id: { name: string; category: string | null };
    events: number;
    visitors: number;
  }>([
    {
      $match: {
        occurredAt: { $gte: since },
        failureCategory: { $ne: null }
      }
    },
    {
      $group: {
        _id: { name: "$name", category: "$failureCategory" },
        events: { $sum: 1 },
        visitorIds: { $addToSet: "$anonymousId" }
      }
    },
    { $project: { events: 1, visitors: { $size: "$visitorIds" } } },
    { $sort: { events: -1 } }
  ]).exec();
  const byName = new Map(rows.map((row) => [row._id, row]));
  const steps = successSteps.map((name, index) => {
    const visitors = byName.get(name)?.visitors ?? 0;
    const preceding = index === 0 ? visitors : byName.get(successSteps[index - 1]!)?.visitors ?? 0;
    return {
      name,
      events: byName.get(name)?.events ?? 0,
      visitors,
      conversionFromPreviousPercent:
        index === 0 || preceding === 0 ? null : Math.round((visitors / preceding) * 10_000) / 100
    };
  });
  const failures = failureRows.map((row) => ({
    name: row._id.name,
    category: row._id.category,
    events: row.events,
    visitors: row.visitors
  }));

  console.info(JSON.stringify({ windowDays: 30, generatedAt: new Date().toISOString(), steps, failures }, null, 2));
}

report()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Funnel report failed.");
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
