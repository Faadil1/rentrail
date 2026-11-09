# Product Requirements Document — RentRail (working name)
**PRD v0.1 · 2026-11-09 · Owner: repo maintainer · State: PRE_RUNTIME_GATE / IMPLEMENTATION_PLANNED**

## 1. Product thesis
Rent is not a generic transfer: it creates a **period-specific obligation** with an amount due, possibly multiple payments, exceptions, and an auditable receipt. RentRail connects those events without holding funds. One core works for a single landlord and for property managers with multiple buildings and units. A tenant sees only their own payable request.

**Central value:** clearly explain what is due, what NIM transfer is independently observed, what remains, and why a payment is pending/ambiguous/verified.

## 2. Research and competitive boundary
The multi-model research converged on finishing a real financial workflow with observable evidence rather than presenting transactions as success. Candidate chosen by product lead on 2026-11-09.
**Nearest Nimiq collision:** NimBooks already offers invoices, tagged NIM payment requests, on-chain settlement, and signed receipts. RentRail must **not** compete as 'NimBooks but for rent.' Differentiation must be period ledger, multiple obligations, split and over-payments, exception handling, and portfolio operations. Broader on-chain rental products exist. Novelty is a hypothesis, not proof.
Source: https://github.com/subimpact/nimbooks

## 3. People / jobs-to-be-done
1. **Tenant**: understand the exact period, destination, amount, and payment status before/after wallet approval; provide proof without exposing private lease details on chain.
2. **Independent landlord** (1–5 units illustrative, not a hard cap): issue one or more rent requests, reconcile transfers, track remaining balances, identify exceptions.
3. **Property manager** (many units): repeat those same operations, filter by building/unit, detect unpaid/part-paid/overpaid obligations. Team roles and ERP integration are later.
**Consent**: both sides must agree to using crypto payments for a rent obligation; the Mini App cannot itself modify tenancy contracts or establish legal discharge.

## 4. Goals and measurable success
- One real user can open a shareable rent request in Nimiq Pay, approve a NIM payment manually, and independently verify a matching on-chain result.
- One landlord can create at least two units and two periods and view the correct allocation and remaining balances.
- A tenant can inspect their own request in a shareable privacy-minimal view.
- Repeated hash, wrong recipient, wrong memo, wrong chain, inadequate finality, and provider outages never produce a false green payment status.
- Device demo uses the actual built app (no staged simulated 'live' footage).
- Obtain at least one real external user walkthrough/feedback before claiming product/user validation.

## 5. Non-goals (Cycle III)
Custody or escrow; conversion to fiat; automated debits; enforcement/eviction; credit scoring; identity verification; legally certified rent receipt; fiat rent conversion guarantees; tax advice; on-chain lease details; tenancy legal compliance assertions; USDT parity with NIM; staffing/ERP/analytics dashboards not supporting the hero journey.

## 6. Requirements and prioritization
### MUST for a qualifying submission
- M01 Nimiq Pay real-host bridge via `@nimiq/mini-app-sdk` `init()`; show permission denial, unavailable host and wrong-network states clearly.
- M02 Mobile-first landlord dashboard that can create a portfolio containing 1+ buildings/units and period-specific rent charges; explicitly label local-only data unless shared/synced.
- M03 Deterministic amount accounting in integer **Luna** (1 NIM = 100,000 Luna), no binary float for debt calculations.
- M04 Generate random opaque unique request ID; public memo e.g. `RR1:<opaque-id>`, UTF-8 at most 64 bytes; no names/address/unit references in memo.
- M05 Shareable tenant request with explicit NIM destination, exact amount and period; renter inspects recipient before sending.
- M06 User-initiated, user-confirmed NIM send via `sendBasicTransactionWithData`; cancellation and unknown-submit state handled; never auto-retry uncertain transactions.
- M07 Independent mainnet RPC verification: validate chain/network, canonical receipt, destination, amount, memo and execution; record finality with actual chain evidence, never trust SDK-returned hash alone.
- M08 Treat each transaction hash as unique per request/portfolio; re-read verified transactions; duplicate/replayed hashes cannot be credited twice. Partial payments update ledger only after verification. Overpayments require explicit review, never silently allocated.
- M09 Explain states in plain language: `DRAFT`, `OPEN`, `SUBMITTED_UNVERIFIED`, `INCLUDED_NOT_FINAL`, `FINAL_MATCHED`, `PARTIALLY_FUNDED`, `PAID_ONCHAIN_VERIFIED`, `REVIEW_REQUIRED`, `FAILED_OR_UNKNOWN`; differentiate legal obligation from chain evidence.
- M10 README, deployment link, public MIT repo, real device demonstration evidence and submission description <=250 words.
### SHOULD after critical path
- S01 Documented pagination and rate-limit behavior for history scan (with incomplete scan warning).
- S02 Export unit/period ledger without spreadsheet formula injection.
- S03 Acknowledge receipt on both sides and display explorer link verified against chain/network.
- S04 Accessible screen-reader labels, loading states, empty states, keyboard navigation and responsive layout.
### MAY after contest
USDT Polygon with separate transfer matching; authenticated shared cloud sync; multi-staff roles; accounting integrations; reminders; recurring templates; NIM/fiat quote display with clear volatility caveats.
### MUST NOT
- Mark any rent 'paid' from a locally injected fixture, SDK hash or payer screenshot alone.
- Infer payment from wallet balance changes or unknown sender.
- Auto-disburse or transfer funds without the user's native wallet confirmation.
- Publish user names, lease documents, apartment addresses or other personal information on-chain or in public shared URLs.
- Claim a legally valid rent receipt, guaranteed crypto-to-fiat value or custodial protection.
- Call a synthetic demonstration 'mainnet evidence'.

