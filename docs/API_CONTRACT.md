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

- `GET /api/health/live` — process liveness; does not depend on MongoDB.
- `GET /api/health/ready` — dependency readiness; returns `503` until a bounded
  MongoDB ping succeeds.
- `GET /api/health` — compatibility summary for existing monitors.

New container checks use liveness, while load-balancer and deployment gates use
readiness.

## Authentication

- `POST /api/v1/auth/register` — creates a user and opaque session cookie.
- `POST /api/v1/auth/login` — verifies credentials and creates a new session.
- `GET /api/v1/auth/providers` — reports whether Google and Facebook login are configured.
- `GET /api/v1/auth/google` and `/facebook` — start a server-side authorization-code flow.
- `GET /api/v1/auth/google/callback` and `/facebook/callback` — validate transient state,
  establish the normal opaque session, and return to an allowlisted local path.
- `POST /api/v1/auth/forgot-password` — accepts an email and always returns the
  same `202` response, whether or not the account exists.
- `POST /api/v1/auth/reset-password` — consumes a single-use reset token,
  changes the password, and revokes every existing session.
- `POST /api/v1/auth/email-verification` — authenticated resend; returns `200` without
  sending when the address is already verified.
- `POST /api/v1/auth/verify-email` — consumes a single-use email-verification token.
- `PATCH /api/v1/auth/email` — corrects an unverified authenticated user's email after
  checking the current password and sends a replacement link. Changes to an already
  verified address are outside the public-trial scope.
- `POST /api/v1/auth/logout` — revokes the current session and clears its cookie.
- `GET /api/v1/auth/me` — returns the current public user.

Passwords are never returned. The session cookie is HTTP-only, SameSite `Lax`,
and `Secure` in production.

Registration and password reset both require `password` and `confirmPassword`.
Registration requires only email and password in the UI; the server assigns the
neutral display name `FormForge User`. The API still accepts an optional bounded
`name` for backward compatibility.
Reset tokens expire after 30 minutes by default. Only their SHA-256 digests are
stored, and consuming a token atomically deletes it.

Public users include `emailVerifiedAt`, which is `null` until verification. Verification
tokens expire after 60 minutes by default, are stored only as SHA-256 digests, and are
replaced whenever a link is resent or the email changes.

Social login uses ten-minute HTTP-only transient cookies for CSRF state, return intent,
and Google PKCE/nonce values. Provider access and identity tokens are verified server-side,
are never returned to the browser, and are not persisted. A verified Google email may
link to the matching local account. Facebook email does not silently link an existing
account and remains subject to FormForge email verification before publication.

## Forms

All form endpoints require authentication.

- `GET /api/v1/forms?page=1&limit=20`
- `POST /api/v1/forms`
- `PUT /api/v1/forms/claims/:guestDraftId`
- `POST /api/v1/forms/:formId/duplicate`
- `GET /api/v1/forms/:formId`
- `PATCH /api/v1/forms/:formId`
- `POST /api/v1/forms/:formId/publish`
- `GET /api/v1/forms/analytics`
- `GET /api/v1/forms/:formId/submissions?page=1&limit=10`
- `GET /api/v1/forms/:formId/analytics`
- `DELETE /api/v1/forms/:formId`

List limits are bounded to 50. Read, duplicate, update, and delete operations
scope the database query by both `formId` and the authenticated `ownerId`.

The claim endpoint accepts a complete validated draft and uses the UUID
`guestDraftId` as an idempotency key scoped to the authenticated owner. Its first
successful `PUT` creates an owner-scoped draft and returns `200`; retries return that
same form without replacing its contents. A different owner can independently claim a
draft with the same browser identifier. Unauthenticated claims return `401`.

Example guest-draft claim:

```http
PUT /api/v1/forms/claims/4a73a448-4fcc-4a9e-9cb1-c7ff2c735baa
```

```json
{
  "title": "Community event signup",
  "description": "Register your interest.",
  "fields": [
    {
      "id": "b3b2c1d0-7a6f-4f52-91af-2f2a5cf56e21",
      "type": "shortText",
      "label": "Your name",
      "description": "",
      "placeholder": "Ada Builder",
      "required": true,
      "options": []
    }
  ]
}
```

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

The collection analytics endpoint returns owner-scoped totals for forms,
published forms, all responses, responses from the last seven UTC days, a
seven-day response trend, and per-form response totals. Form-specific analytics
remain available through `/api/v1/forms/:formId/analytics`.

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
and increment the version. Every publication requires a verified email. The public
trial defaults to 25 forms and 5 distinct published forms per account; updates to an
already-published form remain available.

## Public forms

- `GET /api/v1/public/forms/:slug`
- `POST /api/v1/public/forms/:slug/submissions`
- `POST /api/v1/public/forms/:slug/reports`

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

Abuse reports accept a reason (`spam`, `phishing`, `harmful`, or `other`), up to 1,000
characters of detail, and an optional reporter email. Reports are accepted only for a
currently published form and return only a report ID and timestamp.

## Acquisition funnel events

- `POST /api/v1/events`

The unauthenticated endpoint accepts a strict, content-free event envelope and returns
`202` with no response body. The only accepted properties are `name`, ISO timestamp,
anonymous and session UUIDs, a sanitized optional campaign, device class, and an
optional bounded failure category. Form IDs, user IDs, email addresses, titles, field
definitions, answers, URLs, and arbitrary metadata are rejected as unknown properties.

Accepted journey names are `builder_opened`, `first_meaningful_edit`,
`publish_selected`, `auth_prompt_shown`, `auth_succeeded`, `draft_claimed`, and
`publish_succeeded`. Bounded diagnostic names cover authentication, claim, publication,
and browser-storage failures. Events expire after 90 days.

## Limits and abuse handling

JSON request bodies are capped at 100 KB and return `413 PAYLOAD_TOO_LARGE` when
exceeded. List endpoints accept `limit` values from 1 through 50. Repeated requests
return `429 RATE_LIMITED` with standard rate-limit headers and `Retry-After`.

The exact windows, limits, known abuse cases, and scaling limitation of the current
process-local counters are documented in `docs/ABUSE_CASES.md`.
