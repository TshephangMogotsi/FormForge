# Architecture decisions

## ADR-001: Separate client and server workspaces

The React client and Express API are separate npm workspaces in one repository. This keeps browser and server boundaries explicit while preserving a single install and command surface.

## ADR-002: Store fields inside form documents

Field definitions are embedded because they are bounded and always read with their form. Submissions remain separate because they are unbounded and have different query patterns.

## ADR-003: Separate drafts from published snapshots

Editing a draft must not silently change a live public form. Publishing copies the current draft into a versioned snapshot. Public rendering and validation use that snapshot.

## ADR-004: Use stable client-generated field IDs

Every field receives a UUID when created. Submission answers reference that ID, allowing fields to be reordered without changing their identity.

## ADR-005: Serve client and API from one origin in production

One production origin simplifies HTTP-only authentication cookies and avoids unnecessary cross-origin complexity. Vite proxies `/api` to Express during development.

## ADR-006: Start as a modular monolith

The API remains one deployable Node.js service with feature-based modules.
FormForge does not currently have the traffic, team boundaries, or independent
scaling needs that justify microservices. Modules will expose narrow service
interfaces so a measured boundary can be extracted later without prematurely
adding distributed-system failure modes.

## ADR-007: Be AWS-ready without coupling the domain to AWS

Application code will depend on interfaces for storage, notifications, and
third-party integrations. A reference production deployment can use ECS or EC2,
IAM, CloudWatch, managed secrets, and MongoDB Atlas without putting AWS SDK
calls throughout domain logic. This preserves local development and testability.

## ADR-008: Treat low-bandwidth performance as a product constraint

Public forms are the highest-reach surface and must remain small, mobile-first,
and resilient. Heavy builder and analytics features may be loaded separately.
Performance budgets will be checked in production builds, and claims will be
based on measurements rather than assumptions.

## ADR-009: Keep AI assistance outside the critical path

AI-assisted form generation may be added after the core workflow is reliable.
Generated output will be treated as untrusted input, validated against the same
form schema, and routed through a provider-neutral adapter. Publishing and
submitting forms must continue working when an AI provider is unavailable.

## ADR-010: Use revocable opaque sessions

Authentication uses a high-entropy opaque token in an HTTP-only, SameSite
cookie. MongoDB stores only the SHA-256 digest with a TTL expiry. This adds a
database lookup to authenticated requests, but it supports real logout,
server-side revocation, and deletion of expired sessions without placing user
claims in browser-readable storage. Stateless JWT cookies were rejected for
this MVP because immediate revocation would require an additional deny-list or
short refresh-token workflow.

## ADR-011: Deliver one immutable container through GitHub Actions

The production build packages the React client and Express API into one
container, preserving the same-origin boundary from ADR-005. Pull requests and
pushes are type-checked, tested, and built before a successful `main` build is
published to GitHub Container Registry with a commit-SHA tag. A deploy target
can promote or roll back an already-verified image without rebuilding it.

Separate client and API deployments were rejected for the initial launch
because they add cross-origin cookie configuration, coordinated releases, and
another operational surface without providing a current scaling benefit.
