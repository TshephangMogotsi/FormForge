# Guest-first builder implementation plan

## Outcome

A new visitor can experience the complete form-building interaction before creating
an account. Authentication appears only when the visitor asks FormForge to persist a
draft online, publish it, or use another account-owned capability. After successful
authentication, the original action resumes without losing or duplicating the draft.

The initial guest implementation remains client-only. It does not create anonymous
users, forms, sessions, or abandoned records in MongoDB.

## Success criteria

- A signed-out visitor can open `/build/new`, edit every supported field type,
  reorder fields, and use interactive preview.
- The guest draft survives refresh in the same browser and clearly says that it is
  saved only on that device.
- Closing or failing authentication never destroys the guest draft.
- Registration or login claims the guest draft exactly once as an owner-scoped form.
- A publish intent resumes automatically after authentication and successful claim.
- An account user can still use the existing dashboard, draft autosave, publishing,
  responses, and analytics without regressions.
- Guest APIs cannot be used to bypass authentication, ownership, validation, rate
  limits, or publishing rules.
- Funnel events contain no form titles, field labels, response content, email
  addresses, or other draft content.

## Capability boundary

| Capability | Guest | Account required |
| --- | --- | --- |
| Build, configure, reorder, and preview | Yes | No |
| Save one draft on the current device | Yes | No |
| Save across devices or list multiple forms | No | Yes |
| Publish and receive a public URL | No | Yes |
| Responses and analytics | No | Yes |
| Integrations, collaboration, uploads, or metered AI | No | Yes |

## Phase 1 — Shared draft foundation

Separate the builder's form state from its persistence mechanism without changing the
current authenticated behavior.

- Define one shared `FormDraft` contract for title, description, and fields.
- Extract draft initialization and field creation from the authenticated controller.
- Add a versioned, defensive browser-storage adapter for one guest draft.
- Preserve stable UUID field identifiers.
- Never store session identifiers, credentials, or reset tokens with the draft.
- Keep the existing authenticated builder flow and API calls unchanged.

Exit criteria:

- Existing authenticated builder browser tests pass unchanged.
- Storage parsing rejects malformed or obsolete values safely.
- Type checks and the production build pass.

## Phase 2 — Public guest-builder vertical slice

Make the editor useful without a session while keeping account-only navigation out of
the way.

- Introduce stable routes for `/`, `/build/new`, `/dashboard`, `/forms/:formId/edit`,
  `/analytics`, and the existing `/f/:slug` public runtime.
- Render the shared builder through a guest controller at `/build/new`.
- Restore a recent guest draft or create a useful starter form.
- Autosave locally with the states `Saving on this device`, `Saved on this device`,
  and a recoverable storage error.
- Add explicit `Start over`, `Sign in`, and `Publish` actions.
- Keep field editing, drag-and-drop, mobile layout, keyboard behavior, and preview
  available to guests.

Exit criteria:

- A signed-out user can build and refresh without losing the draft.
- Starting over requires confirmation.
- The page makes the local-only limitation unambiguous.
- No unauthenticated form write reaches the API.

## Phase 3 — Contextual authentication and draft claim

Replace the full-page login interruption with authentication that preserves the
builder and the visitor's intent.

- Present authentication in an accessible dialog on desktop and an equivalent compact
  surface on mobile.
- Default to registration and expose login for returning users.
- Explain the benefit: cloud persistence, a share link, responses, and analytics.
- Keep the draft visible, allow dismissal, and restore focus to the triggering action.
- Extend authenticated form creation to accept the complete validated draft.
- Include a stable `guestDraftId` idempotency key scoped to the owner so retries cannot
  create duplicates.
- Claim the guest draft only after the server establishes the authenticated session.
- Clear local data only after the server returns the owner-scoped form.

Exit criteria:

- Closing, failing, or retrying authentication preserves the draft.
- Registration and login both claim the draft once.
- Claim requests remain Zod-validated and owner-scoped.
- Existing users never have another form overwritten implicitly.

## Phase 4 — Resume intent and failure recovery

Complete the conversion path instead of dropping a newly authenticated user on the
dashboard.

- Record a small pending intent such as `save` or `publish`; never serialize form
  content into URLs.
- After claim, replace the guest URL with `/forms/:formId/edit`.
- Automatically resume publishing when Publish triggered authentication.
- If publication fails, retain the claimed account draft and offer a retry.
- If the session expires while editing an owned form, preserve the in-memory draft,
  reauthenticate, retry the save, and return to the same form.
- Import a guest draft as a new form when an existing user signs in.

Exit criteria:

- Publish requires one initial user action, not a second click after authentication.
- Network failures cannot lose work or duplicate the claimed form.
- Back, refresh, and auth recovery return to a valid canonical URL.

## Phase 5 — Public-launch trust and abuse controls

Protect the public FormForge domain without moving friction back to the first builder
interaction.

- Verify an email address before the first public publication, or document and approve
  a narrower temporary launch policy.
- Add resend, expiry, change-email, and already-verified behavior.
- Keep credential, verification, publish, and public-submission rate limits distinct.
- Add per-account form and publication limits based on the public trial policy.
- Treat CAPTCHA or risk challenges as measured escalation controls, not a default
  builder requirement.
- Add clear privacy, acceptable-use, report-abuse, and local-draft messaging.

Exit criteria:

- Unverified or abusive accounts cannot silently host public content.
- Legitimate users retain their completed draft while completing verification.
- Security-sensitive behavior has API integration coverage.

## Phase 6 — Measurement and launch verification

Measure the actual funnel and verify experience quality before expanding scope.

- Record `builder_opened`, `first_meaningful_edit`, `publish_selected`,
  `auth_prompt_shown`, `auth_succeeded`, `draft_claimed`, and `publish_succeeded`.
- Include only event name, timestamp, anonymous/session correlation, source campaign,
  device class, and failure category where appropriate.
- Measure builder-to-edit, edit-to-publish-intent, auth completion, claim success, and
  end-to-end publication conversion.
- Test 360-pixel layouts, keyboard-only use, screen-reader names, refresh recovery,
  slow networks, interrupted claim/publish requests, and storage denial.
- Confirm guest-builder code does not increase the public respondent bundle.
- Run a small public trial before adding collaboration, uploads, integrations, or AI.

Exit criteria:

- The funnel can identify the largest drop-off without collecting draft content.
- The core guest-to-published journey passes automated and manual launch checks.
- Production rollout and rollback evidence is recorded before declaring the phase done.

## Delivery sequence

Each phase should be a focused pull request. AWS pull-request previews consume credits,
so use local Chromium coverage for iteration and create an AWS preview only for the
guest-builder vertical slice and final pre-launch verification when explicitly approved.
