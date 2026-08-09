import { expect, test, type Page, type Route } from "@playwright/test";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function openGuestBuilder(page: Page) {
  const formWrites: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/me") {
      return json(
        route,
        { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
        401
      );
    }
    if (path.startsWith("/api/v1/forms") && request.method() !== "GET") {
      formWrites.push(`${request.method()} ${path}`);
    }
    return json(
      route,
      { error: { code: "UNMOCKED", message: `Unmocked ${request.method()} ${path}` } },
      500
    );
  });

  await page.goto("/build/new");
  await expect(page.getByRole("heading", { name: "Untitled form" })).toBeVisible();
  return formWrites;
}

test("restores a guest draft after refresh without writing a form to the API", async ({ page }) => {
  const formWrites = await openGuestBuilder(page);
  await page.getByLabel("Form title").fill("Volunteer feedback");
  await page.getByRole("button", { name: /Long text Detailed written responses/ }).dblclick();

  await expect(page.locator(".canvas-field")).toHaveCount(2);
  await expect(page.locator(".save-state")).toContainText("Saved on this device");
  await page.reload();

  await expect(page.getByLabel("Form title")).toHaveValue("Volunteer feedback");
  await expect(page.locator(".canvas-field")).toHaveCount(2);
  expect(formWrites).toEqual([]);
});

test("requires confirmation before replacing the local draft", async ({ page }) => {
  await openGuestBuilder(page);
  await page.getByLabel("Form title").fill("Keep this draft");
  await expect(page.locator(".save-state")).toContainText("Saved on this device");

  await page.getByRole("button", { name: "Start over" }).click();
  const dialog = page.getByRole("dialog", { name: "Start over?" });
  await expect(dialog).toContainText("cannot be undone");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Form title")).toHaveValue("Keep this draft");

  await page.getByRole("button", { name: "Start over" }).click();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByLabel("Form title")).toHaveValue("Untitled form");
  await expect(page.locator(".canvas-field")).toHaveCount(1);
});

const ownedFormId = "66c80440f1ad12a8c2399001";
const user = {
  id: "66c80440f1ad12a8c2399002",
  name: "Ada Builder",
  email: "ada@example.com",
  createdAt: "2026-08-09T08:00:00.000Z"
};

async function mockClaimFlow(page: Page, options: { failFirstClaim?: boolean } = {}) {
  let claimedForm: Record<string, unknown> | null = null;
  let claimAttempts = 0;
  const claimBodies: Array<Record<string, unknown>> = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/auth/me") {
      return json(route, { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, 401);
    }
    if (path === "/api/v1/auth/register" || path === "/api/v1/auth/login") {
      return json(route, { data: { user } }, path.endsWith("register") ? 201 : 200);
    }
    if (/^\/api\/v1\/forms\/claims\/[0-9a-f-]+$/i.test(path) && request.method() === "PUT") {
      claimAttempts += 1;
      claimBodies.push(request.postDataJSON() as Record<string, unknown>);
      if (options.failFirstClaim && claimAttempts === 1) {
        return json(route, { error: { code: "INTERNAL_ERROR", message: "The form could not be saved." } }, 500);
      }
      const draft = claimBodies[0];
      claimedForm = {
        id: ownedFormId,
        ownerId: user.id,
        ...draft,
        status: "draft",
        slug: null,
        publishedVersion: 0,
        publishedAt: null,
        createdAt: "2026-08-09T08:05:00.000Z",
        updatedAt: "2026-08-09T08:05:00.000Z"
      };
      return json(route, { data: { form: claimedForm } });
    }
    if (path === "/api/v1/forms" && request.method() === "GET") {
      return json(route, {
        data: {
          forms: claimedForm ? [claimedForm] : [],
          pagination: { page: 1, limit: 20, total: claimedForm ? 1 : 0, pages: claimedForm ? 1 : 0 }
        }
      });
    }
    if (path === `/api/v1/forms/${ownedFormId}` && request.method() === "GET" && claimedForm) {
      return json(route, { data: { form: claimedForm } });
    }
    return json(route, { error: { code: "UNMOCKED", message: `Unmocked ${request.method()} ${path}` } }, 500);
  });

  return {
    get claimAttempts() { return claimAttempts; },
    claimBodies
  };
}

test("creates an account in the builder and claims the local draft", async ({ page }) => {
  const requests = await mockClaimFlow(page);
  await page.goto("/build/new");
  await page.getByLabel("Form title").fill("Community event signup");

  await page.getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog", { name: "Save this form to your account" });
  await expect(dialog.getByRole("heading", { name: "Create a free account" })).toBeVisible();
  await dialog.getByLabel("Name").fill("Ada Builder");
  await dialog.getByLabel("Email").fill("ada@example.com");
  await dialog.getByLabel(/^Password/).fill("Password1");
  await dialog.getByLabel("Confirm password").fill("Password1");
  await dialog.getByRole("button", { name: "Create account and save form" }).click();

  await expect(page).toHaveURL(`/forms/${ownedFormId}/edit`);
  await expect(page.getByLabel("Form title")).toHaveValue("Community event signup");
  expect(requests.claimAttempts).toBe(1);
  expect(requests.claimBodies[0].title).toBe("Community event signup");
  expect(await page.evaluate(() => localStorage.getItem("formforge.guest-draft.v1"))).toBeNull();
});

test("keeps the local draft and retries a failed claim without another sign-in", async ({ page }) => {
  const requests = await mockClaimFlow(page, { failFirstClaim: true });
  await page.goto("/build/new");
  await page.getByLabel("Form title").fill("Resilient signup form");
  await expect(page.locator(".save-state")).toContainText("Saved on this device");

  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Save this form to your account" });
  await dialog.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await dialog.getByLabel("Email").fill("ada@example.com");
  await dialog.getByLabel("Password", { exact: true }).fill("Password1");
  await dialog.getByRole("button", { name: "Sign in and save form" }).click();

  await expect(dialog.getByRole("heading", { name: "We couldn’t save your form" })).toBeVisible();
  await expect(dialog).toContainText("do not need to sign in again");
  expect(requests.claimAttempts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("formforge.guest-draft.v1"))).not.toBeNull();

  await dialog.getByRole("button", { name: "Retry saving" }).click();
  await expect(page).toHaveURL(`/forms/${ownedFormId}/edit`);
  await expect(page.getByLabel("Form title")).toHaveValue("Resilient signup form");
  expect(requests.claimAttempts).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem("formforge.guest-draft.v1"))).toBeNull();
});
