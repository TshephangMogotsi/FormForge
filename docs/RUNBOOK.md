# FormForge operational runbook

## Scope

This runbook covers the production modular monolith served through Cloudflare and ECS
Express Mode, with MongoDB Atlas and Amazon SES as dependencies. It favors recovery
with an already verified immutable image over live source changes.

Never paste credentials, connection strings, cookies, reset tokens, or submission
content into logs, tickets, commands, or screenshots.

## Service signals

| Signal | Expected result | Meaning |
| --- | --- | --- |
| `GET /api/health/live` | `200`, `status=ok` | The Node process can serve HTTP |
| `GET /api/health/ready` | `200`, `status=ready`, `dependencies.database=ready` | MongoDB accepted a bounded ping |
| `GET /api/health` | `200` | Compatibility summary; do not use for new deployment gates |
| CloudWatch request logs | Structured completion events with request IDs | Request status and latency without request bodies |
| CloudWatch error logs | `request.failed` with request ID | Unexpected server error requiring investigation |

The container health check uses liveness. ECS load-balancer health and deployment smoke
checks use readiness so a task is not sent traffic before MongoDB is usable.

## Routine deployment

1. Confirm the selected commit is on `main` and the Verify and publish workflow passed.
2. Confirm its immutable `sha-<40-character-sha>` image exists in ECR.
3. Run the **Deploy production** workflow. Leave `release_sha` empty for the selected
   ref, or provide the full SHA of a previously verified release.
4. Wait for ECS stabilization and the automated readiness smoke check.
5. Verify the branded root, `/api/health/live`, and `/api/health/ready` externally.
6. Exercise login, form listing, one public form read, and a controlled test submission.
7. Record the workflow run, deployed SHA, time, and result in the release record.

Do not deploy an image tag that was not produced by the verified `main` workflow.

## Rollback

Rollback is appropriate when a deployment introduces elevated errors, broken core
workflow behavior, or readiness failures caused by application code.

1. Identify the preceding known-good full SHA from ECR and the release record.
2. Run **Deploy production** with that SHA in `release_sha`.
3. Wait for ECS stabilization and the automated readiness check.
4. Repeat external health and core workflow checks.
5. Record the rollback and preserve the failed logs and request IDs for diagnosis.

Do not roll back merely to hide a dependency outage. An older image will not repair an
Atlas, SES, DNS, or Cloudflare incident.

## Incident triage

### Readiness is failing but liveness passes

1. Confirm `/api/health/ready` returns `503` and
   `dependencies.database=not-ready`.
2. Inspect CloudWatch logs around the first failure without printing environment
   variables or secret values.
3. Check Atlas cluster status and its network access list.
4. Confirm the ECS task still has outbound connectivity to Atlas's public TLS endpoint.
5. Confirm the SSM parameter exists and the execution role can read it; never retrieve
   its plaintext into a shared terminal log.
6. If the failure followed credential or access-list rotation, restore the preceding
   known-good configuration before further changes.

### Both liveness and readiness fail

1. Inspect ECS task state, deployment events, and container exit reason.
2. Inspect CloudWatch startup logs for configuration validation or bind failures.
3. Confirm the immutable image exists and matches the intended architecture.
4. Roll back if the failure began with a new application release.

### Elevated `5xx` responses

1. Correlate the external `x-request-id` with `request.failed` in CloudWatch.
2. Group by route, status, deployment SHA, and first occurrence.
3. Check readiness and dependency status before assuming an application regression.
4. Roll back when evidence ties the increase to the new SHA.

### Elevated `429` responses or submission spam

1. Determine which boundary is limiting traffic; do not log submitted response bodies.
2. Confirm legitimate clients are not retrying in a tight loop.
3. Preserve source and route counts only to the extent allowed by the privacy policy.
4. For distributed abuse, add an edge or shared-store control rather than only raising
   the per-task limit. Review `docs/ABUSE_CASES.md` before changing thresholds.

### Password-reset delivery failures

1. Confirm SES region and service health.
2. Check safe `password_reset.delivery_failed` metadata in CloudWatch.
3. Confirm the sender identity, sandbox/production status, SSM parameter, and task-role
   permission without exposing recipients or tokens.
4. Keep the generic reset response; do not reveal account existence while diagnosing.

### Email-verification delivery failures

1. Check safe `email_verification.delivery_failed` metadata without logging recipients or tokens.
2. Confirm the shared SES sender identity, production-access status, task-role permission,
   and `PUBLIC_APP_ORIGIN`.
3. Keep claimed drafts private and intact; do not bypass verification to resolve a
   delivery incident.
4. After recovery, use the authenticated resend action so the preceding token is replaced.

### Abuse-report review

1. Review only `new` records in the `abusereports` collection through restricted operator access.
2. Open the referenced published slug without submitting data and assess it against
   `docs/ABUSE_CASES.md` and the acceptable-use page.
3. Do not copy report details or reporter email into logs or broad-access tickets.
4. If abuse is confirmed, preserve the minimum evidence required, unpublish or remove
   the form through an audited operator procedure, and mark the report reviewed.
5. Repeated malicious accounts require an account-restriction capability before the
   public trial expands; do not rely only on IP limits.

### Guest funnel review

1. Run `npm run report:funnel --workspace server` with operator-scoped database access.
2. Review aggregate journey steps and failure categories; the command does not print
   anonymous/session correlation values or form content.
3. Treat sudden event-volume changes as possible instrumentation or pollution before
   interpreting them as conversion changes.
4. Do not extend the event schema with form, account, or respondent data. Record any
   material measurement change in `docs/DECISIONS.md`.

## Secret rotation

1. Create the replacement credential with least privilege.
2. Update the relevant SSM `SecureString` through a private prompt or console.
3. Redeploy the same immutable image so new tasks receive the value.
4. Verify readiness and the affected workflow.
5. Revoke the old credential only after the new path is proven.

## Post-incident record

Record impact, UTC start and end, detection signal, affected SHA, request IDs, root
cause, recovery action, and follow-up owner. Do not include secrets or response data.
Add an architecture decision only when the incident changes a material system boundary.
