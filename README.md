# RentRail
### Monthly rent operations with verifiable Nimiq mainnet evidence

RentRail is a **Nimiq Pay Mini App** for tenant/landlord payment coordination. Property managers organize properties, units, month-specific invoices and next-period planning. Tenants receive a transparent payment request with an opaque `RR1:` on-chain reference. Anyone with the transaction hash can independently query a public Nimiq history node for the intended recipient, amount in Luna, reference, execution and canonical inclusion.

> **Cycle III / PAY submission candidate · MIT License · Mainnet-aware.** This repository contains a working **rent ledger + mainnet verification** app, not a licensed rent collector or a guarantee that rent is legally discharged.

## Try the app

**Public, non-production read-only Mini App (READY build):** https://rentrail-operations-staging-bqetxdq5d-faadil1s-projects.vercel.app/  
Exact deployed app SHA: `f3412c2575918d2ee1297e686ba642dc91ea0130`, Vercel deployment `dpl_3y4ZrTRjRMN1x4Hw1Q74rtScobRQ` (**staging**, READY). **217/217 automated tests passed**. This new release SHA still needs a fresh native Nimiq Pay iPhone acceptance test; earlier G2 pilot ran successfully on a different SHA.

Inside **Nimiq Pay → Mini Apps → Custom URL**, paste the HTTPS URL. The browser preview also works for non-wallet management features.

1. Choose **Try sample data** to see sample properties, units and monthly charges. Examples are explicitly local and do not move funds.
2. Create your own property, unit and rent charge. Records live in your browser local storage; there is **no shared/cloud property manager account**.
3. Share the tenant-request link. It includes a recipient, amount and opaque public memo; the URL is **unsigned and editable**. Confirm receiver identity outside the link.
4. In **Wallet gate**, select **Check host** to see native Nimiq Pay connectivity and its reported MAINNET/TESTNET status. Use **Check independent mainnet RPC** to read the separate public history node.
5. To verify an **already completed** NIM transaction, paste a real hash and match the relevant recipient, amount and memo. The verification is deliberately conservative; a hash alone is not a receipt.
6. If the history node reports an exact executed transfer included in a canonical microblock and a following macroblock, RentRail labels the evidence `FINAL_MATCHED`. **This is one node's report**, not a light-client proof, real landlord identity verification or legal acknowledgement of rent paid.

## What we actually tested

On **10 November 2026**, a wallet holder successfully approved one **0.005 NIM (500 Luna)** transfer with the Nimiq Pay native confirmation sheet to a separate wallet. A public Nimiq mainnet history node independently reported the exact amount, destination, `RR1` memo, successful execution, canonical microblock inclusion and later macroblock. The recipient's wallet holder separately confirmed that 0.005 NIM appeared in the destination wallet.

Evidence and caveats: [G2 pilot ledger](docs/G2_PILOT_500_LUNA.md), [full scoring and release gate](docs/SUBMISSION_READINESS.md), [demo plan](docs/MAINNET_DEMO_AND_SUBMISSION_GATE.md). Full wallet addresses and private user recordings are **not included** in this public repository without explicit consent.

### Important limitations (as of Cycle III)

- **Public build is read-only for money movement.** The sole user-authorized 500-Luna wallet-send pilot was in a dedicated access-protected deployment, **not** this public preview. No further transfers are authorized by this release.
- The pilot native confirmation UI displayed **0.01 NIM** while the final mainnet transfer contained **0.005 NIM**. This unresolved display discrepancy must not be hidden or treated as an accepted payment UX.
- Verification uses a **single public RPC node** and may fail if that node is unavailable; it is not independently replicated cryptographic proof.
- The landlord/tenant request URL is **not signed** and can be altered by its sender. Nimiq address checksum validation prevents typing errors, not impersonation.
- Portfolio records are **local to the device/browser** and do not automatically synchronize with other tenants/landlords.
- The app makes no custodial transfers, money-transmitter representations, refunds, payment guarantees, legal rent receipts, or verified-user count claims.

## Develop and test

Requirements: **Node 22+** and npm.

```bash
npm install
npm test
npm run build
npm run dev
```

Nimiq Pay SDK: `@nimiq/mini-app-sdk`. Mainnet independent read-only history node: `https://rpc.nimiqwatch.com/`. Public SDK [documentation](https://nimiq.dev/mini-apps/api-reference/nimiq-provider).

**Never set** `VITE_ENABLE_LIVE_NIM_SEND=smoke_test_human_approved` for a public general deployment. Only a separately reviewed one-time pilot may use the exact receiver, amount, memo and consent constraints. The old pilot must **not** be reused.

## Evidence status

| Gate | Evidence |
|---|---|
| Native Nimiq Pay on iPhone | **PASS** on exact 500-Luna pilot |
| SDK host reports mainnet + public RPC accessible from mobile | **PASS** |
| One real user-approved mainnet 500-Luna transfer | **PASS** |
| One public history node reports exact matching and later macroblock | **PASS_WITH_SINGLE_NODE_CAVEAT** |
| Destination wallet acknowledges receipt | **USER_CONFIRMED** |
| Native wallet amount shown correctly | **OPEN BUG — 0.01 vs 0.005 NIM** |
| General reusable public direct-payment sending | **DISABLED** |
| Actual rent / multi-property multi-party adoption | **NOT TESTED** |
| Official Nimiq Cycle III submission | **NOT YET VERIFIED** |

## Competition and team

Nimiq Mini Apps Competition — **Cycle III / PAY**, Nov 11 2026 deadline. The full submission, demo and team-lead wallet must be entered through the [official portal](https://miniappscompetition.com/submit); a public GitHub repo or draft PR alone is not the entry.

If collaborating on the submission, settle team lead, teammate credits, payout wallet and public media consent with the human participants before submitting.

Licensed under **MIT** — see [LICENSE](LICENSE).
