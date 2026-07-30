import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("FormForge API", () => {
  it("reports service health", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "formforge-api"
    });
  });

  it("uses the shared API error shape for unknown routes", async () => {
    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "No route matches GET /api/unknown."
      }
    });
  });
});
