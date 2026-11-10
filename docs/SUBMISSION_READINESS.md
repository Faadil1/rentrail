# Submission readiness — Cycle III / PAY (working name RentRail)

**Hard deadline:** Wednesday, Nov 11 2026 23:59 UTC = 18:59 America/Toronto. **Status:** NOT SUBMITTED. App name remains provisional. A public working build is mandatory.

## Mandatory go/no-go
- [x] Public GitHub repo exists: https://github.com/Faadil1/rentrail — MIT bootstrap in `main`.
- [x] Documented problem and UX: individual tenant, landlord, multi-property manager; period-specific rental ledger.
- [x] Mobile shell + locally stored properties, units, monthly obligations, next-month draft planning, public evidence recheck.
- [x] G1: SDK provider observed inside user's iPhone Nimiq Pay (earlier G1 Preview), not necessarily same app version.
- [x] G3: real public RPC network/schema and CORS observed from GitHub Actions, **not** necessarily mobile WebView.
- [ ] Review and merge stacked docs and app PRs in order; do not present `main` as feature-ready while unmerged.
- [ ] Validate exact latest HTTPS app build inside Nimiq Pay, host network **mainnet** and RPC from iPhone WebView.
- [ ] Human-authorized tiny mainnet payment to verified test wallet and independent finality + second-device recheck.
- [ ] Separate security go/no-go for opening genuine rental transfers beyond limited smoke test. Explicitly avoid fake settlement states and unsigned recipient impersonation.
- [ ] One or more consenting outside-user walkthroughs and real feedback; no invented unique user counts.
- [ ] Final distinct app name and collision check, replace working-brand copy, branded assets.
- [ ] Rehearse a real UI demonstration with factual video, user-visible chain state, test receipt (never fabricate payment), exact deploy SHA.
- [ ] Confirm team lead, optional members and payout Nimiq address directly with humans; do not infer team roles or payout shares.
- [ ] Submit to official registration dashboard (PAY), public MIT repo, working live URL, <=250 word description, demo video (recommended), and capture actual submission confirmation.

## Hero demonstration (capture only observed actions)
0–15s: Rent payment problem → period-specific ledger and amount due.
15–35s: Manager creates units and monthly charge; show user role and recipient/memo privacy.
35–60s: Tenant confirms recipient via trusted channel; if approved in real wallet, capture Nimiq Pay native confirmation and SUBMITTED status.
60–90s: Independent mainnet RPC recheck, macroblock finality and partial/mismatch cases; show genuine negative states as demo fixtures.
90–110s: Public audit link opened on second device; independent fresh verification and what is not proven.
110–120s: Ask for feedback and show link to public repository. No invented live payment if G2 not performed.

## Description draft — intended feature statement only, NOT APPROVED until tested
“RentRail (working name) helps tenants and property managers turn Nimiq Pay transfers into clear monthly rent records. Landlords create period-specific requests for each property and unit; tenants review recipient, amount and an opaque public reference before authorizing NIM through Nimiq Pay. Instead of treating a wallet hash as payment, the app checks execution, destination, amount, reference, canonical inclusion and macroblock finality through an independent public node. Both sides can share a privacy-minimal link and recheck the same public transaction. The app also tracks upcoming monthly charges, units needing invoices and exception states. It does not custody funds or publish private lease information on-chain.”

**CAUTION:** the draft above describes the intended app including native sends. As of this PR the general payment flow is DISABLED pending deliberate test release approval. Only submit claims directly backed by the deployed build and device evidence.

Official: https://miniappscompetition.com/rules and https://miniappscompetition.com/scoring.
