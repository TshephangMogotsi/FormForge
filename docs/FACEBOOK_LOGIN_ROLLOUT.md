# Deferred Facebook Login rollout

## Status on 2026-08-09

Facebook Login is implemented and verified locally, but intentionally disabled in
production. Meta requires a verified business portfolio and App Review before people
outside the app's roles can authenticate. The owner does not currently have a registered
business, so exposing the production button would send public users into a provider error.

Google sign-in is the only social provider enabled for the initial public rollout.

## Completed work

- The server implements the authorization-code flow through
  `FacebookOAuthProvider`, including an eight-second timeout and a pinned Graph API
  version.
- The flow requests only `public_profile,email`, requires an email response, and links or
  creates the FormForge user through the shared social-auth service.
- State is stored in short-lived, HTTP-only cookies and the callback preserves guest draft
  save/publish intent.
- The client discovers enabled providers from `/api/v1/auth/providers`; the Facebook
  button therefore stays hidden when production credentials are not injected.
- Local credentials are configured and the development account can exercise the flow.
- The Meta app contains the Facebook Login use case. Client OAuth Login, Web OAuth Login,
  HTTPS enforcement, and strict redirect matching are enabled.
- Meta automatically permits the local development callback:
  `http://localhost:5173/api/v1/auth/facebook/callback`.
- The production callback was prepared as:
  `https://formforge.valiantmedia.co.bw/api/v1/auth/facebook/callback`.
- Encrypted SSM parameters are reserved at
  `/formforge/production/facebook-app-id` and
  `/formforge/production/facebook-app-secret`, but the production workflow does not
  inject them.

## Resume prerequisites

1. Register or otherwise establish a business that can truthfully complete Meta business
   verification; do not submit invented or mismatched information.
2. Create a monitored privacy contact such as `privacy@valiantmedia.co.bw`. The domain
   currently uses Microsoft 365, so add it there as an alias or shared mailbox rather than
   changing MX records.
3. Publish stable HTTPS pages for privacy, terms, and user-data-deletion instructions.
4. In Meta App Settings, set:
   - App domain: `formforge.valiantmedia.co.bw`
   - Privacy policy: `https://formforge.valiantmedia.co.bw/privacy`
   - Terms: `https://formforge.valiantmedia.co.bw/terms`
   - Data deletion instructions: `https://formforge.valiantmedia.co.bw/data-deletion`
5. Complete Meta business verification, the Facebook Login App Review, and all data-use
   questions, then publish the Meta app.
6. Confirm the production callback remains in Valid OAuth Redirect URIs:
   `https://formforge.valiantmedia.co.bw/api/v1/auth/facebook/callback`.
7. Re-enable the two Facebook SSM entries in
   `.github/workflows/deploy-production.yml`, deploy a new immutable release, and verify
   sign-in with both an app-role account and an unrelated Facebook account.

## Verification before enabling

- Confirm `/api/v1/auth/providers` reports `facebook: true` only after the approved
  credentials reach the production task.
- Complete sign-in, returning-user sign-in, logout, and guest draft claim/resume checks.
- Confirm cancellation, missing-email, provider outage, expired state, and existing-email
  conflict paths remain safe.
- Keep Facebook disabled if Meta returns the app to Development mode or withdraws access.
