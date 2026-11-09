# Implementation checkpoint — 2026-11-09

**Branch:** `feat/rent-ledger-host-v1` (separate from documentation PR #1). The name RentRail is provisional.

**G1 HTTPS preview — evidence:** Vercel ID `dpl_8Ln14BaMAF4eUbTBfv8YYidHs1Ai`, READY, preview target (`target: null` in deployment record), same branch's app SHA `af05d8a44d8ff2d00d676b07d262cc8841c3e45b`, HTTPS URL `https://rentrail-g1-preview-786i72h9q-faadil1s-projects.vercel.app`. Hosted source has `paymentEnabled = false`; no NIM send can be triggered through the hosted UI. Vercel SSO/password protection disabled for native in-app access. Device SDK injection remains unverified. Project `rentrail-g1-preview` uses manual file-source Preview deployment, not automatic Git branch deploy. There was an earlier incorrectly targeted deployment `dpl_S2DfmyNB2kZb5wfevTAaQRyqNfoe`; it was canceled before READY and is not the active site.

| Area | State | Evidence/next action |
|---|---|---|
| Mobile UI routes | CODE_WRITTEN | Dashboard, properties, period charges, tenant link, SDK gate |
| Local portfolio domain | TESTED_SYNTHETIC | 43/43 Node unit tests on domain |
| Financial account authority | CODE_REVIEW_REQUIRED | SDK wallet approval only; live host not observed |
| Host SDK injection | NOT_OBSERVED | Need iPhone Nimiq Pay, not Safari |
| Wallet send | NOT_PERFORMED | Native method wired; do not move real money until separately approved |
| Network identity | NOT_ATTESTED | Nimiq Pay may be testnet/mainnet; website does not independently prove which |
| Independent transaction finality | NOT_IMPLEMENTED | No PAID result may be shown |
| Shared private backend / authentication | NOT_IMPLEMENTED | Local data only; link can be altered |
| Real product end-to-end | NOT_VERIFIED | Device + actual chain + user evidence missing |
| Live HTTPS deployment | PREVIEW_READY | Vercel deployment `dpl_8Ln14BaMAF4eUbTBfv8YYidHs1Ai` on 2026-11-09, target preview (no production), pinned to app SHA `af05d8a44d8ff2d00d676b07d262cc8841c3e45b`; public URL https://rentrail-g1-preview-786i72h9q-faadil1s-projects.vercel.app; not yet observed inside Nimiq Pay |
| Hackathon submission | NOT_SUBMITTED | Requires functioning app, mainnet and portal confirmation |

## Critical next gate
1. Get CI dependencies/typecheck/build on a networked runner and fix any SDK version issues.
2. Host Check on real Nimiq Pay over HTTPS or local LAN; record exact device/URL/SHA.
3. Implement secure RPC-backed `getTransactionByHash` and **actual** later macroblock validation; independent mainnet chain/network identity checks. Keep negative test states fail closed.
4. Controlled, explicit human-approved tiny transaction only when intended; reconcile and save the exact public hash.
5. Add signed/authenticated or independently confirmed recipient requests. No request link is a cryptographic invoice signature yet.
6. UI/user acceptance tests; only then rename and submit via official portal.

## Review notes
- Wallet selection is controlled by Nimiq Pay; listAccounts() would not attest signing ownership.
- A browser-local pending flag is just a guard against accidental same-device retries, not a worldwide dedupe service.
- `sendBasicTransactionWithData()` sends real NIM if the user's wallet network is mainnet, so it is NEVER automatically triggered.
- Payment records cannot transition to PAID in the currently shipped app. Future verifier must verify the canonical transaction tuple and finality.

## Source documentation
https://nimiq.dev/mini-apps/api-reference/nimiq-provider
https://miniappscompetition.com/rules