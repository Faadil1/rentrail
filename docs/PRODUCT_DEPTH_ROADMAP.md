# RentRail — Product Depth Gate, version 1

Date: 2026-11-10. Contest deadline 2026-11-11 at 23:59 UTC.
Status: evidence-backed product audit and one expanded feature slice, NOT a fully launched payment service.

## The actual jobs to be done

For a small rental manager: organize properties, units and monthly invoices, then distinguish the payment requested, a transaction submitted by a tenant, observed blockchain evidence, and a landlord's contractual acceptance.

For a tenant: know which month and recipient a payment belongs to; verify the receiver and exact amount; keep an independently checkable transaction record. A blockchain hash alone is not a receipt or proof of landlord identity.

A real human-authorized 0.005 NIM mainnet pilot, an independently reported exact-match transaction, and the owner's separate confirmation of the receiving balance demonstrate the core Nimiq mechanism. They do not prove safe production rent payments, third-party users or repeat engagement.

## Coverage and gaps

| Capability | Baseline before this change | User value and missing depth |
|---|---|---|
| Property/unit management | Local records, month-based charges | Occupancy dates, due dates, currency accounting, editing before sharing |
| Recurring charges | Next-month planning and opaque references | Draft/review/send, cancel/reissue, per-unit schedules |
| Collections operations | Aggregate month metrics | **Now added:** action queue, missing invoices, submitted-unverified priorities, past-period exceptions |
| Nimiq Pay transfers | One real mainnet experimental send | General sends deliberately off; exact-value native modal, global idempotency, recipient authenticity unresolved |
| Independent evidence | Single public RPC confirms exact transfer tuple and macroblock | **Now added:** explicit-save local single-RPC observations per charge, partial multi-hash tally, same-hash replay detection; still need automatic expiry/recheck and disputes |
| Multi-party work | Unsigned request links, no shared database | Need signed owner statements, tenant/landlord permissions, revocation and synchronized state |
| Workspace continuity | Local storage only | **Now added:** validated local JSON export, preview, explicit restore; cloud sync NOT implied |
| External adoption | One pilot tester | Need a new consenting tenant/landlord pair and honest session completion feedback |
| Privacy and safety | Noncustodial, opaque public memo | Encryption for backups, verified identity and operational payment controls |

## Delivered in this pull request

### Actionable collection operations
The rent ledger now shows action priorities rather than just totals: submitted wallet hashes awaiting verification, historical periods lacking a local match, missing monthly invoices, and current period local obligations. No due date is known, so the app does not label earlier months delinquent or calculate legal late fees. The queue is an operations aid, not an external collection notice.

### Portable local workspace
Users can copy a JSON snapshot and restore on another browser. Before overwriting local records, the app validates format, schema, sizes, cross-record references, duplicate IDs and public opaque memos; it previews the number of properties/units/charges/unverified submissions and requires a replacement acknowledgement. Only SUBMITTED_UNVERIFIED and OUTCOME_UNKNOWN are valid imported submission states. Any imported hash must still be checked against mainnet.

The backup contains property and unit labels and public receiving addresses. It is plaintext, sensitive, not uploaded, not encrypted, and does not create a shared cloud ledger.

### Historical on-chain evidence casebook
- After an existing hash is independently checked as FINAL_MATCHED, the user can **explicitly save** the source-attributed RPC observation for that charge.
- The ledger can display multiple partial transaction hashes and the amount those stored observations previously reported. One hash cannot be assigned to multiple charges and no hash is implicitly a legal rent receipt.
- The casebook is local, its entries identify one RPC and block/macroblock heights, and the UI warns the observations are **not continuously revalidated**. Each viewer should independently recheck before relying on one.
- The portable JSON workspace now also carries **validated historical observations**; restores never attach previous browser evidence to a new portfolio.
- No automatic owner acceptance, shared synchronization or legal status change was added.

Tests: **270 synthetic automated tests planned** (217 baseline plus 53 new) with CI required; actual final count should be read from the latest successful GitHub run. Real-device acceptance for this slice remains a separate gate.

## Highest-value next gates (in order)

1. Owner identity and anti-impersonation: owner wallet signs the requested recipient, charge ID, month and amount; wallet identity is checked on-device. Unsigned links do not establish a landlord.
2. Durable evidence casebook: keep append-only, source-attributed single-RPC verification snapshots, explicit recheck and expiry, multiple partial hashes, replay detection across charges and manual acceptance status.
3. Two-party collaboration: permission-scoped shared invoices, tenant acknowledgment, owner-confirmed settlement and conflict resolution; never assert that local export/import is real-time synchronization.
4. Production payment safety: fix/verify Nimiq Pay's 2-decimal native amount presentation; exact displayed signed Luna, separate fees, unique globally idempotent order and safe unknown states. No new payment is authorized here.
5. Product maturity: configurable due dates, contract labels, property occupancy history, NIM/USDT/fiat with provenance, accessible onboarding and reminders based on opted-in permissions.
6. External user trial with honest statistics and feedback, plus security review before large real rental transfers.

## Competition and research gate

The official competition values functionality/reliability/usefulness at 45/100, Nimiq integration 25/100, real usage 15/100 and design and promotion 15/100 combined. It explicitly requires a working app, not a mockup. Sources:
- https://miniappscompetition.com/rules
- https://miniappscompetition.com/scoring
- https://miniappscompetition.com/cycle3

The six-model method still needs actual independent research outputs from GPT (central synthesis), Claude, Gemini, Grok, Kimi, and Perplexity. None were falsely claimed for this new scope. Comparing convergence, contradictions, competitor overlap and safety remains a concept/release decision input, not a substitute for a source-verified product.

Priority: complete a credible rent-collections operating loop rather than adding decorative dashboards. All public builds remain no-send until the host amount display and recipient trust model are reviewed.
