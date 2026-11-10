# G2 — User-approved 500-Luna pilot, isolated Staging

Date: 2026-11-10 UTC. **Status: ONE USER-APPROVED MAINNET TRANSFER OBSERVED; public RPC reports FINAL_MATCHED; pilot endpoint now protected. No further transfers authorized.**
Branch: `feat/authorized-500-luna-pilot` (stacked on `feat/recipient-b-preflight`).
Build source SHA: `f736e50d10b1875b5b98ba9c74479ea914c391e8`.

## B receiver user acknowledgement — 2026-11-10, 11:05 EST

The wallet holder directly confirmed in the ongoing private conversation: **"le protefeuille B a les 0,005 Nim"** — their receiving wallet B visibly holds the transferred **0.005 NIM**.

**Evidence classification:** HUMAN_REPORTED_B_RECEIPT. This is a direct user attestation of the separate receiving wallet balance, not a screenshot independently inspected by the reviewer, nor a second RPC node or cryptographic ownership proof. It is nevertheless consistent with the already independently-of-wallet, **single-public-RPC** `FINAL_MATCHED` result, exact value **500 Luna**, recipient B and memo `RR1:62b40b30…`, canonical microblock and later macroblock.

**G2/G3 pilot outcome:** transfer submitted by human approval → confirmed final/matching by one public node → B recipient balance user-confirmed. **PASS_WITH_CAVEATS** for first real Nimiq Pay mainnet trial. Do not upgrade to production payment acceptance, legal rent settlement, global duplicate prevention, or third-party multi-node consensus.

**No second payment is authorized.** The dedicated pilot deployment stays protected by Vercel Authentication, and future builds have the send flag disabled. Existing immutable client code remains a potential risk for an authenticated user with access; avoid reuse of the original pilot URL.

Outstanding disclosure: native approval sheet showed **0.01 NIM** whereas on-chain actual amount was **0.005 NIM**. The public Nimiq Mini App API confirms native `sendBasicTransactionWithData` value is denominated in **Luna**, and `1 NIM = 100,000 Luna`, but does **not** document why the native UI displayed two decimal places. Root cause **NOT VERIFIED**; report as an apparent rounding/formatting issue, not a proven fix.

## Observed first paid test — PASS with critical native amount-display discrepancy

Private user-provided 33.4-second iPhone screen recording, local start time approximately **2026-11-10 01:01 EST**, shows the exact Nimiq Pay-hosted pilot:
- Nimiq Pay network and public RPC both report MAINNET/MainAlbatross with near-identical recent block heights; two payer addresses shared and B absent from the shared list.
- App's fictional payment request and safety panel show **0.005 NIM (500 Luna)**, B recipient and correct opaque `RR1:62b40b30…` memo.
- **CRITICAL DISPLAY DISCREPANCY:** the native Nimiq Pay **Confirm Transaction** sheet showed recipient `NQ48…E1QT` and **"Amount 0.01 NIM"**, despite the Mini App's exact approved instruction being **0.005 NIM**. The cause (possibly decimal-place rounding) is NOT VERIFIED. Do not claim the dialog displayed the correct value; do not perform another micro-payment before this is resolved or communicated.
- User was observed confirming the native dialog and RentRail subsequently displayed **"Submitted, NOT verified as paid"** with a public 64-hex hash. Hash is abbreviated **`8bd75eabcd…a583888c`** here to avoid publicly linking user's payer/receiver wallets to their personal GitHub identity. Full hash available in the user's private chat. Recording stays private.
- A separate **read-only** Vercel build remotely queried `https://rpc.nimiqwatch.com/` `getTransactionByHash` plus consensus, head, canonical block inclusion, transaction list, later macroblock. At **2026-11-10T06:08:36.756Z**, the public node reported:
  - `hash match: true`; `networkId=24`; `executionResult=true`; **actual amount = 500 Luna** (exact match, **not 1000 Luna**).
  - Recipient equals the separately approved wallet B; memo bytes decode to the exact opaque `RR1` reference.
  - Included in canonical microblock **66,504,678** (transaction appeared in block list).
  - Later canonical macroblock **66,504,720** present; head **66,505,079**; mainnet report and RPC consensus true.
  - Verifier result **FINAL_MATCHED** on **one third-party public RPC history node**. This is strong implementation evidence but NOT independently replicated multi-node light-client proof or legally discharged rent. Public audit tool was separately built with **no wallet method or send capability**.
