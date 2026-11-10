# G2: Explicit-human-approval mainnet payment test — NO SEND HAS OCCURRED

**Date:** 2026-11-09 · **Branch:** `feat/mainnet-test-readiness` · **Target:** PAY · **Deadline:** Nov 11, 23:59 UTC.

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
- Native Nimiq Pay host network on iPhone: **NOT YET OBSERVED** with new SDK.
- Public RPC read from actual iOS WebView: **NOT YET OBSERVED**.
- Real NIM value transfer: **NOT PERFORMED**.
- Rent transaction finality: **NOT VERIFIED**.
- Submission dashboard: **NOT SUBMITTED**.

## Source
Official network detection: https://nimiq.dev/mini-apps (SDK `getHostNetwork` 0.2.4+).  
Native send with public memo: https://nimiq.dev/mini-apps/api-reference/nimiq-provider .  
Official requirements: https://miniappscompetition.com/rules .
