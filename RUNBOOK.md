# RUNBOOK: manual Fuji steps

These steps are done by hand by the team. Nothing here can be scripted from the repo, and the Builder Console UI changes
often, so button names may differ slightly. Check anything marked **verify** against the current Avalanche docs.

LOCAL mode needs none of this. If Fuji is not stable by 17 Nov, record the demo in LOCAL mode and say so honestly.

## 0. What you end up with

```
Carrier A L1 ──ICM relayer──┐
                            ├──► Fuji C-Chain: SettlementHub + 2 CarrierEscrow (testnet USDC)
Carrier B L1 ──ICM relayer──┘
```
Messages only travel **L1 → C-Chain**, so the relayer submits transactions on C-Chain.

## 1. Wallets and faucets

1. Make four wallets: **deployer/admin**, **carrier A**, **carrier B**, **courier** (plus the **seller** address, which only receives USDC). Use throwaway testnet wallets only.
2. Get Fuji test AVAX from <https://faucet.avax.network> for deployer, carrier A, carrier B and the relayer wallet.
3. Get Fuji testnet USDC from <https://faucet.circle.com> (select Avalanche Fuji) for carrier A and carrier B. USDC address: `0x5425890298aed601595a70AB815c96711a31Bc65`.

## 2. Create each carrier L1 (do this twice)

In the Avalanche Builder Console (<https://build.avax.network/console>), create an L1:

- **Warp enabled** in the genesis, with a `blockTimestamp` in the past (for example `1700000000`). A future timestamp means Warp is not active yet.
- **TxAllowList** enabled with these addresses allowed to send transactions: the **admin/deployer**, the **Teleporter deployer address** (**verify** the current value in the ICM docs, it is the well-known address used by ICM Setup), and the **relayer** wallet. Add the **courier** wallet now or later (step 5).
- Note the **RPC URL**, **chain ID** and gas token. Give the deployer and carrier wallets gas on the L1 if gas is not free.

## 3. ICM Setup so TeleporterMessenger exists

Run **ICM Setup** (Teleporter) in the Console for each L1. It deploys `TeleporterMessenger` at the standard address.

Verify (it must print long hex, not `0x`), on each L1 and on C-Chain:

```bash
cast code 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf --rpc-url <RPC>
```

`pnpm deploy:fuji` repeats this check and refuses to run if the code is missing.

## 4. Run the ICM relayer

You need a relayer for each pair: **carrier A → C-Chain** and **carrier B → C-Chain**. Easiest: use the Console's ICM relayer tool for both pairs. Or run `icm-relayer` yourself (**verify** the config format against the current `icm-services` docs, field names change between versions):

- source blockchains: carrier A and carrier B (blockchain ID, subnet ID, RPC and WS endpoints, message contract `0x253b…5fcf`)
- destination blockchain: Fuji C-Chain, RPC `https://api.avax-test.network/ext/bc/C/rpc`
- the relayer's private key, funded with test AVAX on C-Chain (messages cost gas there)

Blockchain IDs printed by `pnpm deploy:fuji` come from each chain's Warp precompile. Use those same IDs in the relayer config.

## 5. Courier access

Add every courier wallet to each L1's **TxAllowList** (Console > the L1 > Precompiles/Allow list), and give it gas if the L1 charges fees.

## 6. Fill `.env` and deploy

```bash
cp .env.example .env      # then fill it in, see comments inside
pnpm deploy:fuji          # deploys hub + escrows on C-Chain, a ledger on each L1, registers carriers
                          # writes deployments/fuji.json
pnpm ping:fuji            # milestone: sends one message A -> hub, prints elapsed time. Try: pnpm ping:fuji B
pnpm seed:fuji            # 18 demo orders (courier taps "Picked up" in the app unless COURIER_KEY is set)
NEXT_PUBLIC_MODE=fuji pnpm --filter web dev
```

Then on `/carrier`, each carrier wallet deposits USDC into its escrow. `Close period` fails with
`EscrowUnderfunded` until the escrows hold enough: roughly (seller balance in VND) / 25,000 USDC.

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ping:fuji` times out, the message never arrives | Relayer not running, wrong pair, or relayer out of AVAX on C-Chain | Check relayer logs and balance. Re-send with the admin call `resendSettlement(seq)` on the ledger. The hub ignores duplicates, so it is safe. |
| Relayer logs a reverted or rejected tx on an L1 | The relayer address is not in that L1's TxAllowList | Add the relayer wallet to TxAllowList (step 2) |
| Transactions from the courier or deployer are rejected on the L1 | Wallet not in TxAllowList, or no gas | Add it (step 5) and fund it |
| `sendCrossChainMessage` reverts or Teleporter calls fail | Warp not enabled, or `blockTimestamp` is in the future | Check the L1 genesis: Warp config with a past timestamp. Recreate the L1 if needed. |
| `deploy:fuji` says TeleporterMessenger has no code | ICM Setup not run on that chain | Run ICM Setup (step 3), recheck with `cast code` |
| Message delivered but hub shows nothing and the relayer retries forever | Required gas too low: the hub's receive step runs out of gas | The ledger sets `requiredGasLimit` to 300,000. Raise `REQUIRED_GAS_LIMIT` in `DeliveryLedger.sol` and redeploy. |
| Hub reverts `UnknownCarrier` | Blockchain ID in `registerCarrier` differs from the real source | IDs come from the Warp precompile in `deploy:fuji`. Redeploy the hub, or register the right pair. |
| `Close period` reverts `EscrowUnderfunded` | A carrier escrow has too little USDC | Deposit more USDC from the carrier wallet on `/carrier` |
| Wallet will not switch network | The L1 is not in the wallet | The app calls `wallet_addEthereumChain` automatically. Approve the prompt, or add the RPC by hand. |
| `/seller` history is empty or slow on Fuji | Log scan range too wide for the RPC | Set `hubChain.fromBlock` in `deployments/fuji.json` (the deploy script does this) |
