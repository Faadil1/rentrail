# First controlled PAY pilot — recipient B validated, no transfer

Updated: 2026-11-10 UTC. Branch `feat/recipient-b-preflight`, stacked on PR #11.

## User-provided recipient
The wallet owner has supplied a *public* Nimiq NQ address for independently controlled destination wallet B, abbreviated here as **`NQ48 HR14…E1QT`** to avoid associating the full blockchain address with the owner's public GitHub profile. This is not a secret; nonetheless the private wallet-to-user link should not be needlessly republished in repository history.

The user-provided address has:
- Correct NQ alphanumeric formatting / length: 36 unspaced characters.
- Mod-97 IBAN-style checksum remainder: **1** (valid).
- Ownership of B and sender/receiver separation: **NOT independently attested**.
- Mainnet on-chain account history/balance: **NOT read** (receiving B does not require pre-funding).
- Recipient allowlist in a live-send-enabled build: **NOT SET**.
- User's payer balance ~1 NIM: **user-reported**, not independently observed from the new account-preflight view.

## Intended one-time transaction — NOT AUTHORISED / NOT PERFORMED
- From user's connected Nimiq Pay mainnet wallet **A** to separate public wallet **B**.
- **0.005 NIM = 500 Luna**, plus fee selected and displayed by Nimiq Pay.
- Test must use a novel 32-hex `chargeId` and opaque `RR1:<id>` memo, a test-only local obligation (not actual residential rent).
- Both host mainnet and independent MainAlbatross must be fresh with close heights, and the account list must be explicitly shared via Nimiq Pay native permission.
- The receiver B must **not** appear among addresses returned by account-list permission on payer wallet A. The SDK chooses the actual signing account; do not infer it from ordering.
- Wallet owner must approve both the *specific amount and destination* and then the native Nimiq Pay signing dialog. Cancel or network errors are safe aborts, never blind retries.
- A returned hash is **SUBMITTED_UNVERIFIED**. After finalization, an independent public mainnet node must recheck exact recipient, amount, memo, tx execution, canonical microblock membership, later macroblock, plus replay safety before making any claim.
- The pilot cannot prove contractual rent settlement or generalized PAY readiness.

## Implementation
- `src/address-validation.ts` implements strict offline NQ mod-97 checksum validation, independent of the structural validator used for synthetic fixtures.
- `src/smoke-gate.ts` requires a checksum-valid recipient AND checksum-valid build-time allowlisted destination.
- `src/host.ts` double-checks checksum before calling the native money-moving adapter.
- The public tenant view displays full-checksum result separately from warnings that this **does not establish recipient ownership**.
- No user-specific NQ address was hard-coded in source code or public tests.
- Existing staging sends remain disabled unless a future *separately authorized dedicated build* supplies **both** the exact recipient allowlist and the explicit live-send flag.
- CI tests cover bad checksum, malformed addresses and historical mock fixture compatibility.

## Immediate acceptance
- Open the new **read-only** staging with the prefilled 0.005-NIM demo link.
- Within Nimiq Pay, `Check host` → MAINNET; `Check independent mainnet RPC` → `MainAlbatross`, heights coherent.
- `Check payer addresses`: native sharing permission; verify address B is **not** among payer's shared addresses, and check expected ~1 NIM in a selected account.
- Confirm B controls its separate receiving wallet out of band. **DO NOT SEND FUNDS YET**.
- Only after owner explicitly approves the specific pilot payment will a distinct isolated, capped and allowlisted test-capable deployment be considered.

Evidence state: **address checksum PASS; iPhone host/RPC alignment PASS; B absent from 2 shared payer-wallet addresses PASS (observational); B ownership and payer balance NOT VERIFIED; real payment NOT PERFORMED; G3 matching NOT VERIFIED; payment-enabled build NOT APPROVED; competition submission pending.**