- **Bottom line:** user-authorized mainnet NIM transfer to B and exact programmatic on-chain reconciliation **PASS (single-node reported)**; **native sheet amount display FAIL/REVIEW REQUIRED**; real general rent-sized PAY not yet released.

### Pilot protection after observed completion
- Dedicated pilot Vercel project `rentrail-g2-pilot-500`: **Vercel Authentication enabled for deploymentType=all** after the test (SSO). This restricts unauthenticated access to original deployment; whether any stale authenticated session remains is not independently verified.
- Project's `VITE_ENABLE_LIVE_NIM_SEND` setting was changed to a **disabled** value for any subsequent builds. **Already-built immutable static JS still includes its previously enabled code**, so SSO is the operative protection for the existing deployment. Do not assume editing an environment variable revokes a previously compiled static bundle.
- Browser-local attempt gate reports "Previous send is unresolved; do not retry", even though public chain evidence is now observed. This is conservative; a real resolved-proof state flow is future work and requires user consent before new payments.
- The Mini App also displays stale text **"No native wallet transfer initiated"** after hash return: UX status bug to fix. Do not describe that string as evidence of zero transfers.
- **No second test authorized or needed.** Keep pilot project protected, not publicly accessible, and never attempt the same request again.

## Human authorization and immutable intent
The Nimiq Pay wallet holder explicitly authorized **PREPARING** a distinct test-capable environment for one manually approved `0.005 NIM` (`500 Luna`) mainnet transfer, plus any fee shown by Nimiq Pay, from wallet A to the separately controlled wallet B. They must still personally accept the native wallet confirmation. No agent, developer or CI will click that confirmation.

- Receiver B: redacted `NQ48 HR14…E1QT`; valid NQ mod-97 checksum; full public NQ address configured only on **this dedicated isolated Vercel project**.
- Receiver SHA-256(normalized public NQ): `6375479595e25d182d7573fe169bcc720944fa02c1e61a438899fb65b2842358`. This digest is not cryptographic proof of wallet ownership.
- Transfer amount: **exactly 500 Luna**, not <=1000 or variable.
- Fictional period: `2026-11`.
- Allowed opaque request ID: `62b40b301f8829c113e7e5a622840450`, memo `RR1:<same ID>` (no tenancy personal information on chain).
- Last allowed client-clock instant: **before 2026-11-11T23:45:00Z** (client clock can be altered; operational cleanup still necessary).
- Active wallet network must be explicit `mainnet`; public RPC `MainAlbatross` with fresh recent head and height difference <1000.
- Nimiq Pay must share payer accounts, and the receiver must not be among shared addresses. This does not identify the actual sending account.

## Dedicated Vercel environment and evidence
- Isolated project: `rentrail-g2-pilot-500`, ID `prj_X4aNAl6eMQJFswoZetW6zh9dlxhV`.
- **Non-production Staging** deployment: `dpl_356amw4hVADEPc27VWi7sTEwzHb9`, **READY**.
- Base HTTPS URL (without embedded payment request): https://rentrail-g2-pilot-500-oky25s1a7-faadil1s-projects.vercel.app/
- Vercel build command: `npm run build && node scripts/verify-pilot-build.mjs`.
- Five project-scoped public preview env vars: `VITE_ENABLE_LIVE_NIM_SEND`, `VITE_SMOKE_ALLOW_RECIPIENT`, `VITE_SMOKE_ALLOW_CHARGE_ID`, `VITE_SMOKE_ALLOW_AMOUNT_LUNA`, `VITE_SMOKE_ALLOW_PERIOD`. Their values are deliberately not included in this document; browser VITE_ variables are **not secrets**.
- **BUILD ATTESTATION PASS** in Vercel logs: exact recipient fingerprint, 500-Luna configuration, period and request ID were present in the compiled JS. Native wallet approval remains mandatory.
- GitHub CI: https://github.com/Faadil1/rentrail/actions/runs/42764558395 **SUCCESS**, **217/217 tests**, TypeScript and Vite build.
- An initial deployment `dpl_9jU5YL4K89j4TSqVixWA2YmoPViE` had unexpectedly been classified `production` on **this new isolated project**; it was **CANCELED before READY**, and did not touch any existing RentRail project. The documented working build has target `staging`, not production.
- Previously deployed regular RentRail G1/G3/G4 staging and `main` were not changed or promoted.

