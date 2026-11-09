# Evidence ledger — never confuse test, browser, wallet and mainnet
**Updated:** 2026-11-09 · **Repository:** Faadil1/rentrail

| Gate | Current status for THIS repo | Required evidence | Authority |
|---|---|---|---|
| G0 repo/rules | PARTIAL | Public GitHub + MIT + official rules, PR accepted | Repo/official docs |
| G1 host | NOT_RUN | Nimiq Pay (not Safari) loads this app; sdk `init()`, correct Nimiq network, device/app version | Actual phone |
| G2 NIM payment | NOT_RUN | Explicit user-approved small mainnet send, tx hash, exact destination+memo; no automatic retry | Wallet owner |
| G3 read/finality | NOT_RUN | Independent mainnet RPC raw response, canonical execution and later macroblock, no ambiguity | Independent RPC |
| G4 product | NOT_RUN | Two units and periods, partial/duplicate/wrong-recipient/overpay edge cases | Tests + device |
| G5 real usage | NOT_OBSERVED | Consenting real walkthrough and exact observations | Participant |
| G6 submission | NOT_SUBMITTED | Official portal confirmation, app URL, repo, demo, category PAY | Human |

## Observed prior experiment, **NOT RentRail evidence**
2026-11-09: unrelated FloatBook/RevokeReady gate-kit interface opened successfully in iPhone Safari on a LAN address. Nimiq Pay custom-URL loader previously rejected an HTTP URL. Safari reported absence of injected provider, correctly. The earlier gate kit's 38 synthetic tests do not carry over to this product.

## Evidence record format
```text
ID:
UTC timestamp:
Code SHA / deployment:
Device OS + app version:
Host browser or Nimiq Pay:
Network name + chain ID:
RPC endpoint, sync/network check, raw result reference:
Transaction hash (public only):
Recipient, opaque memo, amount Luna:
Execution result, tx block + later macroblock:
Expected / observed / pass-fail:
Screenshot or video link:
Human approval (if financial action):
Uncertainties / next action:
```

## Hard stop rules
- Failing or missing proof means NOT_VERIFIED, not PASS.
- A wallet-returned hash is SUBMITTED_UNVERIFIED, not paid.
- Browser-only preview never meets G1.
- RPC provider unreachable => UNKNOWN; do not treat as zero activity or as payment.
- A screenshot/checkbox is not independent payment proof.
- No mainnet transactions requested or authorized by this documentation PR.

## External trusted references
https://miniappscompetition.com/rules
https://nimiq.dev/mini-apps/api-reference/nimiq-provider
https://nimiq.dev/rpc/methods/
https://nimiq.dev/protocol/consensus/block-format