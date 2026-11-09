# Architecture decision records (ADRs) — 2026-11-09

### ADR-001 — RentRail is a provisional code/product name
**Accepted.** Final public app name will be distinct and selected before submitting to avoid duplicate competition names. Domain IDs, filenames and UI copy should not embed the name in a way that requires invasive migration.

### ADR-002 — One ledger, three role-based experiences
**Accepted.** Tenant / small landlord / multi-property manager use same period and allocation model. No separate forks or apps. Roles describe UX, not yet backed by authenticated identity.

### ADR-003 — Target PAY, NIM first
**Accepted for implementation, conditional for submission.** Official PAY examples include expanding reach of merchant/bill/person payments. NIM sends support public reference data; Polygon USDT transfer matching needs a different protocol and is deferred.

### ADR-004 — Fail-closed reconciliation
**Accepted.** Only independently checked, canonical and finalized on-chain transactions can be counted; each hash counted once. Distinguish 'on-chain verified' from lawful satisfaction of rental contract.

### ADR-005 — No backend until trust and privacy design is ready
**Provisional.** Keep early demo local-first; shared anonymous request links can carry minimal public payment instructions but do not prove landlord identity or provide private cross-device synchronization. Do not advertise management-team sync. Revisit immediately if this limitation blocks usable tenant/owner flow.

### ADR-006 — Max product depth *after* critical path
**Accepted.** Build portfolio, partial balances, exceptions and meaningful UI as product surface, not a mere proof widget. However no broad feature substitutes for one end-to-end actual Nimiq Pay payment verified on mainnet.

### Open ADR questions
1. Final brand name and collision search.
2. Authenticated durable sync approach after host-payment proof.
3. Macroblock finality verifier exact raw RPC schema observed in the target host.
4. Which parties are real testers and the privacy conditions of their feedback.
5. Whether NIM is acceptable as actual rental consideration to any participating renter/landlord; do not presume legal sufficiency.