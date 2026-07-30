# FormForge repository guidance

## Product

FormForge is a MERN form builder. The primary workflow is:

1. Sign in.
2. Create and configure a form.
3. Publish it.
4. Collect submissions.
5. Review responses and analytics.

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

## Verification

- Run `npm run typecheck` after TypeScript changes.
- Run `npm test` after server behavior changes.
- Run `npm run build` before marking a phase complete.
- Update `docs/IMPLEMENTATION_PLAN.md` as phases progress.
- Record material architecture changes in `docs/DECISIONS.md`.
