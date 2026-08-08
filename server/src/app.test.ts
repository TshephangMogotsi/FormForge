import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { AuthService } from "./features/auth/auth.service.js";
import type {
  PasswordResetNotification,
  PasswordResetNotifier
} from "./features/auth/password-reset.notifier.js";
import type {
  PasswordResetRecord,
  PasswordResetRepository
} from "./features/auth/password-reset.repository.js";
import { PasswordResetService } from "./features/auth/password-reset.service.js";
import type {
  SessionRecord,
  SessionRepository
} from "./features/auth/session.repository.js";
import { SessionService } from "./features/auth/session.service.js";
import type {
  CreateUserRecord,
  UserRecord,
  UserRepository
} from "./features/auth/user.repository.js";
import type {
  CreateFormRecord,
  FormPage,
  FormRecord,
  FormRepository,
  OwnerAnalyticsCounts,
  PublishedFormRecord,
  SubmissionAnalyticsCounts,
  SubmissionPage,
  SubmissionRecord,
  UpdateFormRecord
} from "./features/forms/form.repository.js";
import type { SubmissionAnswer } from "./features/forms/form.schemas.js";
import { FormService } from "./features/forms/form.service.js";

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();
  private nextId = 1;

  async create(input: CreateUserRecord): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      ...input,
      id: this.nextId.toString(16).padStart(24, "0"),
      createdAt: now,
      updatedAt: now
    };
    this.nextId += 1;
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    this.users.set(userId, {
      ...user,
      passwordHash,
      updatedAt: new Date()
    });
    return true;
  }
}

class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();

  async create(session: SessionRecord): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(tokenHash);
      }
    }
  }
}

class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly resets = new Map<string, PasswordResetRecord>();

  async replaceForUser(record: PasswordResetRecord): Promise<void> {
    this.resets.set(record.userId, record);
  }

  async consumeValidToken(tokenHash: string, now: Date): Promise<string | null> {
    const reset = [...this.resets.values()].find(
      (candidate) =>
        candidate.tokenHash === tokenHash && candidate.expiresAt.getTime() > now.getTime()
    );
    if (!reset) return null;

    this.resets.delete(reset.userId);
    return reset.userId;
  }
}

class CapturingPasswordResetNotifier implements PasswordResetNotifier {
  latestNotification: PasswordResetNotification | null = null;

  async send(notification: PasswordResetNotification): Promise<void> {
    this.latestNotification = notification;
  }
}

class InMemoryFormRepository implements FormRepository {
  private readonly forms = new Map<string, FormRecord>();
  private readonly publications = new Map<string, PublishedFormRecord[]>();
  private submissions: SubmissionRecord[] = [];
  private nextId = 100;
  private nextSubmissionId = 1000;

