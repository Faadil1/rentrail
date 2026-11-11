# RentRail — Product Clarity & Guided Journeys V1

**November 10, 2026.** Product maturity extension of `feat/collections-depth-v1`, not a replacement for its financial verification safety gates.

## Problem, in everyday words

"A Nimiq wallet can show that NIM was transferred, but a landlord and tenant also need to know **which unit, which month, which obligation, and what remains to review**."

**Core promise:** RentRail links local rental operations to independent, read-only evidence about already-sent NIM transfers.

**We do not claim** RentRail is a bank account, legal rent receipt, proof that a person owns an address, or an authenticated shared rental-management system.

## The three entry paths (not login roles)

1. **I manage rentals — owner/manager path.** Add property → add unit → create monthly NIM rent request → review due dates/partial balances → verify an already-sent public Nimiq transaction hash. Locally completed steps are **not** proof of paid rent.
2. **I pay rent — tenant path.** Receive a rent-request link from landlord → independently confirm recipient ownership → use an approved wallet outside this public demo if a payment is needed → paste hash/recipient/amount/`RR1` reference to verify an **existing** payment with a single public blockchain node. The public app does **not** discover private invoices or authenticate landlords.
3. **Show me RentRail — evaluation path.** Open fictional example properties/units/rent requests without affecting existing local portfolio → inspect collections aging and proof workflows. Fictional examples never call the blockchain as if they were real transfers.

The role selector is a **presentation preference only**. It is not user authentication, authorization, wallet selection, tenant identity or persistent legal record.

## Operational comprehension improvements

- One-sentence answer first: "Know which rent. Know which payment."
- Five actionable setup/reconciliation steps for owners; transparent four-step safety workflow for tenants; three-step safe example for reviewers.
- Human-readable payment glossary: **Requested**, **Sent / hash received**, **Matched on-chain**, **Needs review**. All explicitly distinguish *transaction hash* from *independent verification* and *legal rental discharge*.
- A **standalone existing-payment verification form** on the Wallet page: exact public hash (64 hexadecimal chars), checksum-valid NQ recipient, up-to-five-decimal NIM amount and exact `RR1:<32hex>` memo. Parsing is strict; no wallet permission or money-moving API is called. Exact matched amounts are distinguished from **partial matched amounts with remaining NIM**, and overpayments remain REVIEW_REQUIRED.
- Read-only tenant request page now starts with 3 plain-language steps and collapses the historical one-off live-send controls under "Technical wallet checks".
- Responsive typography, keyboard focus-visible, compact mobile role cards, clear error states, friendly copy and no fabricated sample transaction.

## Evidence levels remain explicit

**Level 0 — Local invoice**: request is locally recorded, may be unsigned and editable.
**Level 1 — Wallet hash received**: request/tx may have been submitted; no finality or settlement claimed.
**Level 2 — One node reports exact mainnet matching/finality**: recipient, Luna, memo, execution, canonical inclusion, later macroblock match. Information only. No multi-provider cryptographic proof.
**Level 3 — Human receiver acknowledges funds**: person reports receiving NIM; not independent authenticated identity or contract satisfaction.

During the user-approved G2 pilot, a wallet transferred 500 Luna (0.005 NIM), independent public RPC reported matching execution and canonical finality, and receiving wallet B's user confirmed 0.005 NIM. Nimiq Pay's native confirmation showed 0.01 NIM because of a strongly implicated two-decimal amount formatter. Root cause is supported by upstream code but no deployed upstream fix was independently verified. **No new payment is authorized.**

## What remains to maximize this as a lasting product

**Next deep investments, in order:**
1. **Authenticated two-sided continuity:** secure owner-to-tenant invitations, recipient ownership verification, signed requests, role permissions, encrypted/consented shared history, and recoverable records.
2. **Durable multi-payment reconciliation:** multiple partial transfers per invoice, automatic finality rechecks, deduplication across devices, immutable provenance metadata, disputes, excess payments and credit notes.
3. **Life cycle operations:** tenancy dates, move-in/out, rent schedule/proration, agreements, renewal, vacancies, refunds/credits, safely drafted reminders and statement exports.
4. **Responsible NIM payment experience:** exact amount display upstream fix, wallet recipient binding, device-independent replay limit and human-signed approval. Do not open general live PAY until these are ready.
5. **Real adoption proof:** consenting landlord/tenant walkthroughs, measured task success and errors, public feedback, without inventing user counts.

**Prioritize doing a few workflows end-to-end over promising unavailable capabilities**. This V1 adds usable onboarding and independent verification, not fake authentication or unrestricted payment.

## Code and test inventory

- `src/journey.ts`: three guided paths, step truth/status, read-only standalone input parsing and human status explanations.
- `src/main.ts`: home role selector / journey UI, tenant-first guide, standalone check, two device-responsive paths, verified-proof states. No changes to the money-moving adapter.
- `src/styles.css`: responsive stepper, audience selector, plain-language status grid and simplified request guide.
- `tests/journey.test.ts`: 23 tests for role allowlisting, owner progression and no fake completion, tenant safety, example mode, strict NQ recipient/transaction hash/memo/NIM decimal, exact/partial/full payment interpretation, overpayment review, and human status meaning.

## Release gates

1. **260+ automated tests** and TypeScript/Vite build green.
2. Deploy *only* to a **non-money-moving staging project** with no `VITE_ENABLE_LIVE_NIM_SEND` or approved recipient variables.
3. Verify mobile layout and SDK host in actual Nimiq Pay iPhone WebView (must remain NOT VERIFIED until observed).
4. Check that guest/tenant/owner flow is understandable within 30 seconds without instructions and clear that the public build cannot pay.
5. Document a verified public release SHA; only merge to `main` after review of product copy, impact on existing features and safety boundaries.
6. Do not claim that a draft PR, README, or Vercel READY state means official competition submission.

**Competition deadline:** Nov 11 2026, 23:59 UTC. Product work must not erase the official submission gate or the exact open blockers.
