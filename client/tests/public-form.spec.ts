import { expect, test, type Route } from "@playwright/test";

const slug = "mobile-feedback";
const shortTextId = "58fe31f6-c849-41f6-89d9-3449fb94b900";
const selectId = "a9d3a088-32ae-4b33-8cc1-984b5f737522";

const publishedForm = {
  formId: "000000000000000000000101",
  slug,
  version: 2,
  title: "Mobile feedback",
  description: "Tell us how the experience worked on your device.",
  fields: [
    {
      id: shortTextId,
      type: "shortText",
      label: "What worked well?",
      description: "Share one detail.",
      placeholder: "Your answer",
      required: true,
      options: []
    },
    {
      id: selectId,
      type: "select",
      label: "Connection quality",
      description: "Choose the closest match.",
      placeholder: "Choose one",
      required: true,
      options: ["Stable", "Unstable"]
    }
  ],
  publishedAt: "2026-08-08T12:00:00.000Z"
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(60_000);

test("keeps a public form usable on mobile through slow and interrupted requests", async ({
  context,
  page
}) => {
  let submissionAttempts = 0;
  let releaseFormRequest = () => undefined;
  const formRequestGate = new Promise<void>((resolve) => {
    releaseFormRequest = resolve;
  });

  await page.route(`**/api/v1/public/forms/${slug}`, async (route) => {
    await formRequestGate;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await json(route, { data: { form: publishedForm } });
  });
  await page.route(`**/api/v1/public/forms/${slug}/submissions`, async (route) => {
    submissionAttempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (submissionAttempts === 1) {
      await route.abort("connectionreset");
      return;
    }
    await json(
      route,
      {
        data: {
          submission: {
            id: "000000000000000000001001",
            formVersion: 2,
            submittedAt: "2026-08-08T12:05:00.000Z"
          }
        }
      },
      201
    );
  });

  await page.goto(`/f/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Loading form…")).toBeVisible();
  const network = await context.newCDPSession(page);
  await network.send("Network.enable");
  await network.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 200,
    downloadThroughput: 64 * 1024,
    uploadThroughput: 32 * 1024,
    connectionType: "cellular3g"
  });
  releaseFormRequest();
  await expect(page.getByRole("heading", { name: publishedForm.title })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByLabel("What worked well? *")).toBeFocused();

  await page.getByLabel("What worked well? *").fill("Clear questions");
  await page.getByLabel("Connection quality *").selectOption("Unstable");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Check your connection and try again.");
  await expect(page.getByLabel("What worked well? *")).toHaveValue("Clear questions");

  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("heading", { name: "Response received" })).toBeVisible();
  expect(submissionAttempts).toBe(2);
});

test("links public forms to trust guidance and submits a bounded abuse report", async ({ page }) => {
  let reportBody: Record<string, unknown> | null = null;
  await page.route(`**/api/v1/public/forms/${slug}`, (route) =>
    json(route, { data: { form: publishedForm } })
  );
  await page.route(`**/api/v1/public/forms/${slug}/reports`, async (route) => {
    reportBody = route.request().postDataJSON() as Record<string, unknown>;
    await json(route, {
      data: {
        report: {
          id: "000000000000000000002001",
          submittedAt: "2026-08-09T09:00:00.000Z"
        }
      }
    }, 201);
  });

  await page.goto(`/f/${slug}`);
  await page.getByRole("link", { name: "Report abuse" }).click();
  await expect(page).toHaveURL(`/report-abuse?form=${slug}`);
  await expect(page.getByLabel("Public form identifier")).toHaveValue(slug);
  await page.getByLabel("Reason").selectOption("phishing");
  await page.getByLabel("Details (optional)").fill("This form asks for account credentials.");
  await page.getByRole("button", { name: "Submit report" }).click();

  await expect(page.getByRole("heading", { name: "Thank you for flagging this form" })).toBeVisible();
  expect(reportBody).toMatchObject({
    reason: "phishing",
    details: "This form asks for account credentials."
  });

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "What FormForge stores" })).toBeVisible();
  await page.goto("/acceptable-use");
  await expect(page.getByRole("heading", { name: "Build forms people can trust" })).toBeVisible();
});
