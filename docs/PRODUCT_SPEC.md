# FormForge product specification

## Goal

Enable a user to create a dynamic form, publish it, collect submissions, and review responses through one polished workflow.

## MVP

- Guest-first form building without an account.
- One browser-persisted guest draft with clear local-only status.
- Email and password authentication.
- Personal forms dashboard.
- Create, rename, duplicate, and delete forms.
- Drag-and-drop builder.
- Short text, long text, number, dropdown, and checkbox fields.
- Field labels, descriptions, placeholders, options, and required state.
- Draft autosave and preview.
- Explicit publishing with a public slug.
- Contextual authentication that claims a guest draft and resumes publication.
- Email verification before first public publication.
- Public-trial account caps, acceptable-use guidance, and abuse reporting.
- Server-validated public submissions.
- Paginated response table and basic analytics.

## Non-goals

- Server-stored anonymous users or anonymous form records.
- Multiple guest drafts or cross-device guest synchronization.
- Payments.
- File uploads.
- Team collaboration.
- Multi-page forms.
- Webhooks.
- Advanced conditional logic.
- A full theme marketplace.

## Non-functional requirements

- Public forms must work comfortably at a 360px viewport.
- Public form completion must remain usable on slow or unstable connections.
- Initial client JavaScript should remain below 150 kB gzip unless a measured
  product need justifies exceeding the budget.
- All interactive controls must be keyboard accessible and visibly focused.
- Every protected API operation must enforce ownership on the server.
- API input, configuration, and third-party responses must be validated.
- Logs must not include passwords, tokens, raw authentication cookies, or
  sensitive response content.
- Health checks must distinguish process health from dependency readiness.
- Automated checks must cover types, tests, production builds, and dependency
  vulnerabilities.

## Definition of done

A visitor can create and configure a local guest form without authenticating. When the
visitor chooses to publish, FormForge can authenticate them, claim the draft without
loss or duplication, publish it, accept a public response, and show that response in
the owner dashboard.
