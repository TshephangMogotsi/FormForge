# FormForge

FormForge is a MERN form builder for creating, publishing, and analyzing dynamic forms.

**Live application:** [formforge.valiantmedia.co.bw](https://formforge.valiantmedia.co.bw)

**Public demo form:** [Customer experience pulse](https://formforge.valiantmedia.co.bw/f/customer-experience-pulse-b408a7eb)

## Current milestone

The repository currently includes:

- A persistent React form builder with drag-and-drop ordering and autosave.
- Immutable versioned publishing and lightweight public form pages.
- Server-validated submissions, paginated response review, and basic analytics.
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

## Demo data

The optional seeder creates a dedicated demo user, publishes a realistic customer
experience form, and adds 24 responses across the last seven days. It is idempotent
for the configured account and never logs the password. For an existing account,
only `DEMO_USER_EMAIL` is required.

```bash
DEMO_USER_EMAIL=demo@example.com \
DEMO_USER_PASSWORD='choose-a-private-password' \
npm run seed:demo --workspace server
```

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
