# Phase 18 — Public Rate Limits / Abuse Protection

Status: **Implementation in progress on `improve/abhiai-stability`; completion requires Verify CI success.**

## Master-plan scope

- Public abuse protection
- Repeated request protection
- Huge prompt protection
- Huge attachment / request-body protection
- Concurrent request protection
- Blocked / unhealthy provider protection

Acceptance criterion: **Public users cannot easily exhaust all free API resources.**

## Existing protections retained

Phase 18 builds on the existing Phase 2 security layer rather than replacing it:

- Same-origin / configured-origin enforcement
- Optional Cloudflare Turnstile verification
- HMAC-pseudonymous visitor identifiers
- Distributed Supabase RPM and daily request counters
- Fail-closed behavior when security dependencies are unavailable
- Attachment count, per-file and combined-size limits
- Bounded chat history
- Smart Router filtering for inactive and cooldown-blocked providers
- Free Guard and provider failover

## Phase 18 additions

### Scope-aware public quotas

- Normal chat keeps the administrator-configured RPM/day limits.
- Image generation receives a stricter hard public ceiling because image calls can consume scarce provider quota much faster:
  - guest: at most 6 requests/minute and 40/day,
  - authenticated: at most 12 requests/minute and 80/day.
- Lower administrator-configured values still win.

### Configured prompt limit enforcement

- Public chat now uses the administrator's `maxPromptLength` setting instead of only the older 20,000-character hard ceiling.
- The hard ceiling remains 20,000 characters even if an unsafe larger setting is supplied.

### Bounded request-body reading

- Chat JSON is read through a streaming byte counter.
- The route aborts once the request exceeds the chat-body ceiling even if a malicious caller omits or lies about `Content-Length`.
- Existing document/image attachment validation remains the second validation layer after parsing.

### Distributed concurrency leases

- A private Supabase lease table tracks active public AI work across Vercel/serverless instances.
- Per-identity chat concurrency is limited to 2 guest requests or 3 authenticated requests.
- The database uses a per-identity advisory transaction lock so simultaneous lease acquisition cannot race past the configured concurrency ceiling.
- Leases expire automatically if a serverless invocation dies before explicit cleanup.
- Acquire/release RPCs are callable only by `service_role`; `anon` and `authenticated` have no execute privilege.

### Provider blocking

- The existing Smart Router continues to exclude inactive providers, missing-key connections and models in runtime cooldown before creating an execution chain.
- Phase 18 does not bypass or weaken those controls.

## Database verification

The Phase 18 migration was applied to the AbhiAI Supabase project before application rollout.

Verified directly:

1. first lease acquisition succeeds,
2. a second lease at limit 1 is rejected,
3. lease release succeeds,
4. `anon` and `authenticated` cannot execute acquire/release RPCs,
5. `service_role` can execute both RPCs.

## Automated coverage

`tests/phase18-abuse-protection.test.mts` covers:

1. configured prompt cap clamping,
2. image-vs-chat quota policy,
3. concurrency limits,
4. normal bounded JSON parsing,
5. oversized-body rejection without trusting `Content-Length`.

Existing document tests continue to cover oversized attachment rejection.

## Completion gate

Phase 18 is complete when the repository Verify workflow succeeds on the Phase 18 commit:

1. TypeScript typecheck
2. ESLint
3. Node tests
4. Next.js production build

No production `main` merge is part of this phase.
