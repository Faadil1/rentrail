# Native Nimiq Pay confirmation precision discrepancy — upstream source root-cause analysis

**Date:** 2026-11-10. **Risk:** User approval dialog can show a value that is not the exact signed Luna amount for micro-payments. **Status: UPSTREAM CODE PATH IDENTIFIED; NO UPSTREAM FIX OBSERVED.**

## Repro supported by our real mainnet pilot

- RentRail showed the authorized, immutable amount **500 Luna = 0.005 NIM**.
- Its send adapter passed the integer `value: 500` via `sendBasicTransactionWithData` (Nimiq's official SDK documents `value` in Luna).
- The actual Nimiq Pay native **Confirm Transaction** sheet showed **Amount 0.01 NIM** in the user's iPhone recording.
- A separate public mainnet history RPC reported the exact executed transaction value **500 Luna** and an exact recipient/memo match. The receiver wallet holder confirmed **0.005 NIM** credited.

The evidence supports an **amount display discrepancy**, not an on-chain amount mismatch.

## Relevant Nimiq Pay upstream source (pin)

Upstream project: https://github.com/nimiq/nimiq-pay-app (GPLv3; do not copy its implementation into RentRail MIT code).
Inspected upstream commit: `df61e2cf51ff480ab501fc4e09bba2a7241dd48b` (published on Nov 10 2026 UTC).

1. [`src/lib/mini-app-confirmation.ts` lines 78–84](https://github.com/nimiq/nimiq-pay-app/blob/df61e2cf51ff480ab501fc4e09bba2a7241dd48b/src/lib/mini-app-confirmation.ts#L78-L84):
   - In `case 'transaction'`, the confirmation sheet calls `formatCrypto(amount, { currency: Crypto.NIM })` **without overriding decimal precision**.
   - On the next lines, the **fee** is formatted with `maxDecimals: DECIMALS[Crypto.NIM]` to avoid incorrect rounding. The amount lacks that precision.
2. [`src/composables/useCurrencyFormatter.ts` lines 60–64](https://github.com/nimiq/nimiq-pay-app/blob/df61e2cf51ff480ab501fc4e09bba2a7241dd48b/src/composables/useCurrencyFormatter.ts#L60-L64):
   - The implementation computes NIM by dividing incoming Luna by `10 ** DECIMALS[NIM]`.
   - `new FormattableNumber(amount).toString({ maxDecimals: options?.maxDecimals ?? 2, useGrouping: true })`.
   - Default `maxDecimals=2` results in displaying **0.01 NIM** for an exact **0.005 NIM** value when rounded normally.

**Root-cause assessment: HIGH CONFIDENCE based on repository code and observed screen behavior.** An exact native binary version/commit and the precise formatter package behavior on-device were **not** independently attested, so do not claim a verified installed-version patch or maintainers' acknowledgment.

## Proposed upstream change (draft only — not filed externally)

Inside the native transaction confirmation case, use the same full NIM precision for the amount that the current code already uses for the fee:

```ts
const amountNim = formatCrypto(amount, {
  currency: Crypto.NIM,
  maxDecimals: DECIMALS[Crypto.NIM],
})
```

This should preserve **0.005 NIM**, not round to **0.01 NIM**, for the signed value.

Suggested upstream tests (not run by this project): **0.00001, 0.0001, 0.005, 0.00999, 0.01, 1, and large values** with locale-specific separators, checking confirmation sheet string versus exact transaction Luna. Explicitly test that the amount shown never exceeds/understates the signed value and that fee presentation remains unchanged.

## Actions and release implications

- **DO NOT send another 500-Luna transaction** merely to re-test the UI.
- **DO NOT hide the mismatch** in the hero demo.
- Public RentRail release remains **read-only for money movement** until the host UX (or a separate independently reviewed product-level safety design) gives reliable exact-value human confirmation.
- Can accurately say the upstream **source path strongly explains** the discrepancy, but **no upstream fix has been merged, installed or verified by us**.
- Opening a public upstream issue with redacted reproduction and a proposed source patch is possible with explicit owner approval; this document alone is not a maintainer bug report.

Evidence: [G2_PILOT_500_LUNA.md](G2_PILOT_500_LUNA.md), [README](../README.md).
