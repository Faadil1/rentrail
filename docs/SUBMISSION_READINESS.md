# Submission readiness — Cycle III / PAY (working name RentRail)

**Hard deadline:** Wednesday, Nov 11 2026 23:59 UTC = 18:59 America/Toronto. **Status:** NOT SUBMITTED. App name remains provisional. A public working build is mandatory.

## Current mainnet proof and receiver acknowledgement — Nov 10 2026

- **PASS (native host):** Nimiq Pay SDK reported MAINNET from a real iPhone; independent MainAlbatross RPC responded in the iOS WebView with close block heights.
- **PASS (real, human-approved smoke transfer):** exactly **500 Luna (0.005 NIM)** was transferred to a separate receiver B with a unique opaque RentRail memo.
- **PASS (public RPC, one node):** tx was reported executed on networkId 24, exact recipient/memo/500 Luna matched, in canonical microblock 66,504,678 with later macroblock 66,504,720. Not a multi-node cryptographic attestation.
- **USER_CONFIRMATION (not independently observed screenshot):** receiver B's owner explicitly confirmed **0.005 NIM is present** in wallet B.
- **REVIEW REQUIRED:** native Nimiq Pay confirmation dialog showed `0.01 NIM` while on-chain transfer and receiver balance were `0.005 NIM`. Cause unknown; not safe to ignore. Do not repeat payment.
- **SECURITY:** the only send-enabled pilot was isolated, then protected with Vercel Authentication; future send flag disabled. Ordinary public app previews still read-only; none is a general purpose PAY service.
- **Submission:** NOT SUBMITTED; stacked PRs still need merging and final public app/demo readiness.

See [G2_PILOT_500_LUNA.md](./G2_PILOT_500_LUNA.md) and [MAINNET_DEMO_AND_SUBMISSION_GATE.md](./MAINNET_DEMO_AND_SUBMISSION_GATE.md).

## Mandatory go/no-go
- [x] Public GitHub repo exists: https://github.com/Faadil1/rentrail — MIT bootstrap in `main`.
- [x] Documented problem and UX: individual tenant, landlord, multi-property manager; period-specific rental ledger.
- [x] Mobile shell + locally stored properties, units, monthly obligations, next-month draft planning, public evidence recheck.
- [x] G1: SDK provider observed inside user's iPhone Nimiq Pay (earlier G1 Preview), not necessarily same app version.
- [x] G3: real public RPC network/schema and CORS observed from GitHub Actions, **not** necessarily mobile WebView.
- [ ] Review and merge stacked docs and app PRs in order; do not present `main` as feature-ready while unmerged.
- [x] Validate the G2 pilot Staging inside Nimiq Pay: host MAINNET and independent public RPC accessible from iPhone WebView; repeat for a final released public build.
- [x] Human-approved tiny mainnet NIM transfer + matching finality **reported by one public RPC** and receiver B receipt **user-confirmed**. **Second independent device/node recheck outstanding.**
- [ ] Separate security go/no-go for opening genuine rental transfers beyond limited smoke test. Explicitly avoid fake settlement states and unsigned recipient impersonation.
- [ ] One or more consenting outside-user walkthroughs and real feedback; no invented unique user counts.
- [ ] Final distinct app name and collision check, replace working-brand copy, branded assets.
- [ ] Rehearse a real UI demonstration with factual video, user-visible chain state, test receipt (never fabricate payment), exact deploy SHA.
- [ ] Confirm team lead, optional members and payout Nimiq address directly with humans; do not infer team roles or payout shares.
- [ ] Submit to official registration dashboard (PAY), public MIT repo, working live URL, <=250 word description, demo video (recommended), and capture actual submission confirmation.

## Hero demonstration (capture only observed actions)
Detailed shot list and truthful voiceover in [MAINNET_DEMO_AND_SUBMISSION_GATE.md](./MAINNET_DEMO_AND_SUBMISSION_GATE.md). Never replace the 0.01 NIM native dialog with a fabricated 0.005 NIM screenshot.
0–15s: Rent payment problem → period-specific ledger and amount due.
15–35s: Manager creates units and monthly charge; show user role and recipient/memo privacy.
35–60s: Tenant confirms recipient via trusted channel; if approved in real wallet, capture Nimiq Pay native confirmation and SUBMITTED status.
60–90s: Independent mainnet RPC recheck, macroblock finality and partial/mismatch cases; show genuine negative states as demo fixtures.
90–110s: Public audit link opened on second device; independent fresh verification and what is not proven.
110–120s: Ask for feedback and show link to public repository. No invented live payment if G2 not performed.

## Description draft — intended feature statement only, NOT APPROVED until tested
“RentRail (working name) helps tenants and property managers turn Nimiq Pay transfers into clear monthly rent records. Landlords create period-specific requests for each property and unit; tenants review recipient, amount and an opaque public reference before authorizing NIM through Nimiq Pay. Instead of treating a wallet hash as payment, the app checks execution, destination, amount, reference, canonical inclusion and macroblock finality through an independent public node. Both sides can share a privacy-minimal link and recheck the same public transaction. The app also tracks upcoming monthly charges, units needing invoices and exception states. It does not custody funds or publish private lease information on-chain.”

**CAUTION:** the draft above describes the intended general app including native sends, which are **not** enabled in public read-only previews. One 0.005 NIM isolated mainnet pilot did succeed and the receiver reported the funds present. Use the separately fact-checked and limited prototype description in MAINNET_DEMO_AND_SUBMISSION_GATE.md; do not claim unrestricted general PAY.

Official: https://miniappscompetition.com/rules and https://miniappscompetition.com/scoring.
