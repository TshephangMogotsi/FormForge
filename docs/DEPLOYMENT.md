# Deployment and delivery

## Production unit

FormForge ships as one container. The build compiles the React application and
the Express API, and the API serves the static client in production. Keeping one
origin preserves the existing HTTP-only, SameSite session-cookie boundary and
avoids adding cross-site authentication complexity.

The container:

- runs as an unprivileged user;
- contains production dependencies only;
- exposes the Express service on `PORT`;
- reports database connectivity through `/api/health`;
- includes a Docker health check.

## Continuous delivery

`.github/workflows/delivery.yml` runs on pull requests and pushes:

1. Install exactly the dependency versions in `package-lock.json`.
2. Type-check both workspaces.
3. Run the API test suite.
4. Build the server and client production artifacts.
5. On a successful push to `main`, assume the AWS deployment role through OIDC.
6. Build once and publish the container to GHCR with the full commit-SHA and
   moving `latest` tags.
7. Copy a missing commit-SHA release into immutable private ECR. A workflow
   re-run detects and reuses an existing release instead of trying to overwrite
   it.

The hosting platform should deploy an immutable `sha-*` image after it passes
the health check. Rollback means selecting the previous known-good SHA rather
than rebuilding old source.

## Pull request previews

An in-repository pull request receives an ephemeral ECS Express service after
the same type-check, API test, browser test, and production-build gate passes.
Each preview:

- uses an immutable `pr-<number>-<commit>` ECR image;
- runs as `formforge-pr-<number>` with one task and no autoscaling;
- reads only `/formforge/preview/*` SSM parameters;
- uses a PR-specific MongoDB database name rather than production data;
- runs without the production SES permission; and
- is deleted, together with its managed load balancer, when the PR closes.

The preview deployment role is trusted only by the GitHub `preview`
environment. Configure that environment with appropriate branch restrictions or
required reviewers. Preview services create billable Fargate and load-balancer
resources, so stale PRs should be closed promptly even though the cleanup
workflow is automatic.

## AWS delivery foundation

The AWS reference deployment uses ECS Express Mode in `eu-west-1`. The
CloudFormation template in `infra/foundation.yml` creates the private ECR
repository and IAM boundaries, but no running compute.

GitHub Actions authenticates through OIDC. Its trust policy accepts only the
immutable owner/repository identity for `TshephangMogotsi/FormForge` on
`refs/heads/main` or its `production` environment, and its permissions are
limited to:

- publishing images to the FormForge ECR repository;
- creating or updating the ECS Express service;
- passing the dedicated ECS execution, application, and infrastructure roles.

The production Atlas URI is supplied to ECS from the SSM Parameter Store
`SecureString` `/formforge/production/mongodb-uri`. It is never stored in the
repository or GitHub.

The verified Amazon SES sender is supplied from
`/formforge/production/password-reset-from-email`. The application task role
can send only through the `PasswordResetSesIdentity` email or domain identity;
the task execution role reads the sender address without exposing it in the
container definition. A domain identity may authorize a sender address beneath
that domain, such as `no-reply@formforge.example.com`. The
`PasswordResetFromAddress` IAM condition restricts sending to that exact
address.

New SES accounts begin in the sandbox. While sandboxed, reset messages can be
sent only to verified recipient identities. Request SES production access
before treating password recovery as generally available to public users.

Production deployment is a separate, manually triggered GitHub workflow. It
selects the immutable image for the chosen `main` commit, deploys it to ECS
Express Mode, waits for service stability, and smoke-tests the public health
endpoint. This explicit gate prevents every application commit from
automatically creating or changing continuously billed infrastructure.

## Custom domain edge

`formforge.valiantmedia.co.bw` is a proxied Cloudflare DNS record. A narrowly
scoped Worker route forwards only `formforge.valiantmedia.co.bw/*` to the
AWS-managed ECS Express hostname while rewriting the upstream hostname. This is
required because the ECS Express gateway routes requests by its generated host.
Cloudflare terminates public TLS; the Worker connects to the AWS origin over
HTTPS. The generated AWS URL remains available for health checks and rollback.

The route must never use `*.valiantmedia.co.bw/*`, because that would send every
subdomain through the application Worker. `PUBLIC_APP_ORIGIN` is set to the
branded HTTPS origin so password-reset links return users through the same edge.

## Runtime configuration

Production secrets belong in the hosting platform, never in GitHub or the
repository's `.env` file.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables secure cookies, trusted proxy handling, and static client serving |
| `PORT` | Port assigned by the hosting platform |
| `CLIENT_ORIGIN` | Allowed Vite origin during local development; production CORS is disabled |
| `PUBLIC_APP_ORIGIN` | Trusted origin used to build password-reset links |
| `MONGODB_URI` | Atlas connection string for the production database user |
| `MONGODB_DATABASE` | Optional logical database override used for PR isolation |
| `SESSION_TTL_HOURS` | Server-side and cookie session lifetime |
| `PASSWORD_RESET_TTL_MINUTES` | Single-use reset-link lifetime |
| `PASSWORD_RESET_FROM_EMAIL` | Verified Amazon SES sender |

## Launch gate

Before exposing the service:

- configure TLS and the final `PUBLIC_APP_ORIGIN`;
- create a least-privilege Atlas user for the `formforge` database;
- allow only the API infrastructure's stable outbound address in Atlas;
- confirm the ECS and load-balancer credit consumption before creating them;
- verify registration, login, logout, form creation, and session restoration;
- verify password-reset delivery, token expiry, one-time consumption, and
  session revocation;
- verify `/api/health` from outside the hosting network;
- protect `main` so verification must pass before merge;
- retain the preceding container SHA for rollback.

Infrastructure-specific deployment is intentionally separate from application
delivery. The same verified image can run on EC2, ECS, or another container
host without changing domain code.
