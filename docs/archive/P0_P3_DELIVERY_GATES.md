# RentRail P0–P3 — Honest product-depth gates

**State:** November 10, 2026. **All PRs are draft and stacked.** This document separates what works from what is planned.

## P0 — Accessibility and submission

- PR #19 simplifies owner/tenant navigation and status language; independent payment lookup comes first.
- A successful Vercel build does not confirm native iPhone behavior or the official contest submission.
- The official form requires a separate human action: https://miniappscompetition.com/submit.
- Only footage captured from the exact tested commit may be portrayed as the live product.

## P1 — Two-sided trust

Implemented in PR #20: on a received rent request, the tenant can paste the recipient NQ address independently received from their landlord and receive a checksum-validated exact comparison. It does **not** authenticate a landlord or verify wallet ownership.

Not yet implemented: accounts, invitation lifecycle, cryptographically signed requests, roles, consent history, server-side authorization, secure tenancy records, recovery or tenant/owner synchronization. These require a threat model, privacy retention policy, authentication provider and signed on-chain request scheme. Never relabel the local role selector as authentication.

## P2 — Multi-payment reconciliation

Implemented in PR #21: optional local saving of up to eight public transaction hashes linked to existing browser-local rent requests, with fresh on-demand independent mainnet rechecks. Only an on-demand read-only verification can produce a session-level node match. When rechecking, previous session observations are erased. New genuine partial hashes can be aggregated by the existing reconciliation engine, and overpayments or duplicates require review.

Not yet implemented: durable independent replicated evidence, cross-device synchronization, notarized audit logs, legal payment discharges, dispute resolution or automatic rent settlement. Saved hashes alone are **not proofs**. Do not silently fetch private data or re-send transactions.

## P3 — Responsible price context / PAY

Implemented in this branch: exact, integer-safe **illustrative** conversion from a local fiat rent amount into a NIM amount, using a price entered manually by the user. CAD/USD/EUR/NGN supported. It never fetches an exchange rate or authorizes a transfer. No quote guarantee or price lock.

Missing, before any real landlord can accept NIM as fiat rent: verified reputable pricing data with timestamp, expiry and slippage controls; legally appropriate rent-denomination terms; payer/recipient acceptance of rate and fees; signed and replay-safe payment requests; verified Nimiq Pay small-amount decimal display; wallet transaction guard and independent confirmation. None is implemented.

## Acceptance criteria

1. GitHub CI tests, TS and Vite build **must** pass on each exact PR SHA; old 260-test result is not inherited proof.
2. Fresh Nimiq Pay iPhone WebView: no broken touch targets, readable manual rate and saved-hash panels, intact tenant requests; show mismatch and invalid recipient states.
3. Network unavailable -> recheck does not show verified settlement; saved references are never trusted as proof on reload.
4. NIM sending remains disabled in every public preview. No replay of the closed 0.005 NIM pilot.
5. Public claims describe each feature in the correct stage. Do not merge without review and do not claim official submission without receipt.

## Suggested release slicing

- If the deadline forces a choice: submit the previously proven non-money-moving Guided Experience staging first; later stage PR #19 for clarity. 
- Merge P1/P2/P3 only after checking CI and real WebView; they are valuable post-competition continuations, not prerequisites for entering Cycle III.