## Safety gates / what the app actually enforces

1. `src/pilot-guard.ts` exact **recipient + charge ID + 500 Luna + period + expiry** tuple, in addition to pre-existing G2 mainnet/consensus/independent RPC and consent checks.
2. `src/host.ts` re-enforces exact tuple and NQ checksum, native mainnet, recent host check, payer-account inventory and no same-wallet address before calling `sendBasicTransactionWithData`.
3. Payment attempts require a **direct tap** and **native Nimiq Pay confirmation**; keys never leave wallet. Fee is chosen by native Nimiq Pay and must be reviewed by human.
4. Before invoking native wallet request, localStorage records an **ATTEMPT_STARTED/OUTCOME_UNKNOWN** state. Page reload on the same origin remains blocked from a blind retry, including cancellation or uncertain response. This is a **browser-local defense**, NOT a true globally enforced one-time authorization; another device, cleared storage or changed clock may bypass it. Each native wallet request still requires human consent.
5. Returned transaction hash is **SUBMITTED_UNVERIFIED**, never “paid”. Read-only RPC G3 requires matching canonical transfer + later macroblock; no rental ledger auto-credit.

## Original human acceptance protocol (historical, pilot completed; DO NOT repeat)

1. Open the exact **private fictional payment request URL** from the chat inside Nimiq Pay Mini Apps → Custom URL (not Safari). Do not post the public wallet link to the competition's GitHub PR.
2. Check recipient displayed is exactly wallet B, amount **0.005 NIM**, memo `RR1:62b40b301f8829c113e7e5a622840450`. Confirm wallet B ownership out of band.
3. Tap **Check Nimiq Pay host** → ensure MAINNET. Tap **Check independent mainnet RPC** → MainAlbatross and heights close. Tap **Check payer addresses (native permission)** → B must NOT be on the shared payer list. Confirm adequate selected balance through native wallet, including any fee.
4. Check the three explicit risk/consent boxes. If the button still says blocked, **do not bypass it**. Refresh host/RPC checks if stale.
5. Human may tap **Request Nimiq Pay native approval**. Nimiq Pay will show the exact amount, recipient and fee before human authorizes it. **Cancel if any detail differs.**
6. If wallet rejects, times out, or status is uncertain: inspect wallet history and do not retry this pilot or clear storage. A separate reviewed authorization and build are required for a different attempt.
7. If a public hash is returned, copy it before leaving the page; check with G3 recipient, amount, opaque memo, network ID 24, execution, canonical block inclusion and later macroblock. Independently recheck public evidence on another device.
8. Disable/destroy the isolated test environment when the experiment is complete; it is not the competition's final general-purpose PAY release.

## Unverified facts
- **NO human transfer has occurred from this deployment.**
- **One actual mainnet pilot hash has been observed and single-node-reported as FINAL_MATCHED**; NOT cryptographically attested by a second independent provider. Do not repeat the pilot.
- Wallet displayed the native approval dialog; sender account selection and actual fee paid are not separately documented here. Native modal displayed 0.01 NIM, while chain recorded 0.005 NIM: **critical display ambiguity to resolve**.
- Existing PRs are not merged, final competition submission is NOT performed.
- A single controlled 0.005 NIM transfer is evidence for the native SDK, **not** a general authorization to send rent-sized sums nor proof of a legally settled rent.
