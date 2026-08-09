# API limits and abuse cases

## Enforced limits

FormForge applies layered, process-local limits before domain work reaches MongoDB.
All limited responses use the normal API error contract with code `RATE_LIMITED`,
a correlation ID, standard rate-limit headers, and `Retry-After` when the limit is
exceeded.

| Boundary | Window | Limit | Purpose |
| --- | ---: | ---: | --- |
| All versioned API traffic | 1 minute | 180 requests per source IP | Bounds broad request floods |
| Registration and login combined | 15 minutes | 20 attempts per source IP | Slows credential stuffing and account creation abuse |
| Password-reset request and completion combined | 15 minutes | 5 attempts per source IP | Slows reset spam and token guessing |
| Public submissions | 1 minute | 20 attempts per source IP | Slows automated submission spam |

JSON request bodies are limited to 100 KB. Form and submission schemas are limited
to 50 fields or answers, individual answer strings to 5,000 characters, and dropdowns
to 20 options. Paginated form and response reads accept `limit` values from 1 through
50 and default to 20.

These counters are in memory and therefore apply per running task. They are an
application safety boundary, not a claim of globally exact distributed enforcement.
If traffic or abuse warrants multiple tasks, add an edge or shared-store limiter and
measure its effect before changing these values.

## Abuse cases

### Credential stuffing

- Registration and login share the tighter credential limit.
- Invalid login responses do not disclose which credential was wrong.
- Passwords are validated before hashing and never enter logs or responses.
- Repeated distributed attacks require an edge control such as AWS WAF; the current
  per-task limiter alone does not stop a botnet rotating source IPs.

### Password-reset enumeration and spam

- Known and unknown email addresses receive the same `202` response.
- Reset requests and token consumption share the strict recovery limit.
- Tokens are random, single-use, hashed at rest, expire, and revoke existing sessions.
- Delivery logs contain provider metadata rather than recipient addresses or tokens.

### Public submission spam

- Submission writes have a tighter limit than public form reads.
- Every payload is checked against the current immutable published snapshot.
- Duplicate or unknown field IDs, invalid option values, and oversized answers fail
  before persistence.
- CAPTCHA, reputation scoring, and account-level quotas remain deferred until measured
  abuse justifies their accessibility, privacy, and operational cost.

### Oversized or malformed payloads

- Express rejects JSON bodies above 100 KB with `413 PAYLOAD_TOO_LARGE`.
- Zod rejects unknown properties, excessive arrays, and invalid identifiers with a
  correlation-aware `400` response.
- The API never reflects raw malformed input in error logs.

### Ownership probing

- Protected form queries include both the resource ID and authenticated owner ID.
- Another owner's resource appears as `404`, avoiding existence disclosure.
- Authentication and authorization are enforced by the API even when the client hides
  the corresponding action.

## Review triggers

Review this policy when task count increases, sustained `429` responses appear in
logs, a form receives obvious automated submissions, payload limits block legitimate
forms, or an external security review identifies a new abuse path. Record measured
evidence and the selected mitigation in `docs/DECISIONS.md`.
