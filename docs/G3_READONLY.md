# G3 — Read-only Nimiq mainnet RPC reconciliation

**Updated:** 2026-11-09 · **Branch:** `feat/rpc-g3-readonly` · **Scope:** independent-of-wallet chain observation, no payment sends.

## Observed live RPC shape (real GitHub Actions, not synthetic)
Run: https://github.com/Faadil1/rentrail/actions/runs/42640567756  
Observed at: **2026-11-09T15:02:30Z** via public third-party `https://rpc.nimiqwatch.com/`.

- `isConsensusEstablished`: `true`
- `getLatestBlock(false)`: network `MainAlbatross`, head height `66,450,475`, timestamp in **milliseconds**.
- `getBlockNumber()`: `66,450,476` (head advanced by 1 block between calls).
- `getMacroBlockAfter(66,450,355)`: returned `66,450,360`; `getBlockByNumber(66,450,360,false)`: **type macro**, network `MainAlbatross`.
- `getTransactionsByBlockNumber(66,450,450)`: 3 public transactions. A `getTransactionByHash` sample returned `blockNumber`, `networkId:24`, `executionResult:true`, `recipientData` as hexadecimal string and `value` as number. **This was an unrelated public transaction; no rental-payment match was attempted or claimed.**
- CORS preflight from the RentRail HTTPS origin: HTTP 204, `Access-Control-Allow-Origin: *`, allowed header `content-type` and method `POST`. This does **not** prove that the actual iOS Nimiq Pay WebView has working RPC access.

Official references:
- https://nimiq.dev/migration/migration-json-rpc (PoS JSON-RPC `result.data`, renamed `recipientData`)
- https://nimiq.dev/rpc/methods/get-block-by-number
- https://nimiq.dev/rpc/methods/get-transactions-by-block-number
- https://nimiq.dev/migration/migration-integrators (macroblock finality)
- https://rpc.nimiqwatch.com/ (rate limits and no uptime guarantee)

## Verifier contract — `src/rpc.ts`
Read-only RPC allowlist ONLY:
`isConsensusEstablished`, `getLatestBlock`, `getTransactionByHash`,
`getBlockByNumber`, `getMacroBlockAfter`, `getTransactionsByBlockNumber`.
All RPC calls use POST JSON-RPC `2.0`, positional `params`, and parse **only** `result.data` with a matching response `id`. Browser fetch uses TLS, no credentials, no redirects, no-cache, and 10-second per-call timeout.

Only return `FINAL_MATCHED` if:
1. The node has consensus, head block says `MainAlbatross` and is within the freshness window.
2. Transaction hash is exact (64 hex); `networkId=24` and `executionResult===true`.
3. `to` equals expected NQ recipient; transferred Luna is safe integer and equals obligation amount, or partial mode explicitly allows a positive amount not exceeding the charge.
4. `recipientData` is valid strict hex-decoded UTF-8 and equals the opaque memo `RR1:<32hex>`.
5. `blockNumber` is a valid height, `getBlockByNumber(height,false)` is a canonical `micro` block on `MainAlbatross`, and `getTransactionsByBlockNumber(height)` contains the exact hash.
6. `getMacroBlockAfter(height)` returns a higher height, which is reached by the head, and `getBlockByNumber(macroHeight,false)` returns a canonical `macro` block on `MainAlbatross`.
7. Any missing field, mismatch, malformed RPC envelope, chain ID uncertainty, unavailable CORS, rate-limit 429, stale node or questionable canonicality fails closed.

Returned states: `UNKNOWN`, `NOT_FOUND`, `REVIEW_REQUIRED`, `INCLUDED_NOT_FINAL`, `FINAL_MATCHED`.

**Financial authority boundary:** `FINAL_MATCHED` means **one public node reported that evidence**. It is not a proof that a landlord owns the recipient, not guaranteed legal payment of rent, not global transaction allocation, and not independent cryptographic light-client or multi-node consensus. The UI **does not persist or credit** this result to the rental ledger. Repeat verification can return different results during outages/reorgs; evidence must include as-of timestamp and provider.

## How to test on iPhone
1. Open the **G3 Preview HTTPS** in **Nimiq Pay** → Mini Apps → Custom URL, not Safari alone.
2. Select **Wallet gate**. Press **Check host** (already observed during G1).
3. Press **Check mainnet RPC connectivity**. Expect a node-reported network and head height, or `NOT_VERIFIED` with an error. If the wallet SDK height differs greatly from the public RPC, treat it as potential different-network warning, **not a definitive testnet verdict**.
4. Create a local *real* obligation (not fictional example) and paste a known public 64-character transaction hash to run read-only tuple checks. A nonmatching hash must never be credited.
5. **Do not attempt a new real payment** in this preview. `paymentEnabled=false` remains compiled into UI.

## Verification matrix
| Gate | State | Evidence |
|---|---|---|
| G1 SDK injection on real iPhone | PASS | User's 2026-11-09 native wallet video (private) |
| G3 RPC network/head live from GitHub Actions | PASS observation | Actions 42640567756 |
| G3 real unrelated public transaction schema | PASS observation | Actions 42640567756 |
| G3 CORS OPTIONS preflight | PASS observation | Actions 42640567756 |
| G3 verifier unit/failure tests | PASS synthetic | GitHub CI (86 tests as of 2026-11-09) |
| G3 real iPhone browser RPC call | NOT_OBSERVED | User device recording needed |
| G3 RentRail real transaction finality + exact tuple | NOT_OBSERVED | Requires explicit approved tiny mainnet payment, secure recipient binding, independent verification |
| G3 two independent nodes / trust | NOT_IMPLEMENTED | Single history RPC |
| G2 approved NIM transfer | NOT_PERFORMED | User authority, no automatic send |
| G6 final submission | NOT_SUBMITTED | Official portal confirmation absent |

## Limits requiring follow-up before release
- Need confirm host wallet mainnet identity explicitly; do not infer from SDK consensus.
- Need prevent replay / double allocation *across devices*, requiring durable authenticated shared state if claims made.
- Need verified landlord wallet ownership or independently trusted recipient before payment.
- No cross-device synced tenant/manager ledger, no cryptographic signed invoice, no legal rent discharge.
- Public RPC is third-party, rate-limited (~20 tokens/10 sec) and can return stale, missing, or misleading data; consider redundant provider / full node.
- Check client-side `fetch` in the actual Nimiq Pay WebView, not only from GitHub Actions or Safari.
- Exact deployed commit and build evidence must be linked in the product gate ledger; no transfers until human approval.

## Strict scope of this PR
Implements read-only proof review only, retaining the payment lock. This PR is stacked on `feat/rent-ledger-host-v1` and **does not merge into `main`**.
