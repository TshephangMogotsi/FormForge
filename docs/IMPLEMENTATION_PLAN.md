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
- [x] Connect the dashboard to live form data.
- [x] Add request validation, structured logs, and auth-focused integration tests.

## Phase 3 — Builder persistence

- [ ] Persist draft field schemas.
- [ ] Add debounced autosave with visible status.
- [ ] Complete settings for all five field types.
- [ ] Add preview mode.

## Phase 4 — Publishing and submissions

- [ ] Publish immutable snapshots with version numbers.
- [ ] Render public forms by slug.
- [ ] Generate client validation from field definitions.
- [ ] Revalidate every submission against the published schema.
- [ ] Store submissions separately from forms.

## Phase 5 — Responses and delivery

- [ ] Add paginated responses.
- [ ] Add response trends and option distributions.
- [ ] Seed a demo account and realistic form.
- [ ] Finish responsive states and accessibility.
- [ ] Deploy and record the demo workflow.

## Phase 6 — Production engineering evidence

- [ ] Publish an OpenAPI specification and example requests.
- [x] Add a production Dockerfile for the same-origin application.
- [ ] Add a local Compose stack with MongoDB.
- [x] Add CI for types, tests, production builds, and immutable container images.
- [ ] Add dependency-aware readiness checks.
- [x] Add structured request logging and error correlation IDs.
- [ ] Test the public form at mobile breakpoints and under network throttling.
- [ ] Add API pagination limits, rate-limit policy, and abuse-case documentation.
- [x] Document and codify the AWS registry, OIDC, IAM, and managed-secret
  foundation for an ECS reference deployment.
- [ ] Resolve the production Atlas network-access boundary.
- [ ] Deploy the ECS runtime and verify CloudWatch logs and health checks.
- [ ] Add a rollback-aware deployment workflow and operational runbook.

## Optional differentiator after the core is complete

- [ ] Add AI-assisted form generation behind a provider-neutral interface.
- [ ] Validate generated schemas before persistence.
- [ ] Apply timeouts, usage limits, redacted logs, and graceful provider failure.
