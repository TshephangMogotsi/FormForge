import { expect, test, type Page, type Route } from "@playwright/test";

const publishedForm = {
  id: "000000000000000000000101",
  ownerId: "000000000000000000000001",
  title: "Customer experience pulse",
  description: "A short customer survey.",
  fields: [
    {
      id: "58fe31f6-c849-41f6-89d9-3449fb94b900",
      type: "shortText",
      label: "What worked well?",
      description: "",
      placeholder: "Tell us",
      required: true,
      options: []
    }
  ],
  status: "published",
  slug: "customer-experience-pulse-demo",
  publishedVersion: 2,
  publishedAt: "2026-08-07T12:00:00.000Z",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-07T12:00:00.000Z"
} as const;

const draftForm = {
  ...publishedForm,
  id: "000000000000000000000102",
  title: "Product research draft",
  description: "Early research questions.",
  fields: [
    ...publishedForm.fields,
    {
      id: "3d4445e2-1381-428a-b960-99edbdd15662",
      type: "longText",
      label: "What should we research next?",
      description: "",
      placeholder: "Share an idea",
      required: false,
      options: []
    }
  ],
  status: "draft",
  slug: null,
  publishedVersion: 0,
  publishedAt: null,
  updatedAt: "2026-08-06T12:00:00.000Z"
} as const;

