// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo} from "./interfaces/ITeleporter.sol";
import {SettlementMessage, KIND_DELIVERED, KIND_RETURNED} from "./interfaces/SettlementMessage.sol";

/// Lives on a carrier's own L1. Records order status and tells the hub when COD is settled.
contract DeliveryLedger is AccessControl {
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant COURIER = keccak256("COURIER");

    uint256 public constant REQUIRED_GAS_LIMIT = 300_000;

    enum Status {
        None,
        Created,
        PickedUp,
        Delivered,
        Returned
    }

    struct OrderInput {
        bytes32 orderKey;
        address seller;
        uint128 codVnd;
        uint128 shippingFeeVnd;
        uint128 codFeeVnd;
        uint128 returnFeeVnd;
        address courier;
    }

    struct Order {
        address seller;
        address courier;
        Status status;
        uint128 codVnd;
        uint128 shippingFeeVnd;
        uint128 codFeeVnd;
        uint128 returnFeeVnd;
    }

    ITeleporterMessenger public immutable messenger;
    bytes32 public immutable hubBlockchainID;
    address public immutable hub;

    uint64 public lastSeq;
    mapping(bytes32 => Order) private _orders;
    mapping(address => bytes32[]) private _courierOrders;
    mapping(uint64 => bytes) public sentPayload;

    error OrderExists(bytes32 orderKey);
    error UnknownOrder(bytes32 orderKey);
    error NotAssignedCourier();
    error InvalidTransition(Status from, Status to);
    error UnknownSeq(uint64 seq);

    event OrderCreated(bytes32 indexed orderKey, address indexed seller, address indexed courier, uint128 codVnd);
    event StatusChanged(bytes32 indexed orderKey, Status status, address by);
    event SettlementSent(uint64 indexed seq, bytes32 indexed orderKey, uint8 kind, bytes32 messageId);

    constructor(ITeleporterMessenger messenger_, bytes32 hubBlockchainID_, address hub_, address admin) {
        messenger = messenger_;
        hubBlockchainID = hubBlockchainID_;
        hub = hub_;
        _setRoleAdmin(ADMIN, ADMIN);
        _setRoleAdmin(COURIER, ADMIN);
        _grantRole(ADMIN, admin);
    }

    // ---------------------------------------------------------------- admin

    function createOrders(OrderInput[] calldata inputs) external onlyRole(ADMIN) {
        for (uint256 i = 0; i < inputs.length; i++) {
            OrderInput calldata o = inputs[i];
            if (_orders[o.orderKey].status != Status.None) revert OrderExists(o.orderKey);
            _orders[o.orderKey] = Order({
                seller: o.seller,
                courier: o.courier,
                status: Status.Created,
                codVnd: o.codVnd,
                shippingFeeVnd: o.shippingFeeVnd,
                codFeeVnd: o.codFeeVnd,
                returnFeeVnd: o.returnFeeVnd
            });
            _courierOrders[o.courier].push(o.orderKey);
            if (!hasRole(COURIER, o.courier)) _grantRole(COURIER, o.courier);
            emit OrderCreated(o.orderKey, o.seller, o.courier, o.codVnd);
        }
    }

    /// Re-send a stored payload, e.g. when the relayer was down. The hub ignores duplicates.
    function resendSettlement(uint64 seq) external onlyRole(ADMIN) {
        bytes memory payload = sentPayload[seq];
        if (payload.length == 0) revert UnknownSeq(seq);
        SettlementMessage memory m = abi.decode(payload, (SettlementMessage));
        bytes32 id = _send(payload);
        emit SettlementSent(seq, m.orderKey, m.kind, id);
    }

    // -------------------------------------------------------------- courier

    function markPickedUp(bytes32 orderKey) external onlyRole(COURIER) {
        Order storage o = _loadFor(orderKey);
        if (o.status != Status.Created) revert InvalidTransition(o.status, Status.PickedUp);
        o.status = Status.PickedUp;
        emit StatusChanged(orderKey, Status.PickedUp, msg.sender);
    }

    function markDelivered(bytes32 orderKey) external onlyRole(COURIER) {
        Order storage o = _loadFor(orderKey);
        if (o.status != Status.PickedUp) revert InvalidTransition(o.status, Status.Delivered);
        o.status = Status.Delivered;
        emit StatusChanged(orderKey, Status.Delivered, msg.sender);
        _settle(KIND_DELIVERED, orderKey, o, o.shippingFeeVnd + o.codFeeVnd);
    }

    function markReturned(bytes32 orderKey) external onlyRole(COURIER) {
        Order storage o = _loadFor(orderKey);
        if (o.status != Status.PickedUp) revert InvalidTransition(o.status, Status.Returned);
        o.status = Status.Returned;
        emit StatusChanged(orderKey, Status.Returned, msg.sender);
        _settle(KIND_RETURNED, orderKey, o, o.returnFeeVnd);
    }

    // ---------------------------------------------------------------- views

    function getOrder(bytes32 orderKey) external view returns (Order memory) {
        return _orders[orderKey];
    }

    function ordersOfCourier(address courier) external view returns (bytes32[] memory) {
        return _courierOrders[courier];
    }

    // ------------------------------------------------------------- internal

    function _loadFor(bytes32 orderKey) internal view returns (Order storage o) {
        o = _orders[orderKey];
        if (o.status == Status.None) revert UnknownOrder(orderKey);
        if (o.courier != msg.sender) revert NotAssignedCourier();
    }

    function _settle(uint8 kind, bytes32 orderKey, Order storage o, uint128 fee) internal {
        uint64 seq = ++lastSeq;
        bytes memory payload = abi.encode(
            SettlementMessage({
                kind: kind,
                seq: seq,
                orderKey: orderKey,
                seller: o.seller,
                codVnd: o.codVnd,
                feeVnd: fee,
                occurredAt: uint64(block.timestamp)
            })
        );
        sentPayload[seq] = payload;
        bytes32 id = _send(payload);
        emit SettlementSent(seq, orderKey, kind, id);
    }

    function _send(bytes memory payload) internal returns (bytes32) {
        return messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: hubBlockchainID,
                destinationAddress: hub,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: REQUIRED_GAS_LIMIT,
                allowedRelayerAddresses: new address[](0),
                message: payload
            })
        );
    }
}
