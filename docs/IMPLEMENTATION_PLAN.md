# Implementation plan

## Phase 1 — Foundation

- [x] Create client/server TypeScript workspaces.
- [x] Add Express health endpoint and middleware baseline.
- [x] Add MongoDB connection configuration.
- [x] Create the first interactive builder shell.
- [x] Install dependencies and verify build, types, and tests.

## Phase 2 — Authentication and forms

- [x] Add User and Form Mongoose models.
- [x] Add registration, login, logout, and current-user endpoints.
- [x] Use revocable Mongo-backed sessions in secure HTTP-only cookies.
- [x] Add protected form CRUD endpoints with ownership checks.
- [x] Add owner-scoped form duplication with fresh field identifiers.
- [x] Connect the dashboard to live form data.
- [x] Add request validation, structured logs, and auth-focused integration tests.
- [x] Add password confirmation and secure single-use password recovery.

## Phase 3 — Builder persistence

- [x] Persist draft field schemas.
- [x] Add debounced autosave with visible status.
- [x] Complete settings for all five field types.
- [x] Add preview mode.

## Phase 4 — Publishing and submissions

- [x] Publish immutable snapshots with version numbers.
- [x] Render public forms by slug.
- [x] Generate client validation from field definitions.
- [x] Revalidate every submission against the published schema.
- [x] Store submissions separately from forms.

## Phase 5 — Responses and delivery

- [x] Add paginated responses.
- [x] Add response trends and option distributions.
- [x] Add owner-wide analytics with direct form-level drill-down.
- [x] Seed a demo account and realistic form.
- [x] Finish responsive states and accessibility.
- [x] Deploy and record the demo workflow.

## Phase 6 — Production engineering evidence

- [ ] Publish an OpenAPI specification and example requests.
- [x] Add a production Dockerfile for the same-origin application.
- [ ] Add a local Compose stack with MongoDB.
- [x] Add CI for types, tests, production builds, and immutable container images.
- [x] Add browser interaction coverage and isolated pull request preview deployments.
- [x] Add dependency-aware readiness checks.
- [x] Add structured request logging and error correlation IDs.
- [x] Test the public form at mobile breakpoints and under network throttling.
- [x] Add API pagination limits, rate-limit policy, and abuse-case documentation.
- [x] Document and codify the AWS registry, OIDC, IAM, and managed-secret
  foundation for an ECS reference deployment.
- [x] Resolve the no-cost MVP Atlas boundary with explicit risk acceptance and
  least-privilege compensating controls.
- [x] Deploy the ECS runtime and verify CloudWatch logs and health checks.
- [x] Add a rollback-aware deployment workflow.
- [x] Add an operational runbook.

## Phase 7 — Guest-first acquisition

- [x] Define the guest capability boundary, phased delivery plan, and success criteria.
- [x] Extract the shared draft contract and versioned browser storage.
- [x] Add stable application routes and a public guest-builder entry point.
- [x] Add local-only autosave, recovery, and start-over behavior.
- [x] Add contextual registration and login without leaving the builder.
- [x] Claim guest drafts idempotently through the authenticated API.
- [ ] Resume save or publish intent after authentication.
- [ ] Add first-publication trust and abuse controls.
- [ ] Add privacy-safe funnel measurement and launch verification.

Detailed sequencing and exit criteria are in `docs/GUEST_BUILDER_PLAN.md`.

## Optional differentiator after the core is complete

- [ ] Add AI-assisted form generation behind a provider-neutral interface.
- [ ] Validate generated schemas before persistence.
- [ ] Apply timeouts, usage limits, redacted logs, and graceful provider failure.
