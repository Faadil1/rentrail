# RentRail — Collections & Reconciliation Depth V1

**Date:** November 10, 2026. **Branch:** `feat/collections-depth-v1`.

## Product value, beyond a payment proof
RentRail should cover monthly rental operations for owners and tenants, not just demonstrate one NIM transfer. The new **Collections** workspace closes a substantial part of the operational gap.

### Implemented
- Configure **due day per unit (1–28)**, per-browser only.
- Review local rent obligations by property, with aging **Upcoming, Due Today, 1–7, 8–30, 31+ days** and count/value summaries.
- Distinguish open local requests from submitted wallet hashes **still awaiting verification**.
- Copy **human-reviewable follow-up drafts** without sending any messages.
- Export a **local CSV review** without wallets, tenant identity or public memos; escape leading spreadsheet formulas.
- Connect G3 wallet verification back to the Collections workspace: after a single public RPC reports `FINAL_MATCHED` for an exact local charge, show **session-only** matching Luna and residual amount, including partial payments.
- Fail closed on duplicate or wrong network/memo/overpaid evidence; never treat those as settled.

### Truth and safety boundaries
- A due date passing **does not establish legal arrears or tenant nonpayment**; this workspace only knows local drafts.
- A matching result is reported by **one third-party mainnet history node**, not a fully cryptographic, second-provider proof.
- Matching evidence is **in application memory only**. It disappears on reload; RentRail does not automatically create a legal receipt or persist a falsely definitive balance.
- Unit due preferences are **not signed lease terms**.
- No real-money send flags enabled in public preview. Previous experimental pilot is closed. No new transaction authorized.
- Reminder drafts are not sent and do not assert a debt.
- Browser storage is local, not synchronized; unsigned requests cannot establish beneficiary identity.

### Implemented files
`src/collections.ts`, `src/main.ts`, `src/styles.css`, `tests/collections.test.ts`.

### Remaining high-leverage depth gates
**D2 — Persistent evidence history:** repeatable signed audit trails, partial-payment sets, cross-device rechecks, data migration, privacy and conflict handling without trusting local unverified evidence.

**D3 — Account and beneficiary identity:** authenticated owner/tenant roles, verified destination binding, durable room/unit history and signed payment requests.

**D4 — Rental lifecycle:** occupancy/lease changes, proration, credits, disputes, reminder consent, statement exports, reconciliation exceptions and month-close workflow.

**D5 — Reusable native PAY:** wait for upstream Nimiq Pay precise amount display resolution, end-to-end replay prevention and controlled safety release. The isolated 0.005 NIM pilot is not general-payment readiness.

### Acceptance gates
Green GitHub CI, build and unit tests; dedicated non-money-moving staging deployed READY; Nimiq Pay iOS manual review of exact SHA **pending until user provides evidence**; no production promotion; submit claims only after actual proof.
