#!/usr/bin/env bash
# Deploy to Fuji + the carrier L1s. Reads .env, fills in blockchain IDs from each chain's Warp precompile.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "missing .env (copy .env.example)"; exit 1; }
set -a; . ./.env; set +a

WARP=0x0200000000000000000000000000000000000005
chain_id_of() { cast call $WARP "getBlockchainID()(bytes32)" --rpc-url "$1"; }
: "${HUB_BLOCKCHAIN_ID:=$(chain_id_of "$FUJI_RPC")}"
: "${CARRIER_A_BLOCKCHAIN_ID:=$(chain_id_of "$CARRIER_A_RPC")}"
: "${CARRIER_B_BLOCKCHAIN_ID:=$(chain_id_of "$CARRIER_B_RPC")}"
export HUB_BLOCKCHAIN_ID CARRIER_A_BLOCKCHAIN_ID CARRIER_B_BLOCKCHAIN_ID
export CARRIER_A_CHAIN_ID="${CARRIER_A_CHAIN_ID:-$(cast chain-id --rpc-url "$CARRIER_A_RPC")}"
export CARRIER_B_CHAIN_ID="${CARRIER_B_CHAIN_ID:-$(cast chain-id --rpc-url "$CARRIER_B_RPC")}"

# Teleporter must exist on all three chains, or messages can never be sent.
for rpc in "$FUJI_RPC" "$CARRIER_A_RPC" "$CARRIER_B_RPC"; do
  code=$(cast code "${TELEPORTER_ADDRESS:-0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf}" --rpc-url "$rpc")
  [ "$code" != "0x" ] || { echo "TeleporterMessenger has no code on $rpc. Run ICM Setup (RUNBOOK step 3)."; exit 1; }
done
echo "hub=$HUB_BLOCKCHAIN_ID  A=$CARRIER_A_BLOCKCHAIN_ID  B=$CARRIER_B_BLOCKCHAIN_ID"

cd contracts
forge script script/DeployFuji.s.sol --broadcast --slow "$@"
echo "wrote deployments/${DEPLOYMENT_FILE:-fuji.json}"
