# G4 Staging Evidence Ledger — 2026-11-09

## Artifact / environment
- GitHub PR: https://github.com/Faadil1/rentrail/pull/9 (stacked on PR #8, itself stacked on PR #7).
- Branch: `feat/rent-audit-workflows`.
- Reviewed source SHA in deployment: `75d908efe2f6cca4a923c7c98362705203a6dbd1`.
- GitHub CI: https://github.com/Faadil1/rentrail/actions/runs/42746024064 — SUCCESS (126/126 pure tests, TypeScript + Vite build).
- Vercel project: `rentrail-operations-staging` (`prj_tziXAepJ15AbEV2H3JKrPydeauhg`).
- Target: **staging**, not production.
- Deployment ID: `dpl_3CZox75QBsDQKYTV3cNd1BHKY9DY` — **READY**.
- URL: https://rentrail-operations-staging-gj3ktqswp-faadil1s-projects.vercel.app/
- SDK payment send: `paymentEnabled = false` in exact deployed source.
- New functionality: period/property cockpit, local next-month renewals with new random memo, read-only tenant hash review and separately recheckable public audit links, explicit partial amount disclosure.

## Deployment correction
The very first attempt in this new isolated project `dpl_F7bA8UCoxknMCLmX3VPk6VSnNtKi` had automatically selected a production target despite the intended staging scope. It was **CANCELED before READY**. A staging version `dpl_6hC1fwvXcaTeqYqrysVJ8qooQfNn` was created, and the final updated staging build `dpl_3CZox75QBsDQKYTV3cNd1BHKY9DY` is now the recommended test artifact. No existing live project, domain or `main` branch was changed.

## Proof status
- **PASS (automated)**: 126 synthetic test cases and Vite build.
- **PASS (platform)**: Vercel reports staging deployment READY.
- **PASS (previous runtime)**: G1 native SDK injection observed on iPhone in an earlier G1 Preview.
- **PASS (previous read-only observation)**: separate public mainnet RPC and CORS headers observed from GitHub Actions.
- **NOT_OBSERVED (G4)**: iPhone native host loads this specific G4 staging build, and browser-origin RPC works.
- **NOT_VERIFIED**: any actual RentRail NIM transaction, owner wallet identity, multi-provider finality, cross-device authenticated private ledger, contractual rent settlement.
- **NOT_SUBMITTED**: official competition dashboard and submission PR.

## Immediate manual acceptance test
1. Inside Nimiq Pay Mini Apps → Custom URL, paste **exact G4 HTTPS URL above**, not the older G1 or G3 links.
2. Open Dashboard → Month filter → check monthly invoice coverage. Create fictional building/unit drafts only.
3. Rent ledger → choose Source month → Review invoices → Create next month's **local** draft invoice. Check that the opaque RR1 reference is different.
4. Share a tenant payment request link. Paste an unrelated real public 64-hex transaction hash; it must remain mismatched/unverified, not paid.
5. Wallet gate → Check host + Check mainnet RPC connectivity; capture difference in block height if any.
6. Do not send NIM. No real tenant/property personal data in these tests.
7. Save video privately, collect Benita's UX feedback with permission if she participates, never invent unique-user counts.

## Blocking decisions before contest release
- Native host wallet mainnet vs testnet: identify reliably; not just SDK consensus.
- Human-controlled tiny real NIM send + independent matching and next macroblock; recipient must be independently validated.
- Persistent cross-device allocation/receipt auth remains unbuilt; present as future work, not complete.
- Team lead, distinct brand, MIT public app code on merged branch, polished real demo and submission portal receipt.
- Competition deadline: 2026-11-11 23:59 UTC (18:59 America/Toronto).

## Truth statement
This staging artifact is a **testable read-only rental administration experience**, not yet a finished PAY Mini App with verified real-money rent settlement. It is not a legal or financial record of rental discharge.
