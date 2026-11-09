# Implementation checkpoint — 2026-11-09

**Base implementation branch:** `feat/rent-ledger-host-v1`. **Stacked G3 branch:** `feat/rpc-g3-readonly`. The name RentRail is provisional.

**G3 added (2026-11-09):** read-only Nimiq mainnet RPC `src/rpc.ts`, a wallet-screen network probe and transaction hash/charge review panel, and 43 new synthetic negative/positive tests (86 total). Real RPC schema observed from Actions [42640567756](https://github.com/Faadil1/rentrail/actions/runs/42640567756): `MainAlbatross`, head 66450475, `networkId:24`, successful transaction execution, canonical macroblock, CORS preflight 204 with `Access-Control-Allow-Origin:*`. Source was unrelated public transaction. See [G3_READONLY.md](G3_READONLY.md). **This is not proof of any RentRail payment or legally settled rent. Payment send remains disabled.**

**G1 HTTPS preview — evidence:** Vercel ID `dpl_8Ln14BaMAF4eUbTBfv8YYidHs1Ai`, READY, preview target (`target: null` in deployment record), same branch's app SHA `af05d8a44d8ff2d00d676b07d262cc8841c3e45b`, HTTPS URL `https://rentrail-g1-preview-786i72h9q-faadil1s-projects.vercel.app`. Hosted source has `paymentEnabled = false`; no NIM send can be triggered through the hosted UI. Vercel SSO/password protection disabled for native in-app access. **Device SDK injection observed in user-provided iPhone screen recording dated 2026-11-09, 09:09 local.** Screen shows `SDK connected`, `Host provider: Detected`, `Consensus: Established`, `Block height: 16316946`, `Balance method: Available`. Separate mainnet/network attestation explicitly says `No — separate RPC gate`. No screenshots/videos published to the public repository without user consent. Project `rentrail-g1-preview` uses manual file-source Preview deployment, not automatic Git branch deploy. There was an earlier incorrectly targeted deployment `dpl_S2DfmyNB2kZb5wfevTAaQRyqNfoe`; it was canceled before READY and is not the active site.

| Area | State | Evidence/next action |
|---|---|---|
| Mobile UI routes | CODE_WRITTEN | Dashboard, properties, period charges, tenant link, SDK gate |
| Local portfolio domain | TESTED_SYNTHETIC | 43/43 Node unit tests on domain |
| Financial account authority | CODE_REVIEW_REQUIRED | SDK host is detected but wallet signature/approval not exercised; NIM send disabled in preview |
| Host SDK injection | **PASS — PROVIDER DETECTED** | User iPhone recording 2026-11-09, ending ~09:11 local; app shows provider detected, consensus established, block height 16316946, balance API available; exact deployed app SHA `af05d8a` |
| Wallet send | NOT_PERFORMED | Native method wired; do not move real money until separately approved |
| Network identity | NOT_ATTESTED | Nimiq Pay may be testnet/mainnet; website does not independently prove which |
| Independent transaction finality | **CODE_WRITTEN + TESTED_SYNTHETIC; REAL RENT NOT_OBSERVED** | Read-only `src/rpc.ts`: canonical tx/block/macro verification, one public node; exact real rent hash and iPhone CORS still unobserved. No ledger credit. |
| Shared private backend / authentication | NOT_IMPLEMENTED | Local data only; link can be altered |
| Real product end-to-end | NOT_VERIFIED | Device + actual chain + user evidence missing |
| Live HTTPS deployment | **PREVIEW_READY + DEVICE_OPEN_OBSERVED** | Vercel deployment `dpl_8Ln14BaMAF4eUbTBfv8YYidHs1Ai`, target Preview, app SHA `af05d8a44d8ff2d00d676b07d262cc8841c3e45b`; URL https://rentrail-g1-preview-786i72h9q-faadil1s-projects.vercel.app; host SDK detected in user iPhone video |
| Hackathon submission | NOT_SUBMITTED | Requires functioning app, mainnet and portal confirmation |

## Critical next gate
1. **DONE:** GitHub Actions dependencies/tests/build green at deployed app SHA; **DONE for host injection:** actual iPhone Nimiq Pay SDK responded with consensus established and block height.
2. **PENDING:** independently attest Nimiq mainnet network identity; chain is not identified from SDK consensus alone. Preserve video locally unless user approves public sharing.
3. **IMPLEMENTED + SYNTHETICALLY TESTED:** RPC-backed `getTransactionByHash` with later canonical macroblock, strict recipient/amount/memo matching and PoS network ID 24. **PENDING:** observe real known RentRail payment hash on a device and confirm node-to-wallet network match.
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