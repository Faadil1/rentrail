# Run, test in Nimiq Pay, deploy

## Local

```bash
npm ci
npm test
npm run dev   # http://<your-LAN-IP>:5173
```

Nimiq Pay needs an HTTPS URL, so test the wallet flow on a deployed build.

## Deploy (Vercel)

1. Vercel → **Add New → Project → Import** `Faadil1/rentrail`.
2. Framework preset: Vite. Settings come from `vercel.json` (`npm ci`, tests then build, output `dist`). No environment variables are needed.
3. Production branch: `main`. Give the project a clean name (for example `rentrail`) so the URL is `https://rentrail.vercel.app`, or add your own domain.
4. Make sure **Deployment Protection** is off for production, so judges can open it without a Vercel login.

## Test inside Nimiq Pay (mainnet, two wallets)

1. Nimiq Pay → Mini Apps → add the production URL.
2. Landlord side: add a property, a unit, then a rent request of **0.01 NIM** to wallet B's address.
3. Tap **Send link**, open the link in Nimiq Pay with wallet A (the payer).
4. Tap **Pay 0.01 NIM with Nimiq Pay**, check the native sheet (amount, recipient), approve.
5. Wait for **Paid ✓ confirmed on-chain** (about a minute), then **Send proof to my landlord**.
6. Open the proof link on the landlord device: "Recorded in your ledger" and the request shows **Paid ✓ on-chain**.

Also check: cancelling in the native sheet returns to the Pay button with "Payment cancelled"; reopening the request link after paying shows the payment status instead of a second Pay button.
