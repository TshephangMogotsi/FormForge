# FormForge

FormForge is a MERN form builder for creating, publishing, and analyzing dynamic forms.

## Current milestone

The repository currently includes:

- A React form-builder shell with drag-and-drop field ordering.
- Editable field properties.
- Registration, login, logout, and session restoration.
- Revocable Mongo-backed sessions using HTTP-only cookies.
- Protected form CRUD with server-enforced ownership.
- A dashboard backed by live API form data.
- Zod request validation, structured request logs, and correlation IDs.
- Integration tests for authentication and cross-user isolation.
- Project specifications, API contracts, and architecture decisions.

## Local setup

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173`.

The API runs on `http://localhost:4000`.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

See `docs/IMPLEMENTATION_PLAN.md` for the delivery roadmap.

## Delivery

The production build ships the React client and Express API as one same-origin
container. GitHub Actions verifies pull requests and publishes successful
`main` builds as versioned images. See `docs/DEPLOYMENT.md` for runtime
configuration, launch gates, and rollback strategy.

## Engineering evidence

FormForge is intentionally developed as a portfolio-quality system rather than
a UI-only demo. The repository records:

- Product scope and non-functional requirements.
- API and security boundaries.
- Architecture decisions and rejected alternatives.
- A phased implementation and verification plan.
- How the project demonstrates skills expected in mid-level MERN roles.

Start with `docs/ARCHITECTURE.md` and `docs/CAREER_ALIGNMENT.md`.