const trend = [
  { date: "2026-08-02", count: 0 },
  { date: "2026-08-03", count: 1 },
  { date: "2026-08-04", count: 0 },
  { date: "2026-08-05", count: 2 },
  { date: "2026-08-06", count: 1 },
  { date: "2026-08-07", count: 1 },
  { date: "2026-08-08", count: 1 }
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockApplication(page: Page) {
  let forms: Array<Record<string, unknown>> = [
    { ...publishedForm },
    { ...draftForm }
  ];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/v1/auth/me") {
      return json(route, {
        data: {
          user: {
            id: "000000000000000000000001",
            name: "Taylor Morgan",
            email: "taylor@example.com",
            createdAt: "2026-08-01T12:00:00.000Z"
          }
        }
      });
    }

    if (path === "/api/v1/forms" && request.method() === "GET") {
      return json(route, {
        data: {
          forms,
          pagination: { page: 1, limit: 20, total: forms.length, pages: 1 }
        }
      });
    }

    if (path === "/api/v1/forms/analytics") {
      return json(route, {
        data: {
          analytics: {
            totalForms: forms.length,
            publishedForms: forms.filter((form) => form.status === "published").length,
            totalResponses: 6,
            last7DaysResponses: 6,
            trend,
            forms: forms.map((form) => ({
              formId: form.id,
              title: form.title,
              status: form.status,
              publishedVersion: form.publishedVersion,
              totalResponses: form.status === "published" ? 6 : 0,
              last7DaysResponses: form.status === "published" ? 6 : 0
            }))
          }
        }
      });
    }

    const formPath = path.match(/^\/api\/v1\/forms\/([^/]+)$/);
    if (formPath && request.method() === "GET") {
      const form = forms.find((candidate) => candidate.id === formPath[1]);
      return form
        ? json(route, { data: { form } })
        : json(route, { error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    }

    if (formPath && request.method() === "PATCH") {
      const index = forms.findIndex((form) => form.id === formPath[1]);
      const input = request.postDataJSON() as { title: string };
      forms[index] = { ...forms[index], title: input.title };
      return json(route, { data: { form: forms[index] } });
    }

    if (formPath && request.method() === "DELETE") {
      forms = forms.filter((form) => form.id !== formPath[1]);
      return route.fulfill({ status: 204, body: "" });
    }

    if (path === `/api/v1/forms/${publishedForm.id}/analytics`) {
      return json(route, {
        data: {
          analytics: {
            totalResponses: 6,
            last7DaysResponses: 6,
            trend,
            distributions: []
          }
        }
      });
    }

    if (path === `/api/v1/forms/${publishedForm.id}/submissions`) {
      return json(route, {
        data: {
          submissions: [],
          versions: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      });
    }

    return json(route, { error: { code: "UNMOCKED", message: `Unmocked ${request.method()} ${path}` } }, 500);
  });
}

test.beforeEach(async ({ page }) => {
  await mockApplication(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recent forms" })).toBeVisible();
});

test("supports keyboard navigation and keeps the quick menu inside the viewport", async ({ page }) => {
  const trigger = page.getByRole("button", {
    name: `More actions for ${publishedForm.title}`
  });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");

  const firstItem = page.getByRole("menuitem", { name: "View responses" });
  await expect(firstItem).toBeFocused();
  const menu = page.getByRole("menu", { name: `Actions for ${publishedForm.title}` });
  const bounds = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(8);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width - 8);
  expect(bounds!.y).toBeGreaterThanOrEqual(8);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height - 8);

  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("renames a form and confirms destructive deletion", async ({ page }) => {
  await page
    .getByRole("button", { name: `More actions for ${publishedForm.title}` })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const renameDialog = page.getByRole("dialog", { name: "Rename form" });
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel("Form name").fill("Customer feedback pulse");
  await renameDialog.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByText("Customer feedback pulse", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Renamed");

  const draftTrigger = page.getByRole("button", {
    name: `More actions for ${draftForm.title}`
  });
  await draftTrigger.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const deleteDialog = page.getByRole("dialog", {
    name: `Delete “${draftForm.title}”?`
  });
  await expect(deleteDialog).toContainText("cannot be undone");
  await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByText(draftForm.title, { exact: true })).toBeVisible();

  await draftTrigger.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete form" }).click();
  await expect(page.getByText(draftForm.title, { exact: true })).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Deleted");
});

test("drills down from all-form analytics and returns to the overview", async ({ page }) => {
  await page.getByRole("button", { name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "All forms" })).toBeVisible();
  await expect(page.getByLabel("Workspace response summary")).toContainText("6");

  await page.getByRole("button", { name: /Customer experience pulse/ }).click();
  await expect(page.getByRole("heading", { name: publishedForm.title })).toBeVisible();
  await expect(page.getByLabel("Response summary")).toContainText("6");
  await page.getByRole("button", { name: "All forms" }).click();
  await expect(page.getByRole("heading", { name: "All forms" })).toBeVisible();
});

test("opens an owned builder directly from its stable edit URL", async ({ page }) => {
  await page.goto(`/forms/${draftForm.id}/edit`);
  await expect(page).toHaveURL(`/forms/${draftForm.id}/edit`);
  await expect(page.getByRole("heading", { name: draftForm.title })).toBeVisible();
  await expect(page.getByLabel("Form title")).toHaveValue(draftForm.title);
});

test("reorders fields by dragging from the body of a field card", async ({ page }) => {
  await page.locator(".form-card-open").filter({ hasText: draftForm.title }).click();
  await expect(page.getByRole("heading", { name: "Product research draft" })).toBeVisible();

  const cards = page.locator(".canvas-field");
  const firstCard = await cards.nth(0).boundingBox();
  const secondCard = await cards.nth(1).boundingBox();
  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();

  await page.mouse.move(
    secondCard!.x + secondCard!.width * 0.7,
    secondCard!.y + secondCard!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    firstCard!.x + firstCard!.width * 0.7,
    firstCard!.y + firstCard!.height / 2,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect(
    cards.nth(0).getByRole("button", { name: "Reorder What should we research next?" })
  ).toBeVisible();
  await expect(
    cards.nth(1).getByRole("button", { name: "Reorder What worked well?" })
  ).toBeVisible();
});

test("keeps dashboard and quick-menu controls usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recent forms" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("button", { name: "Analytics" })).toBeVisible();

  const trigger = page.getByRole("button", {
    name: `More actions for ${draftForm.title}`
  });
  await trigger.click();
  const menu = page.getByRole("menu", { name: `Actions for ${draftForm.title}` });
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(8);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(382);
  expect(bounds!.y).toBeGreaterThanOrEqual(8);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(836);
});
