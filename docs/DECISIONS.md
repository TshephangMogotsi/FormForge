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

## ADR-012: Federate GitHub Actions into a staged AWS deployment

AWS infrastructure is introduced in two stages. The foundation creates a
private ECR repository, GitHub OIDC trust, and narrowly scoped ECS roles without
starting compute. The runtime is created only after cost and database-network
access are reviewed.

GitHub Actions receives short-lived AWS credentials only when the exact
`main`-branch publishing subject or the `production` environment subject for
this repository assumes the deployment role. Because this repository uses
GitHub's immutable OIDC subjects, the trust policy pins both the owner and
repository database IDs as well as their names. The workflow can push only to
FormForge's ECR repository, manage the ECS Express service, and pass only its
dedicated execution and infrastructure roles.
Long-lived AWS access keys in GitHub were rejected because OIDC removes secret
rotation and credential-leak risk. Granting GitHub administrator access was
rejected because the delivery workflow does not need account-wide control.

ECS Express Mode is preferred for the first AWS runtime because it preserves a
real Fargate, load-balancer, IAM, CloudWatch, and deployment story while AWS
manages their common wiring. A hand-built VPC and ECS service would offer more
network control, but that complexity is deferred until the Atlas egress
requirement and operating cost justify it.

## ADR-013: Disable CORS in the same-origin production service

The production container serves React and the API from the same HTTPS origin,
so browsers do not need cross-origin permissions. Production omits CORS headers
entirely; local development retains an explicit `CLIENT_ORIGIN` for the Vite
dev-server proxy boundary.

Reflecting arbitrary origins was rejected because credentialed requests use
HTTP-only session cookies. Maintaining a production origin allowlist was also
rejected for the initial same-origin deployment because it adds configuration
without enabling a required client.

## ADR-014: Use hashed, single-use password-reset tokens

Forgot-password responses do not disclose whether an email address belongs to
an account. A request for a known account replaces any older reset token with a
new high-entropy token, stores only its SHA-256 digest, and sends the raw token
only in the owner’s email link. Tokens expire after a short bounded lifetime and
are atomically deleted when consumed. A successful reset revokes every existing
session for that user.

Email delivery sits behind a notifier interface. Production uses Amazon SES
through a narrowly scoped ECS application task role; tests use an in-memory
notifier. Returning reset tokens in API responses or writing them to logs was
rejected because either choice would bypass proof of email ownership.

## ADR-015: Save bounded drafts as atomic documents

Builder edits replace the complete embedded field array after a short client-side
debounce. This keeps field ordering and related settings in one atomic MongoDB
update, while stable UUIDs preserve field identity across reordering. The client
shows pending, saving, saved, and retryable failure states; the server remains the
authority for schema and ownership validation.

Patch-per-field endpoints and collaborative merge logic were rejected for the MVP
because there is one owner editing a bounded maximum of 50 fields. Concurrent tabs
therefore use last-write-wins semantics. If measured usage requires collaborative
or multi-device editing, the next step is optimistic concurrency with a draft
revision—not premature real-time infrastructure.

## ADR-016: Store published versions separately and advance them transactionally

Each publish inserts a new immutable snapshot in a dedicated collection and updates
the form's live-version pointer in the same MongoDB transaction. Public reads follow
the stable slug to that pointer and never render the mutable draft. Republish retains
the slug and increments the version, so existing links remain valid while recorded
submissions continue to identify the schema they answered.

Overwriting one embedded `publishedSnapshot` was rejected because it loses history.
Embedding every version in the form was rejected because publication history is not
a safely bounded array. A separate snapshot service was also rejected because the
modular monolith and MongoDB transaction already provide the required consistency.

## ADR-017: Revalidate public submissions and store them separately

The public client derives fast field-level feedback from the published definition,
but the API independently checks required fields, value types, dropdown membership,
duplicates, and unknown field IDs against the exact live version. Accepted answers
are stored in a separate indexed collection with their form and version references.
Submission content is not returned from the write endpoint or included in logs.

Embedding submissions inside forms was rejected because response counts are
unbounded and have different pagination and analytics access patterns. Trusting only
browser validation was rejected because public callers can bypass the client.
