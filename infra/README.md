# AWS deployment foundation

FormForge uses a two-stage AWS rollout so security and delivery infrastructure
can be reviewed before any continuously billed runtime is created.

## Stage 1: delivery foundation

`foundation.yml` creates:

- a private ECR repository with immutable tags, scanning, and retention rules;
- a GitHub OIDC provider;
- a GitHub deployment role restricted to this repository's `main` branch;
- the execution and infrastructure roles required by ECS Express Mode.

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

## Runtime secret

The Atlas URI belongs in an SSM Parameter Store `SecureString` named
`/formforge/production/mongodb-uri`. The task execution role can read only
parameters below `/formforge/production/`.

Enter the value through a private terminal prompt or the AWS console. Do not put
it in a shell command, commit, issue, screenshot, GitHub variable, or Actions
log.

## Stage 2: runtime

The runtime will use ECS Express Mode with the verified commit-SHA image,
`/api/health` as its load-balancer health check, and the smallest practical task
size. Creating the service also provisions Fargate and an Application Load
Balancer, which consume AWS credits while they exist.

The runtime remains gated on:

1. confirming the expected AWS cost;
2. choosing a MongoDB Atlas network-access strategy;
3. creating the SSM secret privately;
4. reviewing the final deployment workflow.

## Teardown

Deleting the foundation stack empties and deletes the ECR repository along with
the IAM resources it created. Delete the runtime service first so it no longer
depends on these roles or images.
