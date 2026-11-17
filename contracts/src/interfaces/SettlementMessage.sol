// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

uint8 constant KIND_DELIVERED = 1;
uint8 constant KIND_RETURNED = 2;

/// ABI-encoded payload sent from a DeliveryLedger to the SettlementHub.
/// Contains no buyer personal data: orderKey is a hash of the carrier's order code.
struct SettlementMessage {
    uint8 kind; // 1 DELIVERED, 2 RETURNED
    uint64 seq; // per-ledger, starts at 1
    bytes32 orderKey;
    address seller;
    uint128 codVnd;
    uint128 feeVnd; // DELIVERED: shipping + COD fee; RETURNED: return fee
    uint64 occurredAt;
}
