# Architecture & trust boundaries — RentRail v0.1

## Proposed modules (design, not an implemented system)

```text
Nimiq Pay WebView (mobile)
  ├─ Tenant request / inspect / wallet-confirm payment
  ├─ Landlord or manager portfolio (many buildings / units / periods)
  ├─ Pure rental ledger reducer: amount due - verified allocations
  ├─ Host adapter: @nimiq/mini-app-sdk init(), account consent, send-with-data()
  ├─ Read-only Nimiq mainnet RPC client (reconciliation / finality)
  └─ Local data store (drafts, display prefs, optional local portfolio)
                   ↕
         Privacy-minimal share link
                   ↕
        Other user / other device

No server sync is asserted in contest MVP. In future:
Auth + permissioned backend + audit trail + encrypted PII + owner/tenant access.
```

## Exact entities
- `Portfolio {id, version, ownerWalletAddress, buildings[]}`
- `Building {id, portfolioId, displayLabel}`
- `Unit {id, buildingId, privateLabel, active}`
- `RentCharge {id, unitId, periodKey:'YYYY-MM', amountLuna:integer, currency:'NIM', recipientAddress, status, revision}`
- `PaymentRequest {id:opaque, chargeId, memo, amountRequestedLuna, recipientAddress, createdAt, expiresAt?}`
- `ObservedTransfer {chain:'nimiq-mainnet', txHash, recipient, amountLuna, publicMemo, blockHeight, executionResult, sourceEndpoint, verifiedAt, finalityEvidence}`
- `Allocation {id, requestId, chargeId, txHash, amountLuna, verifiedAt, state}`
- `Exception {kind:'WRONG_CHAIN'|'WRONG_RECIPIENT'|'WRONG_REFERENCE'|'DUPLICATE_TX'|'AMOUNT_MISMATCH'|'UNFINALIZED'|'RPC_UNAVAILABLE'|'OVERPAYMENT'|'UNSUPPORTED', reason, evidence}`

**Source of truth boundaries:** charge/request are off-chain intentions; chain transfer is independent evidence; allocation is a derived association. Cryptographic verification does not establish rental agreement or legal finality.

## Matching rules
1. Parse result only from a known, synced **mainnet** RPC whose network identity is checked. Verify raw schema against a real observed response prior to enabling payment claims.
2. Require a real canonical transaction with successful execution (not pending/mempool/rejected). Confirm recipient equals the agreed wallet address.
3. Require exact string match to generated **opaque** memo (64-byte UTF-8 cap). Don't credit unidentified payments.
4. Require safe integer Luna values; reject zero/negative, malformed and overflows; compare amount actually transferred, not requested amount or fee.
5. Require appropriate later macroblock state (verify block path / chain ID; never assume 'confirmed' means final); store the verification scope/provider and timestamp.
6. Unique key `chain:txHash` can be allocated at most once across the portfolio. If request differs, review rather than double-credit. For partial payments, sum only independently verified unique transfers.
7. If sum == amount due: `PAID_ONCHAIN_VERIFIED`. If sum < due: `PARTIALLY_FUNDED`. If sum > due: `REVIEW_REQUIRED`, no automatic refund/next-month assignment.
8. A stale/offline/read-only report can show a previous VERIFIED-AS-OF timestamp, never imply a fresh reread.
9. If multiple references or ambiguous historical scan, show *not fully checked* until scope is known.

## State machine (illustrative)
```text
DRAFT -> OPEN -> SUBMITTED_UNVERIFIED -> INCLUDED_NOT_FINAL
                          |                       |
                          v                       v
                   FAILED_OR_UNKNOWN         FINAL_MATCHED
                                                  |
                                     +------------+--------------+
                                     |            |              |
                               PARTIALLY_FUNDED PAID_ONCHAIN_VERIFIED REVIEW_REQUIRED
```
On any network outage, malformed RPC result, unexpected sender or reorg: status returns to UNKNOWN/REVIEW without pretending a paid receipt.

## Payment integration
```ts
// Illustrative contract only; do not invoke until recipient/value/memo verified
const nimiq = await init()
const txHash = await nimiq.sendBasicTransactionWithData({
  recipient: agreedRecipient,
  value: amountLuna,
  data: opaqueMemo // <= 64 UTF-8 bytes; PUBLIC
})
// Hash => SUBMITTED_UNVERIFIED only. Reconcile independently.
```
SDK chooses signer; `listAccounts()` does not prove signer identity. All wallet sends require native approval and explicit human initiation. A failure may have unknown outcome: inspect chain before retry.

## Share links
Do not encode tenant names, exact property addresses, contracts or private rent notes. Share a request ID plus minimal payment tuple (currency, recipient, amount, memo, human-readable month as necessary) with clear disclaimer that tampered links cannot prove landlord identity. Before using share links for real rent, validate recipient independently with property owner; future upgrade may use signed request with verified binding.

## Important product trade-off
A local-only portfolio is enough for a **single-device landlord overview**, while a portable request plus independent chain query can be viewed on another device. It is **not** secure synchronized property management. Real team collaboration, tenant auth, update propagation and cross-device private records require a backend, security design and privacy/consent gates. Keep these promises out of contest marketing unless implemented.

## Security
- Never ingest or print seed phrases/private keys, API secrets or PII in logs.
- Block submission if public memo contains personal information.
- Provide stateful pending UI; don't retry an uncertain transfer.
- Verify numeric conversion in integer units. Keep test fixtures segregated.
- Version schema and persisted records; avoid accidental irreversible storage migration.
- Read-only RPC provider may rate limit/lag/lie; consider second provider for corroboration before production.
- No automatic fund movement, escrow or court/tenancy compliance claims.

## Design decision checkpoints
Nimiq Pay on iOS/Android, chain network identity, RPC field semantics, macroblock checks, wallet account roles, public share links and app origin each require runtime confirmation. See [EVIDENCE_LEDGER.md](EVIDENCE_LEDGER.md).

## References
https://nimiq.dev/mini-apps/api-reference/nimiq-provider
https://nimiq.dev/rpc/methods/
https://nimiq.dev/mini-apps/development/load-local-mini-app
https://github.com/subimpact/nimbooks