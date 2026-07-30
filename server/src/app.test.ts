import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { AuthService } from "./features/auth/auth.service.js";
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
  UpdateFormRecord
} from "./features/forms/form.repository.js";
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
}

class InMemoryFormRepository implements FormRepository {
  private readonly forms = new Map<string, FormRecord>();
  private nextId = 100;

  async create(input: CreateFormRecord): Promise<FormRecord> {
    const now = new Date();
    const form: FormRecord = {
      ...input,
      id: this.nextId.toString(16).padStart(24, "0"),
      status: "draft",
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
    return form ? this.forms.delete(formId) : false;
  }
}

function createTestApp() {
  const users = new InMemoryUserRepository();
  const forms = new InMemoryFormRepository();
  const auth = new AuthService(
    users,
    new SessionService(new InMemorySessionRepository()),
    4
  );

  return createApp({
    auth,
    forms: new FormService(forms)
  });
}

async function register(
  agent: ReturnType<typeof request.agent>,
  email: string,
  name = "Test User"
) {
  return agent.post("/api/v1/auth/register").send({
    name,
    email,
    password: "correct-horse-42"
  });
}

describe("FormForge API", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
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
      password: "short"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("short");
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

  it("requires authentication before form access", async () => {
    const response = await request(app).get("/api/v1/forms");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
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
      title: "Quarterly customer feedback"
    });
    expect(update.status).toBe(200);
    expect(update.body.data.form.title).toBe("Quarterly customer feedback");

    const deletion = await owner.delete(`/api/v1/forms/${formId}`);
    expect(deletion.status).toBe(204);
    expect((await owner.get("/api/v1/forms")).body.data.forms).toHaveLength(0);
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

    for (const response of [read, update, deletion]) {
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