  async create(input: CreateFormRecord): Promise<FormRecord> {
    const now = new Date();
    const form: FormRecord = {
      ...input,
      id: this.nextId.toString(16).padStart(24, "0"),
      status: "draft",
      slug: null,
      publishedVersion: 0,
      publishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.nextId += 1;
    this.forms.set(form.id, form);
    return form;
  }

  async listByOwner(ownerId: string, page: number, limit: number): Promise<FormPage> {
    const ownedForms = [...this.forms.values()]
      .filter((form) => form.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

    return {
      items: ownedForms.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: ownedForms.length
    };
  }

  async findByOwnerAndId(ownerId: string, formId: string): Promise<FormRecord | null> {
    const form = this.forms.get(formId);
    return form?.ownerId === ownerId ? form : null;
  }

  async updateByOwnerAndId(
    ownerId: string,
    formId: string,
    input: UpdateFormRecord
  ): Promise<FormRecord | null> {
    const form = await this.findByOwnerAndId(ownerId, formId);
    if (!form) return null;

    const updatedForm = { ...form, ...input, updatedAt: new Date() };
    this.forms.set(formId, updatedForm);
    return updatedForm;
  }

  async deleteByOwnerAndId(ownerId: string, formId: string): Promise<boolean> {
    const form = await this.findByOwnerAndId(ownerId, formId);
    if (!form) return false;
    this.publications.delete(formId);
    this.submissions = this.submissions.filter((submission) => submission.formId !== formId);
    return this.forms.delete(formId);
  }

  async publishByOwnerAndId(
    ownerId: string,
    formId: string,
    slug: string
  ): Promise<{ form: FormRecord; publication: PublishedFormRecord } | null> {
    const form = await this.findByOwnerAndId(ownerId, formId);
    if (!form) return null;

    const publishedAt = new Date();
    const version = form.publishedVersion + 1;
    const publicSlug = form.slug ?? slug;
    const publication: PublishedFormRecord = {
      formId,
      slug: publicSlug,
      version,
      title: form.title,
      description: form.description,
      fields: structuredClone(form.fields),
      publishedAt
    };
    const updatedForm: FormRecord = {
      ...form,
      status: "published",
      slug: publicSlug,
      publishedVersion: version,
      publishedAt,
      updatedAt: publishedAt
    };

    this.forms.set(formId, updatedForm);
    this.publications.set(formId, [
      ...(this.publications.get(formId) ?? []),
      publication
    ]);
    return { form: updatedForm, publication };
  }

  async findPublishedBySlug(slug: string): Promise<PublishedFormRecord | null> {
    const form = [...this.forms.values()].find(
      (candidate) => candidate.slug === slug && candidate.status === "published"
    );
    if (!form) return null;
    return (
      this.publications
        .get(form.id)
        ?.find((publication) => publication.version === form.publishedVersion) ?? null
    );
  }

  async createSubmission(input: {
    formId: string;
    formVersion: number;
    answers: SubmissionAnswer[];
  }): Promise<SubmissionRecord> {
    const submission: SubmissionRecord = {
      ...input,
      id: this.nextSubmissionId.toString(16).padStart(24, "0"),
      createdAt: new Date()
    };
    this.nextSubmissionId += 1;
    this.submissions.push(submission);
    return submission;
  }

  async listSubmissions(formId: string, page: number, limit: number): Promise<SubmissionPage> {
    const submissions = this.submissions
      .filter((submission) => submission.formId === formId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const items = submissions.slice((page - 1) * limit, page * limit);
    const versionNumbers = new Set(items.map((submission) => submission.formVersion));
    return {
      items,
      versions: (this.publications.get(formId) ?? [])
        .filter((publication) => versionNumbers.has(publication.version))
        .map((publication) => ({
          version: publication.version,
          fields: structuredClone(publication.fields),
          publishedAt: publication.publishedAt
        })),
      page,
      limit,
      total: submissions.length
    };
  }

  async getSubmissionAnalytics(
    formId: string,
    since: Date,
    selectFieldIds: string[]
  ): Promise<SubmissionAnalyticsCounts> {
    const submissions = this.submissions.filter((submission) => submission.formId === formId);
    const recent = submissions.filter((submission) => submission.createdAt >= since);
    const trendCounts = new Map<string, number>();
    recent.forEach((submission) => {
      const date = submission.createdAt.toISOString().slice(0, 10);
      trendCounts.set(date, (trendCounts.get(date) ?? 0) + 1);
    });
    const optionCounts = new Map<string, number>();
    submissions.forEach((submission) => {
      submission.answers.forEach((answer) => {
        if (selectFieldIds.includes(answer.fieldId) && typeof answer.value === "string") {
          const key = `${answer.fieldId}::${answer.value}`;
          optionCounts.set(key, (optionCounts.get(key) ?? 0) + 1);
        }
      });
    });

    return {
      total: submissions.length,
      sinceTotal: recent.length,
      trend: [...trendCounts].map(([date, count]) => ({ date, count })),
      options: [...optionCounts].map(([key, count]) => {
        const separator = key.indexOf("::");
        return {
          fieldId: key.slice(0, separator),
          value: key.slice(separator + 2),
          count
        };
      })
    };
  }

  async getOwnerAnalytics(ownerId: string, since: Date): Promise<OwnerAnalyticsCounts> {
    const forms = [...this.forms.values()]
      .filter((form) => form.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    const ownedFormIds = new Set(forms.map((form) => form.id));
    const submissions = this.submissions.filter((submission) =>
      ownedFormIds.has(submission.formId)
    );
    const recent = submissions.filter((submission) => submission.createdAt >= since);
    const trendCounts = new Map<string, number>();
    recent.forEach((submission) => {
      const date = submission.createdAt.toISOString().slice(0, 10);
      trendCounts.set(date, (trendCounts.get(date) ?? 0) + 1);
    });

    return {
      totalForms: forms.length,
      publishedForms: forms.filter((form) => form.status === "published").length,
      total: submissions.length,
      sinceTotal: recent.length,
      trend: [...trendCounts].map(([date, count]) => ({ date, count })),
      forms: forms.map((form) => {
        const formSubmissions = submissions.filter(
          (submission) => submission.formId === form.id
        );
        return {
          formId: form.id,
          title: form.title,
          status: form.status,
          publishedVersion: form.publishedVersion,
          total: formSubmissions.length,
          sinceTotal: formSubmissions.filter(
            (submission) => submission.createdAt >= since
          ).length
        };
      })
    };
  }
}

function createTestApp(
  options?: Parameters<typeof createApp>[1]
) {
  const users = new InMemoryUserRepository();
  const forms = new InMemoryFormRepository();
  const notifier = new CapturingPasswordResetNotifier();
  const auth = new AuthService(
    users,
    new SessionService(new InMemorySessionRepository()),
    new PasswordResetService(
      new InMemoryPasswordResetRepository(),
      notifier,
      "https://formforge.example",
      30
    ),
    4
  );

  return {
    app: createApp(
      {
        auth,
        forms: new FormService(forms)
      },
      options
    ),
    notifier
  };
}

async function register(
  agent: ReturnType<typeof request.agent>,
  email: string,
  name = "Test User"
) {
  return agent.post("/api/v1/auth/register").send({
    name,
    email,
    password: "correct-horse-42",
    confirmPassword: "correct-horse-42"
  });
}

describe("FormForge API", () => {
  let app: ReturnType<typeof createApp>;
  let notifier: CapturingPasswordResetNotifier;

  beforeEach(() => {
    ({ app, notifier } = createTestApp());
  });

  it("reports service health and assigns a request ID", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      status: "ok",
      service: "formforge-api"
    });
  });

  it("uses the shared API error shape for unknown routes", async () => {
    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "No route matches GET /api/unknown.",
        requestId: expect.any(String)
      }
    });
  });

  it("does not emit cross-origin permissions when production CORS is disabled", async () => {
    const response = await request(createTestApp({ corsOrigin: false }).app)
      .options("/api/health")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "GET");

    expect(response.headers).not.toHaveProperty("access-control-allow-origin");
  });

  it("registers a user with a protected cookie and returns the current user", async () => {
    const agent = request.agent(app);
    const registration = await register(agent, "owner@example.com", "Form Owner");

    expect(registration.status).toBe(201);
    expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(registration.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
    expect(registration.body.data.user).toMatchObject({
      name: "Form Owner",
      email: "owner@example.com"
    });
    expect(registration.body.data.user).not.toHaveProperty("passwordHash");

    const currentUser = await agent.get("/api/v1/auth/me");
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.data.user.email).toBe("owner@example.com");
  });

  it("validates registration input and does not expose the password", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("short");
  });

  it("rejects registration when the password confirmation does not match", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Form Owner",
      email: "owner@example.com",
      password: "correct-horse-42",
      confirmPassword: "different-horse-42"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toContainEqual({
      path: "confirmPassword",
      message: "Passwords do not match."
    });
  });

  it("logs in with valid credentials and rejects invalid credentials generically", async () => {
    const registrationAgent = request.agent(app);
    await register(registrationAgent, "owner@example.com");
    await registrationAgent.post("/api/v1/auth/logout");

    const invalidLogin = await request(app).post("/api/v1/auth/login").send({
      email: "owner@example.com",
      password: "wrong-password-42"
    });
    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });

    const loginAgent = request.agent(app);
    const validLogin = await loginAgent.post("/api/v1/auth/login").send({
      email: "OWNER@example.com",
      password: "correct-horse-42"
    });
    expect(validLogin.status).toBe(200);
    expect((await loginAgent.get("/api/v1/auth/me")).status).toBe(200);
  });

  it("returns the same forgot-password response whether or not an account exists", async () => {
    const agent = request.agent(app);
    await register(agent, "owner@example.com", "Form Owner");

    const existing = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "OWNER@example.com" });
    const missing = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "missing@example.com" });

    expect(existing.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);
    expect(existing.body.data.message).toBe(
      "If an account exists for that email, a reset link has been sent."
    );
    expect(notifier.latestNotification).toMatchObject({
      recipientEmail: "owner@example.com",
      recipientName: "Form Owner",
      expiresInMinutes: 30
    });
  });

  it("logs only safe metadata when reset email delivery fails", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const providerError = Object.assign(
      new Error("owner@example.com resetToken=do-not-log"),
      {
        name: "AccessDeniedException",
        code: "AccessDenied",
        $metadata: { httpStatusCode: 403 }
      }
    );
    const service = new PasswordResetService(
      new InMemoryPasswordResetRepository(),
      {
        async send() {
          throw providerError;
        }
      },
      "https://formforge.example",
      30
    );

    await service.request({
      id: "000000000000000000000001",
      name: "Form Owner",
      email: "owner@example.com"
    });

    expect(logger).toHaveBeenCalledOnce();
    const loggedEvent = JSON.parse(String(logger.mock.calls[0]?.[0]));
    expect(loggedEvent).toEqual({
      level: "error",
      event: "password_reset.delivery_failed",
      errorName: "AccessDeniedException",
      errorCode: "AccessDenied",
      httpStatusCode: 403
    });
    expect(JSON.stringify(loggedEvent)).not.toContain("owner@example.com");
    expect(JSON.stringify(loggedEvent)).not.toContain("do-not-log");
    logger.mockRestore();
  });

  it("resets a password once and revokes every existing session", async () => {
    const agent = request.agent(app);
    await register(agent, "owner@example.com");
    await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "owner@example.com" });

    const resetUrl = notifier.latestNotification?.resetUrl;
    expect(resetUrl).toEqual(expect.any(String));
    const token = new URL(resetUrl!).searchParams.get("resetToken");
    expect(token).toEqual(expect.any(String));

    const reset = await request(app).post("/api/v1/auth/reset-password").send({
      token,
      password: "new-secure-password-84",
      confirmPassword: "new-secure-password-84"
    });
    expect(reset.status).toBe(204);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);

    const oldPasswordLogin = await request(app).post("/api/v1/auth/login").send({
      email: "owner@example.com",
      password: "correct-horse-42"
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app).post("/api/v1/auth/login").send({
      email: "owner@example.com",
      password: "new-secure-password-84"
    });
    expect(newPasswordLogin.status).toBe(200);

    const reusedToken = await request(app).post("/api/v1/auth/reset-password").send({
      token,
      password: "another-password-84",
      confirmPassword: "another-password-84"
    });
    expect(reusedToken.status).toBe(400);
    expect(reusedToken.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("requires authentication before form access", async () => {
    const response = await request(app).get("/api/v1/forms");
    const analytics = await request(app).get("/api/v1/forms/analytics");
    const duplication = await request(app).post(
      "/api/v1/forms/000000000000000000000001/duplicate"
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(analytics.status).toBe(401);
    expect(analytics.body.error.code).toBe("UNAUTHENTICATED");
    expect(duplication.status).toBe(401);
    expect(duplication.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates, lists, updates, and deletes forms for their owner", async () => {
    const owner = request.agent(app);
    await register(owner, "owner@example.com");

    const creation = await owner.post("/api/v1/forms").send({
      title: "Customer feedback",
      description: "A short customer research survey."
    });
    expect(creation.status).toBe(201);
    expect(creation.body.data.form.status).toBe("draft");
    expect(creation.body.data.form.fields).toEqual([]);
    const formId = creation.body.data.form.id as string;

    const list = await owner.get("/api/v1/forms");
    expect(list.status).toBe(200);
    expect(list.body.data.forms).toHaveLength(1);
    expect(list.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      pages: 1
    });

    const update = await owner.patch(`/api/v1/forms/${formId}`).send({
      title: "Quarterly customer feedback",
      fields: [
        {
          id: "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
          type: "select",
          label: "How satisfied are you?",
          description: "Choose the answer that fits best.",
          placeholder: "Select one",
          required: true,
          options: ["Very satisfied", "Satisfied", "Not satisfied"]
        }
      ]
    });
    expect(update.status).toBe(200);
    expect(update.body.data.form.title).toBe("Quarterly customer feedback");
    expect(update.body.data.form.fields).toEqual([
      expect.objectContaining({
        id: "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
        type: "select",
        options: ["Very satisfied", "Satisfied", "Not satisfied"]
      })
    ]);

    const read = await owner.get(`/api/v1/forms/${formId}`);
    expect(read.body.data.form.fields).toEqual(update.body.data.form.fields);

    const deletion = await owner.delete(`/api/v1/forms/${formId}`);
    expect(deletion.status).toBe(204);
    expect((await owner.get("/api/v1/forms")).body.data.forms).toHaveLength(0);
  });

  it("duplicates an owned form as an unpublished draft with fresh field identifiers", async () => {
    const owner = request.agent(app);
    await register(owner, "owner@example.com");
    const sourceFieldId = "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21";
    const creation = await owner.post("/api/v1/forms").send({
      title: "Customer feedback",
      description: "A short customer research survey."
    });
    const sourceFormId = creation.body.data.form.id as string;
    await owner.patch(`/api/v1/forms/${sourceFormId}`).send({
      fields: [
        {
          id: sourceFieldId,
          type: "shortText",
          label: "What should we improve?",
          description: "Share the most important change.",
          placeholder: "Your suggestion",
          required: true,
          options: []
        }
      ]
    });
    const publication = await owner.post(`/api/v1/forms/${sourceFormId}/publish`);
    const slug = publication.body.data.publication.slug as string;
    await request(app)
      .post(`/api/v1/public/forms/${slug}/submissions`)
      .send({ answers: [{ fieldId: sourceFieldId, value: "Faster onboarding" }] });

    const duplication = await owner.post(`/api/v1/forms/${sourceFormId}/duplicate`);

    expect(duplication.status).toBe(201);
    expect(duplication.body.data.form).toMatchObject({
      ownerId: creation.body.data.form.ownerId,
      title: "Customer feedback (copy)",
      description: "A short customer research survey.",
      status: "draft",
      slug: null,
      publishedVersion: 0,
      publishedAt: null,
      fields: [
        {
          type: "shortText",
          label: "What should we improve?",
          description: "Share the most important change.",
          placeholder: "Your suggestion",
          required: true,
          options: []
        }
      ]
    });
    const duplicate = duplication.body.data.form as FormRecord;
    expect(duplicate.id).not.toBe(sourceFormId);
    expect(duplicate.fields[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(duplicate.fields[0]?.id).not.toBe(sourceFieldId);

    const duplicateSubmissions = await owner.get(
      `/api/v1/forms/${duplicate.id}/submissions`
    );
    expect(duplicateSubmissions.body.data.pagination.total).toBe(0);
    const duplicateAnalytics = await owner.get(`/api/v1/forms/${duplicate.id}/analytics`);
    expect(duplicateAnalytics.body.data.analytics.totalResponses).toBe(0);

    const sourceSubmissions = await owner.get(
      `/api/v1/forms/${sourceFormId}/submissions`
    );
    expect(sourceSubmissions.body.data.pagination.total).toBe(1);
  });

  it("does not allow one owner to duplicate another owner's form", async () => {
    const owner = request.agent(app);
    const otherOwner = request.agent(app);
    await register(owner, "owner@example.com");
    await register(otherOwner, "other@example.com", "Other Owner");
    const creation = await owner.post("/api/v1/forms").send({ title: "Private form" });
    const sourceFormId = creation.body.data.form.id as string;

    const duplication = await otherOwner.post(
      `/api/v1/forms/${sourceFormId}/duplicate`
    );

    expect(duplication.status).toBe(404);
    expect(duplication.body.error.code).toBe("FORM_NOT_FOUND");
    expect((await otherOwner.get("/api/v1/forms")).body.data.forms).toHaveLength(0);
    expect((await owner.get("/api/v1/forms")).body.data.forms).toHaveLength(1);
  });

  it("rejects malformed draft field schemas before persistence", async () => {
    const owner = request.agent(app);
    await register(owner, "owner@example.com");
    const creation = await owner.post("/api/v1/forms").send({ title: "Validated form" });
    const formId = creation.body.data.form.id as string;

    const invalidUpdate = await owner.patch(`/api/v1/forms/${formId}`).send({
      fields: [
        {
          id: "not-a-uuid",
          type: "select",
          label: "Choose one",
          description: "",
          placeholder: "",
          required: false,
          options: []
        }
      ]
    });

    expect(invalidUpdate.status).toBe(400);
    expect(invalidUpdate.body.error.code).toBe("VALIDATION_ERROR");
    expect((await owner.get(`/api/v1/forms/${formId}`)).body.data.form.fields).toEqual([]);
  });

  it("publishes immutable versions and validates public submissions against the live version", async () => {
    const owner = request.agent(app);
    await register(owner, "owner@example.com");
    const creation = await owner.post("/api/v1/forms").send({ title: "Product feedback" });
    const formId = creation.body.data.form.id as string;
    const requiredFieldId = "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21";
    const selectFieldId = "70b39b40-5fe6-4181-bd80-83f2739010d3";
    const firstDraftFields = [
      {
        id: requiredFieldId,
        type: "shortText",
        label: "What should we improve?",
        description: "",
        placeholder: "Share one idea",
        required: true,
        options: []
      },
      {
        id: selectFieldId,
        type: "select",
        label: "Would you recommend us?",
        description: "",
        placeholder: "Choose one",
        required: false,
        options: ["Yes", "No"]
      }
    ];
    await owner.patch(`/api/v1/forms/${formId}`).send({ fields: firstDraftFields });

    const firstPublish = await owner.post(`/api/v1/forms/${formId}/publish`);
    expect(firstPublish.status).toBe(201);
    expect(firstPublish.body.data.publication).toMatchObject({
      version: 1,
      title: "Product feedback"
    });
    const slug = firstPublish.body.data.publication.slug as string;
    expect(slug).toMatch(/^product-feedback-[a-f\d]{8}$/);

    await owner.patch(`/api/v1/forms/${formId}`).send({
      fields: [
        { ...firstDraftFields[0], label: "What is the single biggest improvement?" },
        firstDraftFields[1]
      ]
    });

    const stillLiveVersionOne = await request(app).get(`/api/v1/public/forms/${slug}`);
    expect(stillLiveVersionOne.status).toBe(200);
    expect(stillLiveVersionOne.body.data.form.version).toBe(1);
    expect(stillLiveVersionOne.body.data.form.fields[0].label).toBe("What should we improve?");

    const secondPublish = await owner.post(`/api/v1/forms/${formId}/publish`);
    expect(secondPublish.status).toBe(201);
    expect(secondPublish.body.data.publication).toMatchObject({ slug, version: 2 });

    const validSubmission = await request(app)
      .post(`/api/v1/public/forms/${slug}/submissions`)
      .send({
        answers: [
          { fieldId: requiredFieldId, value: "Faster onboarding" },
          { fieldId: selectFieldId, value: "Yes" }
        ]
      });
    expect(validSubmission.status).toBe(201);
    expect(validSubmission.body.data.submission).toMatchObject({
      id: expect.any(String),
      formVersion: 2,
      submittedAt: expect.any(String)
    });

    const responses = await owner.get(`/api/v1/forms/${formId}/submissions?page=1&limit=1`);
    expect(responses.status).toBe(200);
    expect(responses.body.data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      pages: 1
    });
    expect(responses.body.data.submissions[0]).toMatchObject({
      formVersion: 2,
      answers: expect.arrayContaining([
        { fieldId: requiredFieldId, value: "Faster onboarding" },
        { fieldId: selectFieldId, value: "Yes" }
      ])
    });
    expect(responses.body.data.versions[0]).toMatchObject({ version: 2 });

    const analytics = await owner.get(`/api/v1/forms/${formId}/analytics`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.analytics).toMatchObject({
      totalResponses: 1,
      last7DaysResponses: 1,
      distributions: [
        {
          fieldId: selectFieldId,
          label: "Would you recommend us?",
          answered: 1,
          options: expect.arrayContaining([
            { value: "Yes", count: 1, percentage: 100 },
            { value: "No", count: 0, percentage: 0 }
          ])
        }
      ]
    });
    expect(
      analytics.body.data.analytics.trend.reduce(
        (sum: number, point: { count: number }) => sum + point.count,
        0
      )
    ).toBe(1);

    const invalidSubmission = await request(app)
      .post(`/api/v1/public/forms/${slug}/submissions`)
      .send({ answers: [{ fieldId: selectFieldId, value: "Maybe" }] });
    expect(invalidSubmission.status).toBe(400);
    expect(invalidSubmission.body.error.code).toBe("INVALID_SUBMISSION");
    expect(invalidSubmission.body.error.details).toEqual(
      expect.arrayContaining([
        { fieldId: requiredFieldId, message: "This field is required." },
        { fieldId: selectFieldId, message: "Choose one of the available options." }
      ])
    );

    expect((await owner.delete(`/api/v1/forms/${formId}`)).status).toBe(204);
    const deletedPublicForm = await request(app).get(`/api/v1/public/forms/${slug}`);
    expect(deletedPublicForm.status).toBe(404);
    expect(deletedPublicForm.body.error.code).toBe("PUBLIC_FORM_NOT_FOUND");
  });

  it("summarizes analytics across only the authenticated owner's forms", async () => {
    const owner = request.agent(app);
    const outsider = request.agent(app);
    await register(owner, "owner@example.com", "Owner");
    await register(outsider, "outsider@example.com", "Outsider");
    const ownerFieldId = "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21";
    const outsiderFieldId = "70b39b40-5fe6-4181-bd80-83f2739010d3";

    const ownerPublished = await owner
      .post("/api/v1/forms")
      .send({ title: "Published survey" });
    const ownerPublishedId = ownerPublished.body.data.form.id as string;
    await owner.patch(`/api/v1/forms/${ownerPublishedId}`).send({
      fields: [
        {
          id: ownerFieldId,
          type: "shortText",
          label: "Feedback",
          description: "",
          placeholder: "",
          required: true,
          options: []
        }
      ]
    });
    const ownerPublication = await owner.post(
      `/api/v1/forms/${ownerPublishedId}/publish`
    );
    const ownerSlug = ownerPublication.body.data.publication.slug as string;
    await request(app)
      .post(`/api/v1/public/forms/${ownerSlug}/submissions`)
      .send({ answers: [{ fieldId: ownerFieldId, value: "First" }] });
    await request(app)
      .post(`/api/v1/public/forms/${ownerSlug}/submissions`)
      .send({ answers: [{ fieldId: ownerFieldId, value: "Second" }] });
    const ownerDraft = await owner
      .post("/api/v1/forms")
      .send({ title: "Unpublished survey" });
    const ownerDraftId = ownerDraft.body.data.form.id as string;

    const outsiderForm = await outsider
      .post("/api/v1/forms")
      .send({ title: "Outsider survey" });
    const outsiderFormId = outsiderForm.body.data.form.id as string;
    await outsider.patch(`/api/v1/forms/${outsiderFormId}`).send({
      fields: [
        {
          id: outsiderFieldId,
          type: "shortText",
          label: "Private feedback",
          description: "",
          placeholder: "",
          required: true,
          options: []
        }
      ]
    });
    const outsiderPublication = await outsider.post(
      `/api/v1/forms/${outsiderFormId}/publish`
    );
    const outsiderSlug = outsiderPublication.body.data.publication.slug as string;
    await request(app)
      .post(`/api/v1/public/forms/${outsiderSlug}/submissions`)
      .send({ answers: [{ fieldId: outsiderFieldId, value: "Private" }] });

    const overview = await owner.get("/api/v1/forms/analytics");

    expect(overview.status).toBe(200);
    expect(overview.body.data.analytics).toMatchObject({
      totalForms: 2,
      publishedForms: 1,
      totalResponses: 2,
      last7DaysResponses: 2,
      forms: expect.arrayContaining([
        {
          formId: ownerPublishedId,
          title: "Published survey",
          status: "published",
          publishedVersion: 1,
          totalResponses: 2,
          last7DaysResponses: 2
        },
        {
          formId: ownerDraftId,
          title: "Unpublished survey",
          status: "draft",
          publishedVersion: 0,
          totalResponses: 0,
          last7DaysResponses: 0
        }
      ])
    });
    expect(
      overview.body.data.analytics.trend.reduce(
        (sum: number, point: { count: number }) => sum + point.count,
        0
      )
    ).toBe(2);
    expect(JSON.stringify(overview.body)).not.toContain("Outsider survey");
  });

  it("refuses to publish an empty form", async () => {
    const owner = request.agent(app);
    await register(owner, "owner@example.com");
    const creation = await owner.post("/api/v1/forms").send({ title: "Empty form" });

    const publish = await owner.post(`/api/v1/forms/${creation.body.data.form.id}/publish`);
    expect(publish.status).toBe(400);
    expect(publish.body.error.code).toBe("EMPTY_FORM");
  });

  it("hides another user's forms behind the ownership boundary", async () => {
    const owner = request.agent(app);
    const outsider = request.agent(app);
    await register(owner, "owner@example.com", "Owner");
    await register(outsider, "outsider@example.com", "Outsider");

    const creation = await owner.post("/api/v1/forms").send({ title: "Private form" });
    const formId = creation.body.data.form.id as string;

    const read = await outsider.get(`/api/v1/forms/${formId}`);
    const update = await outsider
      .patch(`/api/v1/forms/${formId}`)
      .send({ title: "Hijacked" });
    const deletion = await outsider.delete(`/api/v1/forms/${formId}`);
    const publish = await outsider.post(`/api/v1/forms/${formId}/publish`);
    const responses = await outsider.get(`/api/v1/forms/${formId}/submissions`);
    const analytics = await outsider.get(`/api/v1/forms/${formId}/analytics`);

    for (const response of [read, update, deletion, publish, responses, analytics]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("FORM_NOT_FOUND");
    }

    const original = await owner.get(`/api/v1/forms/${formId}`);
    expect(original.status).toBe(200);
    expect(original.body.data.form.title).toBe("Private form");
  });

  it("clears the session cookie on logout", async () => {
    const agent = request.agent(app);
    await register(agent, "owner@example.com");

    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(204);

    const currentUser = await agent.get("/api/v1/auth/me");
    expect(currentUser.status).toBe(401);
  });
});
