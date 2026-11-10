# G2 — User-approved 500-Luna pilot, isolated Staging

Date: 2026-11-10 UTC. **Status: deployed test-capable but NO MONEY SENT.**
Branch: `feat/authorized-500-luna-pilot` (stacked on `feat/recipient-b-preflight`).
Build source SHA: `f736e50d10b1875b5b98ba9c74479ea914c391e8`.

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

## Human acceptance path (do not auto-transfer)

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
- No real RentRail transaction hash or macroblock finality has been observed.
- The sender account selection and its available balance/fees are not independently verified.
- Existing PRs are not merged, final competition submission is NOT performed.
- A single controlled 0.005 NIM transfer is evidence for the native SDK, **not** a general authorization to send rent-sized sums nor proof of a legally settled rent.
