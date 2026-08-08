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
- `POST /api/v1/forms/:formId/duplicate`
- `GET /api/v1/forms/:formId`
- `PATCH /api/v1/forms/:formId`
- `POST /api/v1/forms/:formId/publish`
- `GET /api/v1/forms/:formId/submissions?page=1&limit=10`
- `GET /api/v1/forms/:formId/analytics`
- `DELETE /api/v1/forms/:formId`

List limits are bounded to 50. Read, duplicate, update, and delete operations
scope the database query by both `formId` and the authenticated `ownerId`.

Example create request:

```json
{
  "title": "Customer feedback",
  "description": "A short customer research survey."
}
```

Draft fields are embedded in the form and replaced atomically through `PATCH`.
Each field has a stable client-generated UUID and one of `shortText`, `longText`,
`number`, `select`, or `checkbox`. A form is limited to 50 fields and a dropdown
to 20 unique, non-empty options.

Duplicating a form copies its title, description, and fields into a new draft.
The copied fields receive new UUIDs. Published versions, the public slug,
submissions, and analytics remain attached only to the source form.

Example draft update:

```json
{
  "title": "Customer feedback",
  "description": "A two-minute customer research survey.",
  "fields": [
    {
      "id": "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
      "type": "select",
      "label": "How satisfied are you?",
      "description": "Choose the answer that fits best.",
      "placeholder": "Select one",
      "required": true,
      "options": ["Very satisfied", "Satisfied", "Not satisfied"]
    }
  ]
}
```

Publishing returns both the updated owner form and the immutable live version.
The first publish creates a stable public slug; later publishes retain that slug
and increment the version.

## Public forms

- `GET /api/v1/public/forms/:slug`
- `POST /api/v1/public/forms/:slug/submissions`

Public reads return only the current published snapshot. Submission input contains
one answer per stable field ID:

```json
{
  "answers": [
    {
      "fieldId": "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
      "value": "Very satisfied"
    }
  ]
}
```

The API rejects duplicate or unknown field IDs, missing required answers, incorrect
value types, and dropdown values absent from the published options. Successful
responses return only a submission ID, form version, and submission timestamp.
