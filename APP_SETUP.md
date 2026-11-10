# RentRail Mini App — build and iPhone verification

> **Status:** implementation PR, not a finished/submitted rent product. This branch does not contain independent mainnet RPC finality verification. No 'paid' evidence is available.

## On Windows PowerShell

Prerequisites: Node.js 22 or newer. Clone the repository or switch to branch `feat/rent-ledger-host-v1`.

```powershell
git clone https://github.com/Faadil1/rentrail.git
cd rentrail
git switch feat/rent-ledger-host-v1
npm install
npm test
npm run build
npm run dev
```

Vite listens on `0.0.0.0:5173`. Find the **Network** URL in PowerShell (e.g. `http://192.168.0.128:5173`), using the PC's current IP. Phone and PC should share a non-isolated Wi-Fi. Check the URL in Safari first; Safari **must not** be considered proof of wallet SDK integration.

Then open Nimiq Pay → Mini Apps → Custom URL and paste the URL without trailing slash. Your earlier Nimiq Pay experiment rejected the LAN URL even though Safari worked. If that persists, use an HTTPS preview deployment for a real host test, without touching production. Tap **Wallet gate → Check host**, then record: actual host/version, consensus, block height, exact git SHA, screenshot, and URL.

## What the code currently implements

- Responsive mobile app with Dashboard, Properties, Rent ledger, Wallet gate, and tenant payment link.
- Privacy-minimal opaque `RR1:<32 hex chars>` public memo, under 64 UTF-8 bytes.
- Exact integer-Luna amount parsing and deterministic period/charge/partial/duplicate/exception state engine.
- Local-only property/unit/charge records and clearly labeled fictional example preview.
- Wallet `init()`/consensus/block-height host checks using the official SDK.
- Explicit user-approved `sendBasicTransactionWithData()` request on tenant view, with a prominent identity/recipient warning. **This is a money-moving action** if the wallet is on mainnet. Do not exercise it with real rent or unapproved funds. Testnet and mainnet are determined by Nimiq Pay, not by the web page.
- A returned hash is only `SUBMITTED_UNVERIFIED`. Non-permission errors are handled conservatively as potentially unknown outcome and retry is blocked on the current browser. Local pending flags are not a global double-pay lock.

## Do not interpret these claims as completed

- No mainnet RPC read/finality verification (G3 not passed).
- No verified tenant-to-landlord shared database or cross-device private data sync.
- No authoritative wallet identity or proof a landlord controls the address in a link; **a request link can be tampered with**. Verify out of band.
- No production deployment, live wallet host recording, user adoption, legal rental receipt, or official submission.
- Example preview uses fictional buildings, units and **no transfer evidence**.

## Evidence already observed

- Deterministic, synthetic Node 22 test suite: **43/43 PASS locally** (2026-11-09).
- Isolated TypeScript compile: PASS using a **local API type shim**; actual npm SDK/build not runnable in the sandbox due DNS/network restrictions.
- GitHub Actions installs actual dependencies and runs `npm test` and `npm run build`. The first PR lacks a lockfile; once npm works on a connected computer, commit the generated `package-lock.json` and switch CI to `npm ci`.

## Important: financial safety

Never enter a seed phrase, never test real rent money with this unverified version, and don't infer legal rent settlement from crypto transfer. Before real funds: manual wallet-owner consent, verified chain/network/finality, and independent recipient identity check.

Official docs: https://nimiq.dev/mini-apps/api-reference/nimiq-provider · https://nimiq.dev/mini-apps/development/load-local-mini-app