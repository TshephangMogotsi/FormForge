# FormForge repository guidance

## Product

FormForge is a MERN form builder. The primary workflow is:

1. Sign in.
2. Create and configure a form.
3. Publish it.
4. Collect submissions.
5. Review responses and analytics.

## Portfolio and hiring context

This project should demonstrate mid-level full-stack engineering judgment, not
only feature output. The codebase is intended as evidence for MERN roles that
value scalable REST APIs, responsive low-bandwidth experiences, AWS awareness,
testing, CI/CD, documentation, and technical leadership potential.

- Prefer explicit, explainable architecture decisions over fashionable complexity.
- Keep the MVP a modular monolith; introduce services only when a measured boundary requires them.
- Treat mobile usability, accessibility, and low-bandwidth performance as product requirements.
- Design external integrations behind small interfaces with timeouts, retries, and safe failure modes.
- Keep production concerns visible: structured logs, health checks, configuration validation,
  least privilege, dependency hygiene, container builds, and automated verification.
- Document tradeoffs and rejected alternatives in `docs/DECISIONS.md`.
- Keep `docs/ARCHITECTURE.md` synchronized with material system changes.
- Never claim scale, performance, security, or reliability that has not been measured or tested.

## Engineering expectations

- Use TypeScript throughout the client and server.
- Keep controllers and route handlers thin; business logic belongs in services.
- Validate all external input on the server with Zod.
- Enforce ownership and authorization on the server, not only in the UI.
- Preserve stable UUID field identifiers. Never use array indexes as field IDs.
- Keep submissions separate from form documents.
- Public forms must render the published snapshot, never the mutable draft.
- Add or update tests for security-sensitive behavior.
- Avoid speculative abstractions and features outside `docs/PRODUCT_SPEC.md`.
- Use conventional, natural-language Git messages that explain the developer intent.
- Keep commits focused enough to review and revert independently.

## Verification

- Run `npm run typecheck` after TypeScript changes.
- Run `npm test` after server behavior changes.
- Run `npm run build` before marking a phase complete.
- Update `docs/IMPLEMENTATION_PLAN.md` as phases progress.
- Record material architecture changes in `docs/DECISIONS.md`.
