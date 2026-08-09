export type FunnelEventName =
  | "builder_opened"
  | "first_meaningful_edit"
  | "publish_selected"
  | "auth_prompt_shown"
  | "auth_succeeded"
  | "draft_claimed"
  | "publish_succeeded"
  | "auth_failed"
  | "claim_failed"
  | "publish_failed"
  | "draft_storage_failed";

export type FunnelFailureCategory =
  | "network"
  | "authentication"
  | "validation"
  | "verification"
  | "rate_limit"
  | "account_limit"
  | "server"
  | "storage"
  | "unknown";

const anonymousIdKey = "formforge.analytics.anonymous-id.v1";
const sessionIdKey = "formforge.analytics.session-id.v1";
const campaignKey = "formforge.analytics.campaign.v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const campaignPattern = /^[A-Za-z0-9._~-]+$/;
const memoryAnonymousId = crypto.randomUUID();
const memorySessionId = crypto.randomUUID();

function storedId(storage: Storage, key: string, fallback: string) {
  try {
    const current = storage.getItem(key);
    if (current && uuidPattern.test(current)) return current;
    storage.setItem(key, fallback);
  } catch {
    return fallback;
  }
  return fallback;
}

function sourceCampaign() {
  try {
    const stored = sessionStorage.getItem(campaignKey);
    if (stored && stored.length <= 80 && campaignPattern.test(stored)) return stored;
    const candidate = new URLSearchParams(window.location.search).get("utm_campaign")?.slice(0, 80);
    if (!candidate || !campaignPattern.test(candidate)) return null;
    sessionStorage.setItem(campaignKey, candidate);
    return candidate;
  } catch {
    return null;
  }
}

function deviceClass(): "mobile" | "tablet" | "desktop" {
  if (window.innerWidth < 600) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

export function failureCategory(error: unknown): FunnelFailureCategory {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  if (status === 0 || code === "NETWORK_ERROR") return "network";
  if (status === 401 || code === "UNAUTHENTICATED") return "authentication";
  if (code === "EMAIL_VERIFICATION_REQUIRED") return "verification";
  if (code === "RATE_LIMITED" || status === 429) return "rate_limit";
  if (code.includes("LIMIT_REACHED")) return "account_limit";
  if (status === 400 || code === "VALIDATION_ERROR") return "validation";
  if (status !== null && status >= 500) return "server";
  return "unknown";
}

export function trackFunnelEvent(
  name: FunnelEventName,
  category: FunnelFailureCategory | null = null
) {
  const body = {
    name,
    occurredAt: new Date().toISOString(),
    anonymousId: storedId(localStorage, anonymousIdKey, memoryAnonymousId),
    sessionId: storedId(sessionStorage, sessionIdKey, memorySessionId),
    sourceCampaign: sourceCampaign(),
    deviceClass: deviceClass(),
    failureCategory: category
  };

  void fetch("/api/v1/events", {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }).catch(() => undefined);
}
