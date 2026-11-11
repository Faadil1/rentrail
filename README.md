# RentRail
### Rent requests paid in NIM inside Nimiq Pay, confirmed on Nimiq mainnet

**Nimiq Mini Apps Competition · Cycle III · Pay** · MIT License

**Live Mini App:** _URL to be set at deploy_ (open it in **Nimiq Pay → Mini Apps → add by URL**)

## The problem

Rent is the biggest payment most people make every month, and the hardest to keep track of. A landlord with a few units needs to know *which* rent each transfer is for. A tenant needs proof they paid. A plain wallet transfer gives neither: it is an amount and an address, nothing more.

## What RentRail does

**For landlords and small property managers**
- Add properties and units, then create a **rent request per unit and month** (amount in NIM, your receiving address).
- Send the request link to the tenant (share sheet or copy). Each request carries a unique, random `RR1:` reference. No names or addresses go on-chain.
- See **who has paid this month**: paid, partly paid, late or still due, unit by unit. Copy a reminder with the payment link. Roll every request over to next month in one tap.
- Export a CSV of the month, or back up the whole ledger to a file.

**For tenants**
- Open the link inside Nimiq Pay, check the month, the amount and the landlord's address, and tap **Pay**.
- Nimiq Pay shows its native confirmation. RentRail never holds funds or keys.
- RentRail then watches **Nimiq mainnet** until the transfer is final and shows **Paid ✓**, with a **proof link** to send to the landlord.

**The proof link closes the loop.** When the landlord opens it, RentRail re-checks the transaction live on mainnet and marks that month paid in their ledger. No backend, no account, nothing to trust but the chain.

## How Nimiq is used

| | |
|---|---|
| Payment | `@nimiq/mini-app-sdk` `sendBasicTransactionWithData`: exact recipient, value in Luna and the `RR1:` reference as transaction data, approved in the native Nimiq Pay sheet |
| Network | Refuses to pay when Nimiq Pay reports testnet or has no consensus |
| Confirmation | Reads the transaction from a public Nimiq mainnet history node (`rpc.nimiqwatch.com`) and requires: network ID 24, successful execution, exact recipient, exact reference, amount, inclusion in a canonical micro block and a later macro block (finality) |
| Ledger | A transaction hash can be credited once, to one request. Partial payments add up; overpayments are flagged for review |

## Try it in 60 seconds

1. Open the Mini App and choose **Show me RentRail → Open sample**: two buildings, three units, one rent already paid.
2. Exit the sample, add a property and a unit, and create a rent request (for a test, 0.01 NIM to a second wallet of yours).
3. Tap **Send link**, open the link in Nimiq Pay with the other wallet and tap **Pay**.
4. Wait for **Paid ✓**, tap **Send proof to my landlord**, and open that link on the landlord side: the request is marked paid.

## Design choices and limits

- **Non-custodial and serverless.** Funds go tenant → landlord directly. The ledger lives in the landlord's browser storage (back it up from the Properties page).
- **Amounts use at most 2 decimals** (min 0.01 NIM). We found that the Nimiq Pay confirmation sheet rounds to 2 decimals (a 0.005 NIM test showed as 0.01 NIM); keeping requests at 2 decimals means the sheet always shows the exact amount. Details: [docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md](docs/UPSTREAM_NIMIQ_PAY_AMOUNT_PRECISION.md).
- **Request links are not signed yet.** The tenant sees the address checksum and can compare it with the address the landlord gave them; wallet-signed requests are next.
- **One public history node** is used for confirmation. A second independent node is planned.
- RentRail confirms what happened on-chain. It does not issue legal rent receipts.
- NIM only for now; USDT (stable rent) is on the roadmap.

## Roadmap

Wallet-signed rent requests · USDT rent · second mainnet node · shared landlord/tenant view · monthly reminders.

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
