# FormForge

FormForge is a MERN form builder for creating, publishing, and analyzing dynamic forms.

## Current milestone

The repository currently includes:

- A React form-builder shell with drag-and-drop field ordering.
- Editable field properties.
- An Express API foundation with health checks and safe defaults.
- MongoDB connection support through `MONGODB_URI`.
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
