# Stub
> *stub (n.): the part of a receipt or ticket you keep as proof.*
### Rent requests paid in NIM inside Nimiq Pay, confirmed on Nimiq mainnet

**Nimiq Mini Apps Competition · Cycle III · Pay** · MIT License

**Live Mini App:** _URL to be set at deploy_ (open it in **Nimiq Pay → Mini Apps → add by URL**)

## The problem

Rent is the biggest payment most people make every month, and the hardest to keep track of. A landlord with a few units needs to know *which* rent each transfer is for. A tenant needs proof they paid. A plain wallet transfer gives neither: it is an amount and an address, nothing more.

## What Stub does

**Use a Nimiq Pay wallet without creating a Stub account.** Listing a wallet address is not itself authentication. Signed requests prove control of the receiving wallet key, not real-world landlord identity.

**For landlords and small property managers**
- Connect Nimiq Pay to select a receiving address. A signature must match that address before Stub treats a request as wallet-signed.
- Add properties and units, then **sign a monthly lease** once (rent, due day, first month). Stub creates each month's request automatically. One-off requests work too.
- Send the link to the tenant once. Every request carries a unique, random `STUB1:` reference. No names go on-chain.
- **Find incoming payments** on opening a saved portfolio or selecting **Sync payments**. Stub searches a bounded history from a single public mainnet RPC, matches `STUB1` references and separately rechecks transfers; it cannot guarantee complete monitoring, legal rent settlement or sender identity.
- Copy reminders with the payment link, export a CSV, back up the ledger to a file.

**For tenants**
- Open the link in Nimiq Pay. Stub shows whether the request is **signed by the owner of the receiving address**, and warns if the address differs from the landlord you paid before.
- Tap **Pay**, approve in the native Nimiq Pay sheet. Stub never holds funds or keys.
- Stub checks the transfer using a public mainnet RPC, shows a matched-payment status, a **printable record (save as PDF) with QR code**, and an optional **wallet-signed claim about the transaction hash**. The claim signature does not prove which wallet sent the NIM.
- **My rent** keeps every month on your device; with a lease, the next month appears by itself.

## Security model

| Threat | Protection |
|---|---|
| Someone edits a request link (address, amount, month) | Requests and leases are signed by the landlord's wallet (Nimiq signed message, Ed25519). The tenant's app verifies the signature and that the signer owns the receiving address; a modified link **blocks payment** |
| A fake landlord sends a validly signed link with their own address | The tenant's device remembers which landlord address it paid; a new address requires explicit confirmation. Unsigned links also require confirmation |
| Someone signs a claim about another wallet's transaction | Stub identifies only the **claim signer** (not the on-chain sender) and does not automatically learn a tenant identity from the claim |
| A payment counted twice or for the wrong month | A hash can be credited once within a local ledger; the `STUB1` reference, recipient, amount, execution and finality must match the public RPC node report |
| Wrong amount shown in the wallet | Requests use at most 2 decimals, matching the Nimiq Pay confirmation sheet |
| Keys or funds exposure | None: non-custodial, no backend, signing and payment happen inside Nimiq Pay |

Signature verification is tested against a vector from the official `@nimiq/core` library. If a wallet returns a signature Stub cannot verify, the request is saved unsigned (never a false alarm).

## How Nimiq is used

| | |
|---|---|
| Wallet access | `listAccounts()` suggests a receiving address, but does not itself prove ownership or legal landlord identity |
| Authenticity | `sign()`: landlords sign requests and leases, tenants sign payment proofs |
| Payment | `sendBasicTransactionWithData`: exact recipient, value in Luna and the `STUB1:` reference as transaction data, approved in the native sheet |
| Reconciliation | Public Nimiq mainnet history node: incoming transfers by address, then a full check of each (network 24, execution, recipient, reference, amount, micro block inclusion, later macro block) |

## Try it in 60 seconds

1. Open the Mini App and choose **Show me Stub → Open sample**: two buildings, three units, one rent already paid.
2. As landlord: **Connect Nimiq Pay**, add a property and a unit, then create a lease or a request (for a test, 0.01 NIM). Approve the signature.
3. Tap **Send**, open the link in Nimiq Pay with a second wallet: it shows **Signed**. Tap **Pay**.
4. Wait for **Paid ✓**, download the receipt, send the signed proof. On the landlord side the payment also appears by itself after **Sync payments**.

## Design choices and limits

- **Non-custodial and serverless.** Funds go tenant → landlord directly. The ledger lives in the landlord's browser storage (back it up from the Properties page).
- **Amounts use at most 2 decimals** (min 0.01 NIM). We found that the Nimiq Pay confirmation sheet rounds to 2 decimals (a 0.005 NIM test showed as 0.01 NIM); keeping requests at 2 decimals means the sheet always shows the exact amount. Details: [docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md](docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md).
- **One public history node** is used for confirmation. Incoming searches are bounded to 200 recent transactions per address and at most 10 distinct recipient addresses per sync; a second independent node is planned.
- Stub reports what a third-party RPC node says happened on-chain; this is not an independent light-client proof or a legally valid rent receipt. Stored data on each device may become stale or be manually changed; recheck on-chain.
- **The signed-link payment rules are enforced again before the native wallet payment call**, rather than relying only on the disabled UI button.
- **Submission artwork:** `docs/submission-assets/` includes app-derived images. Any images captured with simulated Nimiq Pay wallets must be disclosed as simulations and must not be presented as a real mobile payment demo.
- NIM only for now; USDT (stable rent) is on the roadmap.

## Roadmap

USDT rent · second mainnet node · notifications when rent is due · co-managed portfolios.

## Develop

Node 22+.

```bash
npm ci
npm test       # unit tests: amounts, references, reconciliation, proof storage, backups, RPC verification
npm run build
npm run dev
```

See [APP_SETUP.md](APP_SETUP.md) to test inside Nimiq Pay and deploy. Earlier internal test notes are in [docs/archive](docs/archive).

Licensed under [MIT](LICENSE).
