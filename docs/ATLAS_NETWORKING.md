# MongoDB Atlas network boundary

## No-cost MVP decision

FormForge will keep the current Free or Flex Atlas tier for the portfolio MVP. The
application connects to Atlas over its public TLS endpoint. AWS PrivateLink and a
dedicated Atlas cluster are deferred until the application has paid-production needs
that justify their cost.

ECS Fargate tasks receive dynamic public addresses, so a stable narrow IP allowlist is
not available in the current ECS Express topology. If the working Atlas configuration
requires `0.0.0.0/0`, that exposure is an explicitly accepted MVP risk, not a private
network boundary or a production-security claim.

This decision avoids new recurring infrastructure cost while keeping the core demo
available. It must be revisited before storing sensitive data, onboarding external
customers, or presenting the service as privately networked.

## Compensating controls

- Use a unique production database user with access only to the FormForge database.
- Grant only the database actions the application needs; never use an Atlas owner or
  administrative credential in the runtime.
- Generate a strong random password and store the URI only in the SSM `SecureString`
  `/formforge/production/mongodb-uri`.
- Let Atlas enforce TLS for every database connection.
- Keep preview credentials separate from production and use a separate logical
  database for each pull request.
- Rotate the database credential after suspected exposure and during scheduled
  security reviews.
- Do not log the URI, credential, raw cookies, password-reset tokens, or submission
  content.

The application-level ownership checks, Zod validation, request limits, and hashed
session tokens remain necessary but do not replace a private database network.

## Verification checklist

Complete these checks without copying the connection string into logs or shared
terminals:

- [x] Confirm the production cluster tier in Atlas.
- [x] Confirm the production database user is restricted to the FormForge database.
- [x] Confirm no runtime Atlas user has project-owner or administrative roles.
- [x] Review the Atlas network access list and record whether broad public access is
  currently required.
- [x] Confirm the production URI exists as an SSM `SecureString` and ECS injects it as
  a secret rather than a plain environment value.
- [x] Confirm `/api/health/ready` succeeds and the core form workflow remains intact.
- [x] Confirm preview uses a distinct credential before enabling preview deployments.

The AWS checks inspect only resource configuration and SSM metadata. They must never
retrieve the parameter with decryption during routine verification.

### 2026-08-09 AWS verification

Read-only inspection confirmed that `formforge-production` is active in three public
subnets across `eu-west-1a`, `eu-west-1b`, and `eu-west-1c`. The ECS task uses an
explicit security group with public outbound access. Its task definition injects
`MONGODB_URI` from `/formforge/production/mongodb-uri`, the parameter is a
`SecureString`, and there is no plain `MONGODB_URI` environment entry. No secret value
was retrieved.

Release `4f8965c607d0107d6a81fb8e6c3d5c52886b04a4` moved the deployed load-balancer
check to `/api/health/ready`. External checks returned a ready database dependency
and the branded application root returned HTTP 200.

### 2026-08-09 Atlas and application verification

Read-only Atlas CLI inspection confirmed that production uses an active M0 cluster.
Its sole runtime database user has only `readWrite` on the `formforge` database and
is scoped to `Cluster0`; it has no Atlas administrative database role. The production
IP access list includes `0.0.0.0/0`, which remains necessary for the current dynamic
public ECS egress and is the explicitly accepted no-cost MVP risk described above.

Preview uses its own M0 cluster, project, and database user. That user has
`readWriteAnyDatabase` only inside the isolated preview project because each pull
request selects a different logical database. It cannot access the production project
or cluster. Its IP access list also contains the documented broad entry required by
ephemeral ECS preview tasks.

Post-deployment verification exercised registration, form creation, publication,
public snapshot retrieval, submission, owner response retrieval, analytics, form
deletion, and logout against the branded production origin. All operations returned
their expected success statuses; the synthetic form was removed after verification.

## Upgrade triggers

Re-evaluate a dedicated Atlas cluster and AWS PrivateLink when any of these occurs:

- the service stores real customer or regulated data;
- external users rely on availability or confidentiality guarantees;
- a security review requires removal of broad public database access;
- stable paid usage can cover the dedicated Atlas and endpoint cost; or
- the runtime moves to a VPC design with another measured, stable egress boundary.

At that point, create an interface endpoint in the ECS VPC, use Atlas's private
endpoint-aware connection string, verify readiness and the core workflow, and then
remove public production access-list entries.

Primary references:

- [Atlas private endpoint requirements](https://www.mongodb.com/docs/atlas/security-private-endpoint/)
- [Atlas network security guidance](https://www.mongodb.com/docs/atlas/architecture/current/network-security/)
- [ECS Express network configuration](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html)
