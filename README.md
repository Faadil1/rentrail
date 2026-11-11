# RentRail
### Rent requests paid in NIM inside Nimiq Pay, confirmed on Nimiq mainnet

**Nimiq Mini Apps Competition · Cycle III · Pay** · MIT License

**Live Mini App:** _URL to be set at deploy_ (open it in **Nimiq Pay → Mini Apps → add by URL**)

## The problem

Rent is the biggest payment most people make every month, and the hardest to keep track of. A landlord with a few units needs to know *which* rent each transfer is for. A tenant needs proof they paid. A plain wallet transfer gives neither: it is an amount and an address, nothing more.

## What RentRail does

**Connect a Nimiq Pay wallet without creating a RentRail account.** The wallet shares an address; an independently verified signature can establish control of its signing key, but a shared address alone does not prove identity or ownership of rental property.

**For landlords and small property managers**
- Connect Nimiq Pay to select a proposed receiving address. Signing only succeeds when the actual signing key proves control of that receiving address; account listing alone is not sufficient.
- Add properties and units, then **sign a monthly lease** once (rent, due day, first month). RentRail creates each month's request automatically. One-off requests work too.
- Send the link to the tenant once. Every request carries a unique, random `RR1:` reference. No names go on-chain.
- **Review incoming payments**: on opening a saved portfolio or choosing **Sync payments**, RentRail searches recent transfers to its configured receiving addresses, matches their `RR1` references and rechecks execution and finality. This is a bounded, single-node history check, not guaranteed comprehensive monitoring or legal proof of rent owed.
- Copy reminders with the payment link, export a CSV, back up the ledger to a file.

**For tenants**
- Open the link in Nimiq Pay. RentRail shows whether the request is **signed by the owner of the receiving address**, and warns if the address differs from the landlord you paid before.
- Tap **Pay**, approve in the native Nimiq Pay sheet. RentRail never holds funds or keys.
- RentRail checks the transfer on mainnet, shows a matched payment, a **printable receipt (save as PDF in the browser, with a QR code)**, and a **wallet-signed claim** to share with the landlord. A claim signature does not itself establish the transaction's actual sender.
- **My rent** keeps every month on your device; with a lease, the next month appears by itself.

## Security model

| Threat | Protection |
|---|---|
| Someone edits a request link (address, amount, month) | Requests and leases are signed by the landlord's wallet (Nimiq signed message, Ed25519). The tenant's app verifies the signature and that the signer owns the receiving address; a modified link **blocks payment** |
| A fake landlord sends a validly signed link with their own address | The tenant's device remembers which landlord address it paid; a new address requires explicit confirmation. Unsigned links also require confirmation |
| An unrelated wallet signs a claim about someone else's transaction | RentRail labels that wallet as the claim signer only, **not the proven blockchain sender**; do not automatically bind it to a tenant or unit |
| A payment counted twice or for the wrong month | A transaction hash is credited once within a local ledger, to one request; the `RR1` reference, recipient, amount, execution and finality must all match one public RPC node |
| Wrong amount shown in the wallet | Requests use at most 2 decimals, matching the Nimiq Pay confirmation sheet |
| Keys or funds exposure | None: non-custodial, no backend, signing and payment happen inside Nimiq Pay |

Signature verification is tested against a vector from the official `@nimiq/core` library. If a wallet returns a signature RentRail cannot verify, the request is saved unsigned (never a false alarm).

## How Nimiq is used

| | |
|---|---|
| Wallet access | `listAccounts()` suggests an address; it **does not prove signer ownership**, and Nimiq Pay does not guarantee that the first returned account is the signer |
| Authenticity | `sign()`: landlords sign requests and leases, tenants sign payment proofs |
| Payment | `sendBasicTransactionWithData`: exact recipient, value in Luna and the `RR1:` reference as transaction data, approved in the native sheet |
| Reconciliation | Public Nimiq mainnet history node: incoming transfers by address, then a full check of each (network 24, execution, recipient, reference, amount, micro block inclusion, later macro block) |

## Try it in 60 seconds

1. Open the Mini App and choose **Show me RentRail → Open sample**: two buildings, three units, one rent already paid.
2. As landlord: **Connect Nimiq Pay**, add a property and a unit, then create a lease or a request (for a test, 0.01 NIM). Approve the signature.
3. Tap **Send**, open the link in Nimiq Pay with a second wallet: it shows **Signed**. Tap **Pay**.
4. Wait for **Paid ✓**, download the receipt, send the signed proof. On the landlord side the payment also appears by itself after **Sync payments**.

## Design choices and limits

- **Non-custodial and serverless.** Funds go tenant → landlord directly. The ledger lives in the landlord's browser storage (back it up from the Properties page).
- **Amounts use at most 2 decimals** (min 0.01 NIM). We found that the Nimiq Pay confirmation sheet rounds to 2 decimals (a 0.005 NIM test showed as 0.01 NIM); keeping requests at 2 decimals means the sheet always shows the exact amount. Details: [docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md](docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md).
- **One public history node** is used for confirmation. It is consulted on explicit verification and bounded history checks (up to 200 recent transactions per address, at most 10 addresses per sync). A second independent node is planned.
- **Signer identity ≠ payment sender.** A wallet-signed claim proves who signed a statement about a transaction, not who transmitted the NIM. A signed request binds payment terms to the receiving wallet key, but not to a real-world landlord identity.
- Local browser records and cached proofs are not authenticated financial records; they can be lost or edited and should be rechecked on-chain. RentRail does not issue legal rent receipts.
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
