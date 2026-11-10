# RentRail — Rental Operations & Public Recheck (V1)

**Date:** 2026-11-09. **Stacked branch:** `feat/rent-audit-workflows` (based on PR #8). **Product name remains provisional.**

## Product problem and differentiation

**A crypto transfer is not a rent ledger.** A rent obligation is attached to a calendar month and specific unit; an invoice can be partly paid, misdirected, repeated, late, or disputed. RentRail's wedge is **the rental period lifecycle plus an independently recheckable, non-custodial payment record** for both owner and tenant, from 1 to many units.

Nearest Nimiq competitor NimBooks already handles invoices and signed receipts: do not imply our concept is globally novel. Our feature hypothesis is **portfolio month triage + recurring distinct rent references + split payment review + any-device independent recheck**. A claim of superiority needs real comparison and user evidence.

## Implemented here

1. **Period cockpit** — month/property filter, expected invoice amounts in integer Luna, local unverified outstanding, unit coverage, awaiting wallet proof. It explicitly does NOT claim money received or amount legally due.
2. **Next-month invoice planner** — choose source month; preview eligible units and skipped pre-existing obligations; second explicit click creates next-month local draft invoices, with new cryptographically random opaque NIM memo per charge. No wallet action.
3. **Tenant transaction self-check** — from the same public rent request, paste a public transaction hash to perform strict read-only mainnet tuple/finality checks. Optional partial amount ≤ requested charge, not overpayment. Does not credit a ledger.
4. **Portable independent recheck link** — only after a node reports final match, tenant or landlord may copy a link with minimum request tuple (opaque ID, period, expected NIM amount/recipient/memo) and public tx hash. Each viewer explicitly reruns live RPC on their device. Link is tamperable, **not digitally signed** and not proof of landlord identity.
5. **Security UX** — host-wallet block-height divergence warning remains; native sends are hard-locked in this build (`paymentEnabled=false`).

## Critical trust boundaries

- No private unit labels, tenant names, email, lease details or building addresses are encoded in the public verification link. Only bare public payment instructions and transaction hash.
- A third-party RPC report is not cryptographic light-client proof, reliable two-node consensus, verified wallet identity, or a legal rent receipt.
- Shared links can be changed by a malicious intermediary and do not establish the payee's identity; confirm recipient out-of-band before moving money.
- No authenticated two-device owner/tenant database or global deduplication. Both can independently view the same public chain tuple, but they do not share private rental operations.
- Owner dashboard uses **local** obligations and browser-local unresolved submissions; counts should never appear as paid/settled receipts.
- PaymentEnabled remains **false**. No funds moved or requested. Real mainnet transfer requires independent user-controlled native approval later.

## Acceptance matrix

| Acceptance case | Evidence / state |
|---|---|
| Monthly cockpit groups by month and property | Unit tests + CI build |
| Invoice renewal crossing year boundary | Tests |
| Multiple units with only eligible next-month charges | Tests |
| New opaque memo per renewal | Tests |
| Existing next-month charge never replaced | Tests |
| Submitted wallet hash never credited as paid | Tests |
| Invalid/modified public audit payload fails closed | Tests |
| Public audit link requires live click to recheck chain | Implemented, device test outstanding |
| Exact on-chain tx + later macroblock for real RentRail payment | **NOT VERIFIED** |
| iPhone wallet WebView RPC network/CORS and public recheck | **NOT VERIFIED** |
| Recipient ownership + any-device authenticated private sync | **NOT IMPLEMENTED** |
| Actual PAY submission before 2026-11-11 23:59 UTC | **NOT SUBMITTED** |

CI includes 86 pre-existing tests plus 40 new tests = **126 synthetic tests** at first check. Exact latest run and deployed commit must be pinned to PR and evidence ledger.

## Next human test script

On Nimiq Pay → Custom URL, open the isolated Staging:
1. Home → select a month/property; inspect unit coverage and outstanding amounts.
2. Properties → create two units using synthetic labels; Rent ledger → create tiny *local* NIM obligations with a well-formed receiving address, but **do not send funds**.
3. Rent ledger → change source month → Review invoices → Create local draft next month; verify new public memo differs.
4. Copy and open a request link on second device; paste a **known real public transaction hash not related to the rent request**. It must show mismatch/REVIEW_REQUIRED, not PAID.
5. Wallet gate → Check host + Check mainnet RPC connectivity. Request/verification may report testnet-vs-mainnet height difference, which is an unresolved host-network gate.

Do not interpret fictional demo data or unrelated transaction as a successful on-chain rental payment. Do not share personal or real tenancy data in test links.

## Competition score strategy

The official rubric awards 45 points for usable functionality, 25 for Nimiq integration, 15 real usage, 10 design and UX, 5 promotion. Focus priority after this PR: **real G2/G3 mainnet rent proof with controlled consent, verified recipient binding, excellent mobile UX, real testers, and on-time submission**, not unrelated features.

Sources: https://miniappscompetition.com/rules · https://miniappscompetition.com/scoring · https://miniappscompetition.com/faq