## 7. Primary user flow / hero demonstration
Landlord creates building A, units A1 and A2; creates November NIM obligation for unit A1; app creates opaque public reference and a shareable request; renter opens within Nimiq Pay; checks amount and recipient; manually approves; app displays submitted/not verified; after independent RPC read and finality, chain-verified payment is allocated to that period; landlord sees remaining amount including a partial-payment example; wrong memo/hash remains review-required. Same model works for 1 or 50 units.

## 8. Technical invariants
- Debt and payment are distinct entities; receipt does not erase debt.
- Request ID unique and immutable once paid; change requires a new version and explicit review.
- Single wallet signing authority is in Nimiq Pay, not the web client; `listAccounts()` alone does not attest signer identity.
- Include token/chain/recipient/memo in deterministic matching key.
- Only canonical successful chain executions count; partial, stale, or uncertain RPC responses remain pending.
- Store no private keys. Never send arbitrary transaction with a pre-approved wallet.
- Never treat off-chain local state as independently witnessed by another party.

## 9. Architecture / dependencies
Read [ARCHITECTURE.md](ARCHITECTURE.md). Proposed: Vite + TypeScript mobile web UI, pure domain ledger, SDK host adapter, read-only RPC verifier and optional local portfolio persistence. Shared anonymous request links convey the request snapshot but not private tenancy data. Persistent cross-device management is a separate gated service requiring identity, authentication, consent and privacy review.

## 10. Nonfunctional requirements
- Fast mobile loading, graceful errors, no uncontrolled polling, rate-limit backoff.
- Exact numeric amounts, no rounding debt or silent currency conversion.
- Privacy-by-default for all public metadata.
- Host/API availability, chain finality, wallet approval and UI rendering are separate gates.
- Fail closed on stale response, wrong chain, malformed response, reorg or RPC outage.

## 11. Evidence, gates and acceptance
**G0 Documentation**: official rules/SDK checked; repo MIT public.  
**G1 Host**: real Nimiq Pay on phone launches **this** build and `init()` returns usable provider and correct Nimiq network. Browser Safari preview is not host evidence.  
**G2 Payment**: controlled small, separately human-authorized NIM mainnet transaction with nonce/reference and hash; optional testnet rehearsal must stay labeled testnet.  
**G3 Chain**: independent synced mainnet RPC verifies exact tuple and later macroblock finality; negative cases PASS.  
**G4 Product**: landlord creates 2 units, 2 charges; tenant can pay an obligation; partial, duplicate, ambiguous and overpay states behave as specified.  
**G5 Usability**: independent test participant completes flow, feedback logged with consent.  
**G6 Submission**: live HTTPS URL in Nimiq Pay, CI tests/build green, real recording, MIT, link, description, correct PAY category, submitted via portal.

**Current truth (2026-11-09)**: G0 partial; G1–G6 not passed **for RentRail**. Previous gate-kit Safari success is not evidence for this new repository. No funds or mainnet rent payments verified.

## 12. Risks / mitigations
- Two-day build window → finish one real NIM path before breadth; fallback is truthful no-submission rather than deceptive green check.
- NimBooks overlap → use rental-period ledger/portfolio/partial-payment exception differentiation.
- RPC CORS/rate limiting/stale data → verify endpoint on target device; show incomplete results; do not assume uptime.
- Tenant privacy → opaque reference, explicit data notice, no personal lease data on chain.
- Economic/legal uncertainty → rent denominated in NIM only for V1; contractual fiat equivalence is outside app; human agreement required.
- Tenant/manager multi-device sync requires backend → no promise until authenticated production service built.

## 13. Definition of Done
Not done until G1–G6 independently supported by evidence and no P0 failures. Every pass must link exact code SHA, host/device, network, transaction details (public hash only), independent RPC evidence, tests and date.

## 14. Change history
- **v0.1 — 2026-11-09:** candidate selected, title provisional, dual-audience scope and honest competition gates recorded. 