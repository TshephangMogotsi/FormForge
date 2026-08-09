import type { FormField, FormFieldType } from "../../lib/api";
import { createStarterDraft, type FormDraft } from "./form-draft";

export const guestDraftStorageKey = "formforge.guest-draft.v1";
export const guestDraftVersion = 1;

export type GuestDraft = {
  version: typeof guestDraftVersion;
  id: string;
  draft: FormDraft;
  updatedAt: string;
};

export type GuestDraftStorageError = "invalid" | "unavailable";

export type GuestDraftStorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GuestDraftStorageError };

const fieldTypes = new Set<FormFieldType>([
  "shortText",
  "longText",
  "number",
  "select",
  "checkbox"
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function isFormField(value: unknown): value is FormField {
  if (!isRecord(value)) return false;
  if (!uuidPattern.test(String(value.id))) return false;
  if (!fieldTypes.has(value.type as FormFieldType)) return false;
  if (!isBoundedString(value.label, 120)) return false;
  if (!isBoundedString(value.description, 240)) return false;
  if (!isBoundedString(value.placeholder, 120)) return false;
  if (typeof value.required !== "boolean") return false;
  if (!Array.isArray(value.options) || value.options.length > 20) return false;
  return value.options.every((option) => isBoundedString(option, 80));
}

function isFormDraft(value: unknown): value is FormDraft {
  if (!isRecord(value)) return false;
  if (!isBoundedString(value.title, 120)) return false;
  if (!isBoundedString(value.description, 500)) return false;
  if (!Array.isArray(value.fields) || value.fields.length > 50) return false;
  if (!value.fields.every(isFormField)) return false;
  return new Set(value.fields.map((field) => field.id)).size === value.fields.length;
}

function isGuestDraft(value: unknown): value is GuestDraft {
  if (!isRecord(value)) return false;
  if (value.version !== guestDraftVersion) return false;
  if (!uuidPattern.test(String(value.id))) return false;
  if (typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) {
    return false;
  }
  return isFormDraft(value.draft);
}

export function createGuestDraft(now = new Date()): GuestDraft {
  return {
    version: guestDraftVersion,
    id: crypto.randomUUID(),
    draft: createStarterDraft(),
    updatedAt: now.toISOString()
  };
}

export function loadGuestDraft(
  storage: Storage = window.localStorage
): GuestDraftStorageResult<GuestDraft | null> {
  let stored: string | null;
  try {
    stored = storage.getItem(guestDraftStorageKey);
  } catch {
    return { ok: false, error: "unavailable" };
  }

  if (stored === null) return { ok: true, value: null };

  try {
    const value: unknown = JSON.parse(stored);
    return isGuestDraft(value)
      ? { ok: true, value }
      : { ok: false, error: "invalid" };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

export function saveGuestDraft(
  guestDraft: GuestDraft,
  storage: Storage = window.localStorage
): GuestDraftStorageResult<undefined> {
  try {
    storage.setItem(guestDraftStorageKey, JSON.stringify(guestDraft));
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function clearGuestDraft(
  storage: Storage = window.localStorage
): GuestDraftStorageResult<undefined> {
  try {
    storage.removeItem(guestDraftStorageKey);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
