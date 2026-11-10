# G2 Payer wallet preflight — public read-only account inspection

Date: 2026-11-09 late EST / 2026-11-10 UTC. Stacked on `feat/mainnet-test-readiness`.

## Human-reported balance vs verified wallet balance

User reports having **about 1 NIM** in the Nimiq Pay wallet connected to RentRail. This is user-provided context, NOT a verified SDK balance or proof of which public account will be selected for sending.

**Protocol fact:** Nimiq rejects transactions when sender and recipient are equal. A payment cannot be demonstrated by sending NIM to the same NQ address. The user may fund a *distinct* recipient NQ address they control, or a separate consenting test recipient; do not send real NIM to a third party without independently verifying the public address.

Official sources:
- https://nimiq.dev/protocol/transactions (Sender Equals Recipient error)
- https://nimiq.dev/mini-apps/api-reference/nimiq-provider (listAccounts, getBalance and account-selection boundaries)

## Implementation in this PR

- `src/wallet-preflight.ts`: explicit-click, read-only SDK `listAccounts()` + `getBalance(address)`; strict mainnet-only for G2, maximum 8 shared accounts, structural validation, no cached data persisted in any ledger or backend, normalized address comparison.
- Account list is only requested after native host is detected and MAINNET; Nimiq Pay handles account permission. Address display is truncated by default; the user may explicitly copy a public address. Never request seed phrase/keys.
- Balance is **in Luna**. A successful zero is zero; network failure or missing balance API is **UNKNOWN**, not zero.
- No inference that the first or largest balance address is the actual sender. Nimiq Pay chooses signer/transaction sender; SDK provides no sender override. A shared address list is **not proof of ownership or signer identity**.
- `receivingAddressAssessment()` warns if candidate recipient appears anywhere in payer's shared account list.
- G2 smoke gate now blocks when wallet accounts have not been explicitly shared or the recipient matches any wallet-shared address (conservative against self-sends).
- The money-moving host adapter re-queries `listAccounts()` and forbids same-wallet recipient before a native send even in a separately approved experimental build.
- This PR **DOES NOT enable a wallet transfer**. Normal staging lacks `VITE_ENABLE_LIVE_NIM_SEND` and `VITE_SMOKE_ALLOW_RECIPIENT`. A dedicated, separately approved <=0.01 NIM smoke build would still need a different verified recipient, fresh mainnet evidence and native human approval.

## Expected user test — no payment

1. Open the new exact Staging URL inside Nimiq Pay.
2. Wallet gate → Check host → ensure MAINNET, then Check mainnet RPC connectivity.
3. Click **Check my addresses and balances**. Native Nimiq Pay may request permission to share public NQ addresses. Decline is a normal safe outcome.
4. Confirm the on-device balance reported for the shared account with ~1 NIM (100,000 Luna) or note a mismatch/unknown; do not assume total wallet balance.
5. Use **Copy public address** only if a public address is needed; keep full address out of screen recordings for privacy. Never share recovery phrase or private key.
6. Identify a **different** independently verified receiving NQ address; do not try to send to the same address. Do not initiate any transfer in this read-only build.

## Status
- Synthetic wallet account / missing balance / invalid address / self-transfer tests: automated PASS at last successful branch CI, see PR.
- Real user wallet address inventory and 1 NIM balance: **NOT_YET_OBSERVED**. No public NQ address was disclosed to the assistant.
- G2 host MAINNET and public MainAlbatross with 7-block delta: previous iPhone recording PASS.
- Real mainnet transfer and actual rent hash: **NOT_PERFORMED**. G3 exact canonical rent tuple/macroblock: **NOT_VERIFIED**.
- Submission: **NOT_SUBMITTED**.

**Safety:** Do not enable money movement in this staging. This does not grant authority to move funds or to select a payer. For a permitted real-wallet test, explicit human approval and a second distinct recipient are mandatory.
