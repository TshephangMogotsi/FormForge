# Career alignment

FormForge is being built as evidence for mid-level MERN and future technical
leadership roles. The goal is not to mention every technology; it is to provide
reviewable proof of sound engineering decisions.

| Role expectation | Evidence in FormForge |
| --- | --- |
| MongoDB, Express, React, Node.js | The primary application stack |
| Scalable REST APIs | Versioned contracts, validation, pagination, rate limits, and ownership checks |
| Responsive, mobile-first delivery | Public-form breakpoint and low-bandwidth requirements |
| Third-party integrations | Provider adapters with timeouts, validation, and safe failure modes |
| AWS awareness | Documented ECS/EC2, IAM, CloudWatch, secrets, and Atlas reference deployment |
| Git and review practices | Focused commits, natural messages, documented verification |
| Docker and CI/CD | Immutable containers, automated quality gates, OIDC publication, manual production deployment, and smoke testing |
| Automated testing | API integration tests plus security-focused cases |
| Technical documentation | Product spec, API contract, ADRs, architecture diagrams, and runbook |
| AI API integration | Optional provider-neutral form generation after the core workflow |
| Stakeholder communication | Scope, non-goals, tradeoffs, and measurable definition of done |

## Interview-level questions the project must answer

- Why is a modular monolith appropriate at this stage?
- Why are form definitions embedded while submissions are separate?
- What happens to old submissions after a form changes?
- Which security checks belong on the server?
- How does the public form behave on a slow mobile connection?
- How would deployment, monitoring, rollback, and incident diagnosis work?
- What changes first at 100,000 submissions per form?
- Where can AI add value without becoming a critical dependency?

## Evidence still to produce

- Measured bundle, mobile, and API performance.
- OpenAPI documentation.
- A short technical problem narrative describing an end-to-end decision,
  implementation, failure, and lesson learned.
