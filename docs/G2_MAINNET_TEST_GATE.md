# G2: Explicit-human-approval mainnet payment test — NO SEND HAS OCCURRED

**Date:** 2026-11-09 · **Branch:** `feat/mainnet-test-readiness` · **Target:** PAY · **Deadline:** Nov 11, 23:59 UTC.

## G2 mainnet alignment — PASS, observational only (2026-11-09 23:44 EST)
Evidence: a **new user-provided private 32-second iPhone screen recording** of the exact read-only staging Mini App in Nimiq Pay (2026-11-10 UTC).

- Native Nimiq Pay host: provider **Detected**, consensus **Established**, balance API **Available**, host-reported wallet network **MAINNET**, observed host height **66,500,006**.
- Independent RPC, invoked from the Nimiq Pay iOS WebView: public node reports **MainAlbatross**, latest height **66,500,013**, observation **2026-11-10T04:44:29.757Z**.
- Height delta **7 blocks**, within the application's 1,000-block smoke policy threshold; measurements were asynchronous.
- **G2 network alignment PASS** for the explicit host-network + third-party node report. This is not cryptographic light-client identity attestation, and no transaction has yet been performed.
- **G3 client RPC reachability PASS**, but transaction-specific recipient/value/memo/execution/finality remain **NOT VERIFIED**.
- Wallet send remains **OFF** in the deployed staging build (no live-send flag, no approved recipient); **0 payments initiated**. No public Nimiq address has been provided or approved as an allowlist. Do not deploy a money-moving build until the human has explicitly approved the receiving address and capped test amount and accepted the native wallet confirmation.
- Video stays private; only its redacted factual observations are documented here.

## Isolated read-only staging — READY (2026-11-09 local; 2026-11-10 UTC)
- Vercel project: `rentrail-operations-staging` (`prj_tziXAepJ15AbEV2H3JKrPydeauhg`)
- Target: **staging**, not production.
- Deployment: `dpl_EfVAyztajgZQC19dMfbbxAuYhSPw`; **READY**.
- Exact pinned source SHA: `a860dc9a7f6d27a4b8245475e301e3c0537b73f8`
- URL: https://rentrail-operations-staging-3gny1uerl-faadil1s-projects.vercel.app/
- Real SDK dependency + strict network check compile at that SHA. GitHub Actions `42749087224`: **156/156 tests PASS**, TypeScript/Vite build PASS.
- Payment build flag **NOT SET** and approved recipient address **NOT SET**, so the staged app is read-only. No real native wallet transfer is initiated or enabled by this deployment.
- G2 iPhone evidence: **OBSERVED** in user-provided 26-second private video captured on 2026-11-09 at 23:39 EST (2026-11-10 04:39 UTC). The deployed Mini App renders inside Nimiq Pay. **SDK provider detected**, **consensus established**, **host-reported network TESTNET**, **SDK height 16,369,009**, balance read available. `Check mainnet RPC connectivity` returns **MAINNET_REPORTED** from the public node, `MainAlbatross`, head **66,499,692**, at **2026-11-10T04:39:10.703Z**. App explicitly displays the height-disagreement warning. This is a correct safety-stop (wallet testnet != public RPC mainnet); **wallet mainnet alignment: NOT VERIFIED**. No payment, transaction hash or rent evidence was observed. Capture remains private; no screenshot uploaded to the public repo.

## Earlier TESTNET remediation (completed with later MAINNET read-only observation; no money transfer)
1. Option A (safe development): remain on TESTNET for UI and wallet behavior. This project's current verification RPC is **mainnet-only**, so do not use it to claim testnet transaction finality. A separate verified testnet RPC is needed for fully matched testnet flow.
2. Option B (read-only mainnet connectivity check, not payment authorization): in Nimiq Pay app menu, long-press the **Settings** button ~10 seconds to reveal the development menu; select **Mainnet**. Nimiq's official docs warn that switching reloads the app and clears its displayed transaction history. Confirm user consent before switching. Reopen this staging URL → Wallet gate → Check host → Check mainnet RPC connectivity. Stop if wallet does not explicitly report MAINNET or if heights differ significantly. **Do not create or authorize a transaction.**
3. Official source: https://nimiq.dev/mini-apps/development/load-local-mini-app (testnet switch), https://nimiq.dev/mini-apps/faq (competition cannot submit testnet-only app).

