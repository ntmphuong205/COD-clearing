import { parseAbi } from "viem";

export const ledgerAbi = parseAbi([
  "function ordersOfCourier(address) view returns (bytes32[])",
  "function getOrder(bytes32) view returns ((address seller, address courier, uint8 status, uint128 codVnd, uint128 shippingFeeVnd, uint128 codFeeVnd, uint128 returnFeeVnd))",
  "function markPickedUp(bytes32)",
  "function markDelivered(bytes32)",
  "function markReturned(bytes32)",
  "event SettlementSent(uint64 indexed seq, bytes32 indexed orderKey, uint8 kind, bytes32 messageId)",
]);

export const hubAbi = parseAbi([
  "function currentEpoch() view returns (uint256)",
  "function disputeWindow() view returns (uint256)",
  "function vndPerUsdc() view returns (uint256)",
  "function getCarriers() view returns ((bytes32 sourceBlockchainID, address ledger, address escrow, string name)[])",
  "function balancesOf(address) view returns (int256[])",
  "function payoutsOf(uint256, address) view returns (uint256[] vnd, uint256[] usdc, bool isClaimed)",
  "function epochInfo(uint256) view returns (uint256 closed, uint256 claimable, uint256 rate)",
  "function processed(uint256, uint64) view returns (bool)",
  "function closeEpoch()",
  "function claim(uint256)",
  "event SettlementRecorded(uint256 indexed carrierId, address indexed seller, uint64 seq, bytes32 orderKey, uint8 kind, int256 deltaVnd, int256 newBalance)",
]);

export const escrowAbi = parseAbi([
  "function balance() view returns (uint256)",
  "function committed() view returns (uint256)",
  "function available() view returns (uint256)",
  "function deposit(uint256)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
]);
