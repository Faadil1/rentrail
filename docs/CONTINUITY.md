# RentRail — Canonical continuity
**Date:** 2026-11-09 · **Program:** Nimiq Mini Apps Competition Cycle III (PAY)

## Current state
- Repository `Faadil1/rentrail` created by user, public, default `main`.
- Initial MIT license committed to empty `main` once. All subsequent work should occur via PR.
- PRD/architecture/execution/evidence documents drafted on `docs/rental-product-foundation` branch for review.
- Project name **temporary**. Goal: serving individual landlords and multi-property managers through one rent-period ledger with tenant pay page.
- Competition deadline 2026-11-11 23:59 UTC (18:59 in Gatineau, EST).
- App code does **not** exist yet; no production deployment, SDK host validation or real rent mainnet payment claimed.

## From prior Nimiq experiment (not transferred to RentRail)
- Earlier read-only FloatBook/RevokeReady gate kit achieved synthetic test success and LAN Safari load.
- Nimiq Pay native provider is not available in Safari; prior iPhone Custom URL attempt said 'Enter a valid app URL.'
- New RentRail host gate must be tested afresh in actual Nimiq Pay; HTTPS preview may help if local URL rejected.

## Concept and competition rationale
- Six-model research completed upstream. Product lead selected rent-payment reconciliation over on/off-ramp and approval-revocation candidates.
- Distinguish from NimBooks generic tagged invoices and receipts through period/units/partial/exception workflows.
- Official competition requires functional Nimiq Pay Mini App, NIM or USDT, public MIT repo, live testability, submission through portal. Do not infer eligibility from a document-only repo.

## Next exact gate
1. Review/merge docs PR.
2. Create app scaffold in separate feature branch, run CI install/build/tests.
3. Load actual app through Nimiq Pay and prove SDK injection.
4. Validate read-only live mainnet transaction and later macroblock finality.
5. Only after human approval run tiny controlled live NIM send and verify before marking any rent settled.
6. Ship complete multi-role journey with period-based ledger, accessible UX, actual usage evidence.
7. Confirm final name, publish live HTTPS URL, capture truthful demo, submit via official portal.

## Rules
No unapproved transactions. No fake fixtures in live dashboard. No direct main pushes. Every status tied to proof and exact commit. Update this file at each consequential gate/PR.