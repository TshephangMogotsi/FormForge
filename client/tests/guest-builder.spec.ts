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

test("preserves the draft when publish leads to sign in and the user returns", async ({ page }) => {
  await openGuestBuilder(page);
  await page.getByLabel("Form title").fill("Community event signup");
  await expect(page.locator(".save-state")).toContainText("Saved on this device");

  await page.getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog", { name: "Create an account to publish" });
  await expect(dialog).toContainText("Your draft is saved on this device");
  await dialog.getByRole("button", { name: "Continue to sign in" }).click();

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fbuild%2Fnew$/);
  await expect(page.getByRole("heading", { name: "Start building" })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Form title")).toHaveValue("Community event signup");
});
