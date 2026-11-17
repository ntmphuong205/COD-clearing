#!/usr/bin/env bash
# CLI end-to-end against a running `pnpm demo:local`: deliver, return, close, claim.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
D=deployments/local.json; S=deployments/seed-local.json
j() { jq -r "$1" "$2"; }
HUB=$(j .hubChain.hub $D); USDC=$(j .hubChain.usdc $D); SELLER=$(j .seller $S)
LA=$(j .carrierA.ledger $D); LB=$(j .carrierB.ledger $D)
COURIER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ADMIN_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SELLER_KEY=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
H=http://127.0.0.1:8545; A=http://127.0.0.1:8546; B=http://127.0.0.1:8547
bal() { cast call $HUB "balanceVnd(uint256,address)(int256)" $1 $SELLER --rpc-url $H | awk '{print $1}'; }

K_A_DELIVER=$(j '.carrierA[0].orderKey' $S); K_A_RETURN=$(j '.carrierA[3].orderKey' $S)
K_B_DELIVER=$(j '.carrierB[0].orderKey' $S)
echo "balances before  A=$(bal 1) B=$(bal 2)"
cast send $LA "markDelivered(bytes32)" $K_A_DELIVER --private-key $COURIER_KEY --rpc-url $A >/dev/null
cast send $LB "markDelivered(bytes32)" $K_B_DELIVER --private-key $COURIER_KEY --rpc-url $B >/dev/null
cast send $LA "markReturned(bytes32)"  $K_A_RETURN  --private-key $COURIER_KEY --rpc-url $A >/dev/null
sleep 3
echo "balances after   A=$(bal 1) B=$(bal 2)"
cast send $HUB "closeEpoch()" --private-key $ADMIN_KEY --rpc-url $H >/dev/null
echo "epoch closed; waiting 62s dispute window"; sleep 62
echo "seller USDC before: $(cast call $USDC 'balanceOf(address)(uint256)' $SELLER --rpc-url $H)"
cast send $HUB "claim(uint256)" 1 --private-key $SELLER_KEY --rpc-url $H >/dev/null
echo "seller USDC after:  $(cast call $USDC 'balanceOf(address)(uint256)' $SELLER --rpc-url $H)"
