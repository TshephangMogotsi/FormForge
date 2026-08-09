import { expect, test } from "@playwright/test";
import {
  clearGuestDraft,
  createGuestDraft,
  guestDraftStorageKey,
  loadGuestDraft,
  saveGuestDraft
} from "../src/features/builder/guest-draft-storage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("round-trips and clears one versioned guest draft", () => {
  const storage = new MemoryStorage();
  const guestDraft = createGuestDraft(new Date("2026-08-09T06:00:00.000Z"));
  guestDraft.draft.title = "Customer discovery";

  expect(saveGuestDraft(guestDraft, storage)).toEqual({ ok: true, value: undefined });
  expect(loadGuestDraft(storage)).toEqual({ ok: true, value: guestDraft });
  expect(clearGuestDraft(storage)).toEqual({ ok: true, value: undefined });
  expect(loadGuestDraft(storage)).toEqual({ ok: true, value: null });
});

test("rejects malformed, obsolete, and duplicate-field drafts", () => {
  const storage = new MemoryStorage();
  const guestDraft = createGuestDraft();
  const field = {
    id: "62bce942-e923-4787-809c-6f42948f35e6",
    type: "shortText",
    label: "Name",
    description: "",
    placeholder: "Enter your name",
    required: true,
    options: []
  };

  storage.setItem(guestDraftStorageKey, "not-json");
  expect(loadGuestDraft(storage)).toEqual({ ok: false, error: "invalid" });

  storage.setItem(guestDraftStorageKey, JSON.stringify({ ...guestDraft, version: 2 }));
  expect(loadGuestDraft(storage)).toEqual({ ok: false, error: "invalid" });

  storage.setItem(
    guestDraftStorageKey,
    JSON.stringify({
      ...guestDraft,
      draft: { ...guestDraft.draft, fields: [field, field] }
    })
  );
  expect(loadGuestDraft(storage)).toEqual({ ok: false, error: "invalid" });
});

test("reports storage denial without throwing or losing the caller's draft", () => {
  const deniedStorage = new MemoryStorage();
  deniedStorage.setItem = () => {
    throw new DOMException("Storage denied", "SecurityError");
  };

  const guestDraft = createGuestDraft();
  expect(saveGuestDraft(guestDraft, deniedStorage)).toEqual({
    ok: false,
    error: "unavailable"
  });
  expect(guestDraft.draft.title).toBe("Untitled form");
});
