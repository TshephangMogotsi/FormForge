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

## AWS delivery foundation

The AWS reference deployment uses ECS Express Mode in `eu-west-1`. The
CloudFormation template in `infra/foundation.yml` creates the private ECR
repository and IAM boundaries, but no running compute.

GitHub Actions authenticates through OIDC. Its trust policy accepts only the
immutable owner/repository identity for `TshephangMogotsi/FormForge` on
`refs/heads/main`, and its permissions are limited to:

- publishing images to the FormForge ECR repository;
- creating or updating the ECS Express service;
- passing the dedicated ECS execution and infrastructure roles.

The production Atlas URI is supplied to ECS from the SSM Parameter Store
`SecureString` `/formforge/production/mongodb-uri`. It is never stored in the
repository or GitHub.

## Runtime configuration

Production secrets belong in the hosting platform, never in GitHub or the
repository's `.env` file.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables secure cookies, trusted proxy handling, and static client serving |
| `PORT` | Port assigned by the hosting platform |
| `CLIENT_ORIGIN` | Allowed Vite origin during local development; production CORS is disabled |
| `MONGODB_URI` | Atlas connection string for the production database user |
| `SESSION_TTL_HOURS` | Server-side and cookie session lifetime |

## Launch gate

Before exposing the service:

- configure TLS and the final `CLIENT_ORIGIN`;
- create a least-privilege Atlas user for the `formforge` database;
- allow only the API infrastructure's stable outbound address in Atlas;
- confirm the ECS and load-balancer credit consumption before creating them;
- verify registration, login, logout, form creation, and session restoration;
- verify `/api/health` from outside the hosting network;
- protect `main` so verification must pass before merge;
- retain the preceding container SHA for rollback.

Infrastructure-specific deployment is intentionally separate from application
delivery. The same verified image can run on EC2, ECS, or another container
host without changing domain code.
