# Execution plan — Cycle III / PAY (as of 2026-11-09)

**Time-box:** deadline Wed 2026-11-11 23:59 UTC (18:59 America/Toronto). No 'submitted' claim until portal receipt exists.

## Stage 0: Base repo — documentation PR
- [x] Public repository created by owner
- [x] MIT license seeded in `main` (one-time empty-repo exception)
- [ ] PRD, architecture, security policy, evidence ledger reviewed and merged by human
- [ ] Confirm collaborator identities/permissions; do not assume any collaborator is participating
- [ ] Choose final app name before competition submission; avoid duplicate submission name

## Stage 1: High-risk host + chain validation (first)
1. Vite/TypeScript scaffolding, install SDK `@nimiq/mini-app-sdk` (current version).
2. Serve LAN/HTTPS, use actual Nimiq Pay, verify `init()`, current Nimiq network/consensus, accounts with consent.
3. Implement read-only independent RPC and known transaction lookup with strict normalized schema, network check, finality verification and failure states.
4. Run real-device host proof, save screenshot/screen capture and endpoint observations; no payment until human controls and explicit approval.
**NO-GO**: if SDK host or independent finality cannot be verified, no claims of a complete working money flow.

## Stage 2: Smallest complete real rent loop
1. Create an obligation for 1 month/1 unit in integer Luna, anonymous request ID / memo.
2. Tenant request inspection, human wallet approval with NIM; show transaction hash as SUBMITTED only.
3. Reconcile with RPC; require actual chain success, recipient/reference/value/chain and finality.
4. Split payments and exception ledger; landlord and tenant see same independently derived status from link, where possible.
5. Add a second unit and period to show shared architecture without blocking the hero loop.
**Acceptance**: one controlled small mainnet payment, separate manual consent, exact hash + source + block evidence, no false-positive edge cases.

## Stage 3: Product depth without thin proof dashboard
- Mobile-first real screens: portfolio overview, building/units, period detail, tenant checkout, receipt/status, exceptions.
- Strong UX for empty/errors/permission denied/retry/reload and accessible copy.
- No fabricated tenant identities or invented live transaction counts.
- Independent user walkthrough and feedback with privacy consent; no false '25 users' claim.
- Build/CI green, preview deployment, original 90s walkthrough (actual UI), public submission.
- USDT only after NIM path works; separate matching and safety contract, not an unchecked toggle.

## Work allocation (ownership boundaries)
| Workstream | Owner | Scope | Handoff |
|---|---|---|---|
| Product, risk, truth gates, final approvals | Repository owner | PRD sign-off, category, non-custody, mainnet manual actions, competition submission | Evidence + accepted PR |
| Mini App UI and state | Builder A (unassigned) | landlord/tenant/manager views, design system, tests | PR with local screenshots |
| SDK + read-only chain verification | Builder B (unassigned) | wallet bridge, transfer normalization, finality, fail-closed cases | PR with device/RPC evidence |
| Domain ledger and exception handling | Builder C (unassigned) | period model, partial sums, unique tx allocations | PR with negative-case tests |
| Demo/QA/docs | Repository owner + assigned reviewer | real flow capture, CI, report, 250-word description | signed off submission gate |

Until collaborators are explicitly confirmed, the repository owner is the accountable lead; unassigned roles are **not promises of work by specific people**. Avoid two agents editing the same branch; use independent PRs and documented contracts.

## PR method
Create feature branch → focused implementation → local tests/build → human device proof where relevant → update docs/EVIDENCE_LEDGER + CONTINUITY → PR → review → merge. Never auto-promote production or spend funds.

## Critical decisions to resolve early
- Does real Nimiq Pay accept HTTPS preview and inject provider?
- Which independent mainnet RPC delivers reliable transaction and macroblock fields with CORS?
- Do users accept NIM-denominated rent for real use, or is this a controlled demo only?
- Can we build a shareable verification experience without insecure identity claims?
- Final brand name and any third-party code/license audit.

## Explicit deferred work
Backend sync, identity tenancy records, staff permissions, USDT, recurring auto-pay, fiat conversion, large-scale admin, AI assistants, analytics charts. These are not needed to prove the central NIM rent payment loop.