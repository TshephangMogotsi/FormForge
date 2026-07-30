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
