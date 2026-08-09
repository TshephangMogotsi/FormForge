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

async function mockClaimFlow(
  page: Page,
  options: {
    failFirstClaim?: boolean;
    failFirstPublish?: boolean;
    requireEmailVerification?: boolean;
  } = {}
) {
  let claimedForm: Record<string, unknown> | null = null;
  let claimAttempts = 0;
  let publishAttempts = 0;
  let authenticated = false;
  let currentUser = {
    ...user,
    emailVerifiedAt: options.requireEmailVerification ? null : "2026-08-09T08:00:00.000Z"
  };
  let verificationRequests = 0;
  const claimBodies: Array<Record<string, unknown>> = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/auth/me") {
      if (authenticated) return json(route, { data: { user: currentUser } });
      return json(route, { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, 401);
    }
    if (path === "/api/v1/auth/register" || path === "/api/v1/auth/login") {
      authenticated = true;
      return json(route, { data: { user: currentUser } }, path.endsWith("register") ? 201 : 200);
    }
    if (path === "/api/v1/auth/email-verification" && request.method() === "POST") {
      verificationRequests += 1;
      return json(route, {
        data: { user: currentUser, message: "A new verification link has been sent." }
      }, 202);
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
    if (path === `/api/v1/forms/${ownedFormId}/publish` && request.method() === "POST" && claimedForm) {
      publishAttempts += 1;
      if (options.requireEmailVerification && !currentUser.emailVerifiedAt) {
        return json(route, {
          error: {
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Verify your email before publishing your first form."
          }
        }, 403);
      }
      if (options.failFirstPublish && publishAttempts === 1) {
        return json(route, { error: { code: "INTERNAL_ERROR", message: "Publication was interrupted." } }, 500);
      }
      claimedForm = {
        ...claimedForm,
        status: "published",
        slug: "community-event-signup",
        publishedVersion: 1,
        publishedAt: "2026-08-09T08:06:00.000Z",
        updatedAt: "2026-08-09T08:06:00.000Z"
      };
      return json(route, {
        data: {
          form: claimedForm,
          publication: {
            formId: ownedFormId,
            slug: "community-event-signup",
            version: 1,
            title: claimedForm.title,
            description: claimedForm.description,
            fields: claimedForm.fields,
            publishedAt: "2026-08-09T08:06:00.000Z"
          }
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
    get publishAttempts() { return publishAttempts; },
    get verificationRequests() { return verificationRequests; },
    verifyUser() {
      currentUser = { ...currentUser, emailVerifiedAt: "2026-08-09T08:10:00.000Z" };
    },
    claimBodies
  };
}

test("creates an account, claims the local draft, and resumes publishing", async ({ page }) => {
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
  await expect(page.getByText("Form is live")).toBeVisible();
  expect(requests.claimAttempts).toBe(1);
  expect(requests.publishAttempts).toBe(1);
  expect(requests.claimBodies[0].title).toBe("Community event signup");
  expect(await page.evaluate(() => localStorage.getItem("formforge.guest-draft.v1"))).toBeNull();
});

test("keeps the claimed account draft when resumed publication fails and retries", async ({ page }) => {
  const requests = await mockClaimFlow(page, { failFirstPublish: true });
  await page.goto("/build/new");
  await page.getByLabel("Form title").fill("Publication recovery form");
  await page.getByRole("button", { name: "Publish" }).click();

  const dialog = page.getByRole("dialog", { name: "Save this form to your account" });
  await dialog.getByLabel("Name").fill("Ada Builder");
  await dialog.getByLabel("Email").fill("ada@example.com");
  await dialog.getByLabel(/^Password/).fill("Password1");
  await dialog.getByLabel("Confirm password").fill("Password1");
  await dialog.getByRole("button", { name: "Create account and save form" }).click();

  await expect(page).toHaveURL(`/forms/${ownedFormId}/edit`);
  const retry = page.getByRole("button", { name: /Publication was interrupted.*Select to retry/ });
  await expect(retry).toBeVisible();
  expect(requests.claimAttempts).toBe(1);
  expect(requests.publishAttempts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("formforge.guest-draft.v1"))).toBeNull();

  await retry.click();
  await expect(page.getByText("Form is live")).toBeVisible();
  expect(requests.claimAttempts).toBe(1);
  expect(requests.publishAttempts).toBe(2);
});

test("keeps a claimed draft private until email verification then resumes publishing", async ({ page }) => {
  const requests = await mockClaimFlow(page, { requireEmailVerification: true });
  await page.goto("/build/new");
  await page.getByLabel("Form title").fill("Trusted public form");
  await page.getByRole("button", { name: "Publish" }).click();
  const authDialog = page.getByRole("dialog", { name: "Save this form to your account" });
  await authDialog.getByLabel("Name").fill("Ada Builder");
  await authDialog.getByLabel("Email").fill("ada@example.com");
  await authDialog.getByLabel(/^Password/).fill("Password1");
  await authDialog.getByLabel("Confirm password").fill("Password1");
  await authDialog.getByRole("button", { name: "Create account and save form" }).click();

  await expect(page).toHaveURL(`/forms/${ownedFormId}/edit`);
  const verificationDialog = page.getByRole("dialog", { name: "Verify your email to publish" });
  await expect(verificationDialog).toContainText("not public yet");
  expect(requests.claimAttempts).toBe(1);
  expect(requests.publishAttempts).toBe(1);

  await verificationDialog.getByRole("button", { name: "Resend link" }).click();
  await expect(verificationDialog).toContainText("A new verification link was sent");
  expect(requests.verificationRequests).toBe(1);
  requests.verifyUser();
  await verificationDialog.getByRole("button", { name: "I’ve verified my email" }).click();

  await expect(verificationDialog).not.toBeVisible();
  await expect(page.getByText("Form is live")).toBeVisible();
  expect(requests.claimAttempts).toBe(1);
  expect(requests.publishAttempts).toBe(2);
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

test("preserves an owned draft and resumes saving after the session expires", async ({ page }) => {
  const form = {
    id: ownedFormId,
    ownerId: user.id,
    title: "Owned research form",
    description: "",
    fields: [{
      id: "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
      type: "shortText",
      label: "Your name",
      description: "",
      placeholder: "",
      required: true,
      options: []
    }],
    status: "draft",
    slug: null,
    publishedVersion: 0,
    publishedAt: null,
    createdAt: "2026-08-09T08:00:00.000Z",
    updatedAt: "2026-08-09T08:00:00.000Z"
  };
  let patchAttempts = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/me") return json(route, { data: { user } });
    if (path === "/api/v1/auth/login") return json(route, { data: { user } });
    if (path === "/api/v1/forms" && request.method() === "GET") {
      return json(route, {
        data: { forms: [form], pagination: { page: 1, limit: 20, total: 1, pages: 1 } }
      });
    }
    if (path === `/api/v1/forms/${ownedFormId}` && request.method() === "GET") {
      return json(route, { data: { form } });
    }
    if (path === `/api/v1/forms/${ownedFormId}` && request.method() === "PATCH") {
      patchAttempts += 1;
      if (patchAttempts === 1) {
        return json(route, { error: { code: "UNAUTHENTICATED", message: "Your session expired." } }, 401);
      }
      Object.assign(form, request.postDataJSON());
      return json(route, { data: { form } });
    }
    return json(route, { error: { code: "UNMOCKED", message: `Unmocked ${request.method()} ${path}` } }, 500);
  });

  await page.goto(`/forms/${ownedFormId}/edit`);
  await page.getByLabel("Form title").fill("Unsaved title survives");
  const dialog = page.getByRole("dialog", { name: "Restore your session" });
  await expect(dialog.getByRole("heading", { name: "Sign in to keep saving" })).toBeVisible();
  await expect(page.getByLabel("Form title")).toHaveValue("Unsaved title survives");

  await dialog.getByLabel("Email").fill("ada@example.com");
  await dialog.getByLabel("Password", { exact: true }).fill("Password1");
  await dialog.getByRole("button", { name: "Sign in" }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".save-state")).toContainText("All changes saved");
  await expect(page).toHaveURL(`/forms/${ownedFormId}/edit`);
  await expect(page.getByLabel("Form title")).toHaveValue("Unsaved title survives");
  expect(patchAttempts).toBe(2);
});

test("consumes an email verification link without leaving its token in the URL", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/verify-email") {
      return json(route, { data: { verified: true } });
    }
    if (path === "/api/v1/auth/me") {
      return json(route, { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } }, 401);
    }
    return json(route, { error: { code: "UNMOCKED", message: "Unmocked request" } }, 500);
  });

  await page.goto(`/verify-email?token=${"v".repeat(40)}`);
  await expect(page).toHaveURL("/verify-email");
  await expect(page.getByRole("heading", { name: "You’re verified" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to FormForge" }).click();
  await expect(page).toHaveURL("/login");
});
