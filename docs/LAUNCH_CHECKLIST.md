# Guest-first public trial checklist

## Completed locally on 2026-08-09

- TypeScript checks, API integration tests, Chromium journeys, and the production build pass.
- The guest journey covers refresh recovery, storage denial, interrupted claim and publish,
  email-verification gating, 360-pixel layout, keyboard operation, and accessible names.
- The strict funnel rejects arbitrary content and retains accepted records for 90 days.
- Initial JavaScript measured 76.62 KiB gzip against 150 KiB; the public-form route
  measured 1.96 KiB against 10 KiB, with guest-builder code in a separate lazy chunk.

## Required before the public trial

- Configure and verify the SES sender and exercise real verification delivery.
- Obtain explicit deployment approval and deploy an immutable, verified commit SHA.
- Record the workflow run, deployed SHA, time, readiness result, and controlled
  guest-to-publication smoke test.
- Confirm the preceding known-good SHA and exercise the documented rollback workflow
  or record an approved rollback drill result.
- Review the first small trial through aggregate funnel output before expanding scope.

The local completion record is not production rollout evidence. Follow
`docs/RUNBOOK.md` and do not deploy as part of local Phase 6 verification.
