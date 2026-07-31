# API contract

Versioned application routes use `/api/v1`. The unversioned health endpoint is
reserved for infrastructure checks.

All errors include a correlation ID:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "details": [
      {
        "path": "email",
        "message": "Enter a valid email address."
      }
    ],
    "requestId": "f58f0407-b88a-49af-b165-bb23645385d0"
  }
}
```

## System

- `GET /api/health`

## Authentication

- `POST /api/v1/auth/register` — creates a user and opaque session cookie.
- `POST /api/v1/auth/login` — verifies credentials and creates a new session.
- `POST /api/v1/auth/forgot-password` — accepts an email and always returns the
  same `202` response, whether or not the account exists.
- `POST /api/v1/auth/reset-password` — consumes a single-use reset token,
  changes the password, and revokes every existing session.
- `POST /api/v1/auth/logout` — revokes the current session and clears its cookie.
- `GET /api/v1/auth/me` — returns the current public user.

Passwords are never returned. The session cookie is HTTP-only, SameSite `Lax`,
and `Secure` in production.

Registration and password reset both require `password` and `confirmPassword`.
Reset tokens expire after 30 minutes by default. Only their SHA-256 digests are
stored, and consuming a token atomically deletes it.

## Forms

All form endpoints require authentication.

- `GET /api/v1/forms?page=1&limit=20`
- `POST /api/v1/forms`
- `GET /api/v1/forms/:formId`
- `PATCH /api/v1/forms/:formId`
- `DELETE /api/v1/forms/:formId`

List limits are bounded to 50. Read, update, and delete operations scope the
database query by both `formId` and the authenticated `ownerId`.

Example create request:

```json
{
  "title": "Customer feedback",
  "description": "A short customer research survey."
}
```

## Planned routes

- `POST /api/v1/forms/:formId/duplicate`
- `POST /api/v1/forms/:formId/publish`
- `GET /api/v1/public/forms/:slug`
- `POST /api/v1/public/forms/:slug/submissions`
- `GET /api/v1/forms/:formId/submissions`
- `GET /api/v1/forms/:formId/analytics`
