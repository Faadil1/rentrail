# Implementation checkpoint — 2026-11-09

**Branch:** `feat/rent-ledger-host-v1` (separate from documentation PR #1). The name RentRail is provisional.

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
| Live HTTPS deployment | NOT_DONE | Preview recommended if local URL rejected |
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