## What changed
- Import `getHostNetwork()` from `@nimiq/mini-app-sdk` >=0.2.4. Host explicitly reports `mainnet`, `testnet` or `unknown`; **no fallback** to mainnet.
- From a real tenant request, show host network + independent public RPC network and heights. SDK consensus alone is insufficient.
- `assessSmokePayment` fail-closed pure gate with automated tests for stale network data, divergent heights, wrong network, wrong recipient, missing consents, old unresolved sends and amounts >0.01 NIM.
- `submitUserApprovedPayment()` rechecks: dedicated build flag, exact test-recipient allowlist, a valid invoice request, amount limit, explicit host mainnet and consensus, and native Nimiq Pay confirmation.
- Returned tx hash = **SUBMITTED_UNVERIFIED** only. Tenant can paste/verify it via G3 read-only independent-RPC panel. No auto ledger credit or legally settled-rent claim.
- No API key, seed phrase, private wallet data, or funds are stored by this app.

## By-default lock: all public test builds are safe
The code is **disabled for money movement** unless a dedicated deploy explicitly sets BOTH:
```
VITE_ENABLE_LIVE_NIM_SEND=smoke_test_human_approved
VITE_SMOKE_ALLOW_RECIPIENT=<verified public NQ recipient address>
```
These are **PUBLIC build-time configuration variables** in the browser, not secrets. Never insert private keys, passwords or seed phrases here. Do NOT set in a normal staging or production release. The first variable is not permission to move money: the wallet holder must explicitly approve the native dialog, and can reject.

## Human-controlled acceptance protocol
**Before any real funds**:
1. Confirm host Nimiq Pay is on **mainnet**; if it says TESTNET or UNKNOWN, STOP. Update the wallet if host network field is unsupported, do not guess.
2. Confirm the public RPC also reports recent `MainAlbatross` and that height delta is <=1000 blocks; obtain both observations on the same iPhone within 2 minutes. If RPC fails or contradicts host, STOP.
3. Owner/team identifies a REAL NQ mainnet receiving address they control, confirms it **out of band**, and explicitly approves using it as the **sole allowlisted recipient for a separate test deployment**. Never paste a seed phrase.
4. Create a FICTIONAL local unit + a **0.005 NIM** period-specific test invoice with the approved recipient; no real housing information or rent obligation. Share the payment request link only with consenting tester.
5. Human reviews link, address, public opaque RR1 memo, <=0.01 NIM including any separate wallet fee decision, and checks all three explicit acknowledgements. No auto-sign or unattended transfer.
6. Tester **chooses** whether to approve the native Nimiq Pay dialog. No assistant, agent, script, or CI may operate the real wallet or override consent.
7. Retain public hash; **do not retry** an uncertain outcome. Verify later canonical chain inclusion, destination, Luna value, memo, execution and following macroblock through independent RPC. Do not call it rent paid just because the wallet returned a hash.
8. Owner and a second user open portable evidence link and independently recheck; gather real observations with consent. Redact personal information from public demo.
9. Disable one-time build flag after test and revoke/decommission the dedicated test deployment as appropriate.

## Submission release decision
An intentionally tiny, allowlisted **smoke-test flow is NOT the finished rent-payment feature**. It validates G2/G3 before considering general PAY release. Actual rent-sized transfers require a separate security/product review and appropriate verified-recipient binding. Do not lift the 0.01 NIM limit or disable the recipient allowlist merely to satisfy a deadline.

## Current truth
- Build-time flag: **OFF** in all normal deployments.
- Allowlisted address: **NOT PROVIDED / NOT APPROVED**.
- Native Nimiq Pay network on iPhone: **MAINNET observed in subsequent 23:44 recording** (earlier 23:39 recording showed TESTNET).
- Public RPC read from actual Nimiq Pay iOS WebView: **PASS**, independent node reported `MainAlbatross` and height 66,500,013, alongside SDK host MAINNET height 66,500,006.
- G2 host/RPC network alignment: **PASS (observational)**; explicit host MAINNET and public MainAlbatross with 7-block delta. No transfer authorization implied.
- Real NIM value transfer: **NOT PERFORMED**.
- Rent transaction finality: **NOT VERIFIED**.
- Submission dashboard: **NOT SUBMITTED**.

## Source
Official network detection: https://nimiq.dev/mini-apps (SDK `getHostNetwork` 0.2.4+).  
Native send with public memo: https://nimiq.dev/mini-apps/api-reference/nimiq-provider .  
Official requirements: https://miniappscompetition.com/rules .
