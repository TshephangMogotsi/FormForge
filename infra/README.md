# AWS deployment foundation

FormForge uses a two-stage AWS rollout so security and delivery infrastructure
can be reviewed before any continuously billed runtime is created.

## Stage 1: delivery foundation

`foundation.yml` creates:

- a private ECR repository with immutable tags, scanning, and retention rules;
- an empty ECS cluster for the production service;
- a GitHub OIDC provider;
- a GitHub deployment role restricted to this repository's immutable owner and
  repository identity on `main`;
- the execution, application, and infrastructure roles required by ECS Express
  Mode and password-reset delivery.

It does **not** create ECS tasks, a load balancer, a NAT gateway, or any other
running compute. The ECR repository can incur small storage charges after
images are pushed.

Validate the template:

```sh
aws cloudformation validate-template \
  --template-body file://infra/foundation.yml \
  --profile formforge-admin \
  --region eu-west-1
```

Deploying the stack is a separate, explicit operation:

```sh
aws cloudformation deploy \
  --stack-name formforge-foundation \
  --template-file infra/foundation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile formforge-admin \
  --region eu-west-1
```

The stack outputs provide the values needed by GitHub Actions. They should be
stored as repository variables, not hard-coded in the workflow.

| Repository variable | Source |
| --- | --- |
| `AWS_REGION` | Deployment region, currently `eu-west-1` |
| `ECR_REPOSITORY` | `ContainerRepositoryName` |
| `ECS_CLUSTER` | `ApplicationClusterName` |
| `AWS_DEPLOY_ROLE_ARN` | `GitHubDeploymentRoleArn` |
| `AWS_PREVIEW_DEPLOY_ROLE_ARN` | `GitHubPreviewDeploymentRoleArn` |
| `ECS_TASK_EXECUTION_ROLE_ARN` | `TaskExecutionRoleArn` |
| `ECS_APPLICATION_TASK_ROLE_ARN` | `ApplicationTaskRoleArn` |
| `ECS_PREVIEW_TASK_EXECUTION_ROLE_ARN` | `PreviewTaskExecutionRoleArn` |
| `ECS_PREVIEW_APPLICATION_TASK_ROLE_ARN` | `PreviewApplicationTaskRoleArn` |
| `ECS_EXPRESS_INFRASTRUCTURE_ROLE_ARN` | `ExpressInfrastructureRoleArn` |
| `PUBLIC_APP_ORIGIN` | Trusted production HTTPS origin |
| `PREVIEW_ENABLED` | Set to `true` only after the preview MongoDB parameter exists |

## Runtime secret

The Atlas URI belongs in an SSM Parameter Store `SecureString` named
`/formforge/production/mongodb-uri`. The task execution role can read only
parameters below `/formforge/production/`.

Pull request previews use a separate `SecureString` at
`/formforge/preview/mongodb-uri`, a task execution role that cannot read
production parameters, and a runtime role without SES permissions. Each PR
selects a separate logical database through `MONGODB_DATABASE`.
Keep `PREVIEW_ENABLED=false` until this parameter contains a credential scoped
to preview databases, then change it to `true` to activate PR deployments.

The verified Amazon SES sender belongs in
`/formforge/production/password-reset-from-email`. Deploy the foundation with
its verified email or domain identity in the `PasswordResetSesIdentity`
parameter so the application task role can send only through that identity.
When SES verifies a domain, the parameter is the domain while the runtime
sender can be an address beneath it. Pass that exact runtime sender in
`PasswordResetFromAddress`; IAM rejects any other From address.

Amazon SES sandbox accounts can deliver only to verified recipients. Request
production access before enabling password recovery for general public users.

Enter the value through a private terminal prompt or the AWS console. Do not put
it in a shell command, commit, issue, screenshot, GitHub variable, or Actions
log.

## Stage 2: runtime

The manually triggered `Deploy production` GitHub workflow uses ECS Express Mode
with the verified commit-SHA image, `/api/health/ready` as its load-balancer health
check, and the smallest practical task size. Creating the service also
provisions Fargate and an Application Load Balancer, which consume AWS credits
while they exist.

Pull requests from this repository create `formforge-pr-<number>` services after
verification succeeds. The GitHub `preview` environment assumes a dedicated
OIDC role, publishes an immutable `pr-*` image, and exposes the ECS endpoint on
the deployment record. Closing the PR deletes the Express service and its
managed load-balancing resources. Configure the `preview` environment to require
review before deployment if previews should incur cost only after approval.

The no-cost MVP uses Atlas's public TLS endpoint with the compensating controls and
explicit residual risk documented in `docs/ATLAS_NETWORKING.md`. AWS PrivateLink,
dedicated Atlas pricing, and explicit endpoint subnet wiring are deferred until a paid
production trigger justifies them.

## Teardown

Deleting the foundation stack empties and deletes the ECR repository along with
the IAM resources it created. Delete the runtime service first so it no longer
depends on these roles or images.
