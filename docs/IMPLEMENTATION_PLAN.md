# Implementation plan

## Phase 1 — Foundation

- [x] Create client/server TypeScript workspaces.
- [x] Add Express health endpoint and middleware baseline.
- [x] Add MongoDB connection configuration.
- [x] Create the first interactive builder shell.
- [x] Install dependencies and verify build, types, and tests.

## Phase 2 — Authentication and forms

- [ ] Add User and Form Mongoose models.
- [ ] Add registration, login, logout, and current-user endpoints.
- [ ] Use secure HTTP-only authentication cookies.
- [ ] Add protected form CRUD endpoints with ownership checks.
- [ ] Connect the dashboard to live form data.

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
