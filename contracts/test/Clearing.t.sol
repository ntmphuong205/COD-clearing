// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeliveryLedger} from "../src/DeliveryLedger.sol";
import {SettlementHub} from "../src/SettlementHub.sol";
import {CarrierEscrow} from "../src/CarrierEscrow.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockTeleporterMessenger} from "../src/mocks/MockTeleporterMessenger.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporter.sol";
import {SettlementMessage} from "../src/interfaces/SettlementMessage.sol";

contract ClearingTest is Test {
    bytes32 constant HUB_CHAIN = bytes32(uint256(31337));
    bytes32 constant CHAIN_A = bytes32(uint256(20261));
    bytes32 constant CHAIN_B = bytes32(uint256(20262));

    address admin = makeAddr("admin");
    address carrierA = makeAddr("carrierA");
    address carrierB = makeAddr("carrierB");
    address courier = makeAddr("courier");
    address courier2 = makeAddr("courier2");
    address seller = makeAddr("seller");

    MockUSDC usdc;
    MockTeleporterMessenger hubMessenger; // hub-chain mock
    MockTeleporterMessenger msgA; // carrier A chain mock
    SettlementHub hub;
    CarrierEscrow escrowA;
    CarrierEscrow escrowB;
    DeliveryLedger ledgerA;
    DeliveryLedger ledgerB;

    function setUp() public {
        usdc = new MockUSDC();
        hubMessenger = new MockTeleporterMessenger();
        msgA = new MockTeleporterMessenger();
        hub = new SettlementHub(address(hubMessenger), admin);
        escrowA = new CarrierEscrow(usdc, address(hub), carrierA);
        escrowB = new CarrierEscrow(usdc, address(hub), carrierB);
        // In tests both ledgers can share a messenger mock; delivery is manual.
        ledgerA = new DeliveryLedger(ITeleporterMessenger(address(msgA)), HUB_CHAIN, address(hub), admin);
        ledgerB = new DeliveryLedger(ITeleporterMessenger(address(msgA)), HUB_CHAIN, address(hub), admin);

        vm.startPrank(admin);
        hub.registerCarrier(CHAIN_A, address(ledgerA), address(escrowA), "Carrier A");
        hub.registerCarrier(CHAIN_B, address(ledgerB), address(escrowB), "Carrier B");
        vm.stopPrank();

        usdc.mint(carrierA, 1_000e6);
        usdc.mint(carrierB, 1_000e6);
        vm.startPrank(carrierA);
        usdc.approve(address(escrowA), type(uint256).max);
        escrowA.deposit(500e6);
        vm.stopPrank();
        vm.startPrank(carrierB);
        usdc.approve(address(escrowB), type(uint256).max);
        escrowB.deposit(500e6);
        vm.stopPrank();
    }

    // ------------------------------------------------------------- helpers

    function _order(bytes32 key, address c) internal view returns (DeliveryLedger.OrderInput memory) {
        return DeliveryLedger.OrderInput({
            orderKey: key,
            seller: seller,
            codVnd: 1_000_000,
            shippingFeeVnd: 25_000,
            codFeeVnd: 10_000,
            returnFeeVnd: 15_000,
            courier: c
        });
    }

    function _create(DeliveryLedger l, bytes32 key, address c) internal {
        DeliveryLedger.OrderInput[] memory arr = new DeliveryLedger.OrderInput[](1);
        arr[0] = _order(key, c);
        vm.prank(admin);
        l.createOrders(arr);
    }

    function _payload(DeliveryLedger l, uint64 seq) internal view returns (bytes memory) {
        return l.sentPayload(seq);
    }

    function _deliverMsg(bytes32 chain, DeliveryLedger l, uint64 seq) internal {
        hubMessenger.deliver(chain, address(l), address(hub), _payload(l, seq));
    }

    /// create + pick up + deliver on ledger, then relay to hub.
    function _fullDelivery(DeliveryLedger l, bytes32 chain, bytes32 key) internal returns (uint64 seq) {
        _create(l, key, courier);
        vm.startPrank(courier);
        l.markPickedUp(key);
        l.markDelivered(key);
        vm.stopPrank();
        seq = l.lastSeq();
        _deliverMsg(chain, l, seq);
    }

    function _balanceA() internal view returns (int256) {
        return hub.balanceVnd(1, seller);
    }

    // --------------------------------------------------------------- tests

    function test_HappyPath_delivered_close_claim() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("GHA-1"));
        assertEq(_balanceA(), 965_000);

        vm.prank(admin);
        hub.closeEpoch();
        assertEq(_balanceA(), 0);
        assertEq(hub.currentEpoch(), 2);
        assertEq(escrowA.committed(), 965_000e6 / 25_000);

        vm.warp(block.timestamp + 61);
        vm.prank(seller);
        hub.claim(1);
        assertEq(usdc.balanceOf(seller), 38_600_000); // 38.6 USDC
        assertEq(escrowA.committed(), 0);
    }

    function test_Returned_deductsFee() public {
        bytes32 key = keccak256("GHA-R");
        _create(ledgerA, key, courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(key);
        ledgerA.markReturned(key);
        vm.stopPrank();
        _deliverMsg(CHAIN_A, ledgerA, 1);
        assertEq(_balanceA(), -15_000);
    }

    function test_NegativeBalance_carriesOver() public {
        bytes32 key = keccak256("GHA-R");
        _create(ledgerA, key, courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(key);
        ledgerA.markReturned(key);
        vm.stopPrank();
        _deliverMsg(CHAIN_A, ledgerA, 1);

        vm.prank(admin);
        hub.closeEpoch();
        assertEq(_balanceA(), -15_000, "negative stays");
        assertEq(escrowA.committed(), 0);

        // next delivery nets against the carried deficit
        bytes32 key2 = keccak256("GHA-2");
        _create(ledgerA, key2, courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(key2);
        ledgerA.markDelivered(key2);
        vm.stopPrank();
        _deliverMsg(CHAIN_A, ledgerA, 2);
        assertEq(_balanceA(), 965_000 - 15_000);
    }

    function test_DuplicateSeq_ignored() public {
        uint64 seq = _fullDelivery(ledgerA, CHAIN_A, keccak256("GHA-1"));
        vm.expectEmit(true, false, false, true);
        emit SettlementHub.DuplicateIgnored(1, seq);
        _deliverMsg(CHAIN_A, ledgerA, seq);
        assertEq(_balanceA(), 965_000);
    }

    function test_ResendSettlement_isIgnoredAsDuplicate() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("GHA-1"));
        vm.prank(admin);
        ledgerA.resendSettlement(1);
        _deliverMsg(CHAIN_A, ledgerA, 1);
        assertEq(_balanceA(), 965_000);
    }

    function test_UnknownSourceChain_rejected() public {
        _create(ledgerA, keccak256("x"), courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(keccak256("x"));
        ledgerA.markDelivered(keccak256("x"));
        vm.stopPrank();
        bytes memory p = _payload(ledgerA, 1);
        vm.expectRevert();
        hubMessenger.deliver(bytes32(uint256(999)), address(ledgerA), address(hub), p);
    }

    function test_UnknownSender_rejected() public {
        _create(ledgerA, keccak256("x"), courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(keccak256("x"));
        ledgerA.markDelivered(keccak256("x"));
        vm.stopPrank();
        bytes memory p = _payload(ledgerA, 1);
        vm.expectRevert();
        hubMessenger.deliver(CHAIN_A, makeAddr("rogue"), address(hub), p);
    }

    function test_NonMessengerCaller_rejected() public {
        _create(ledgerA, keccak256("x"), courier);
        vm.startPrank(courier);
        ledgerA.markPickedUp(keccak256("x"));
        ledgerA.markDelivered(keccak256("x"));
        vm.stopPrank();
        bytes memory p = _payload(ledgerA, 1);
        vm.expectRevert(SettlementHub.NotMessenger.selector);
        hub.receiveTeleporterMessage(CHAIN_A, address(ledgerA), p);
    }

    function test_ClaimBeforeWindow_reverts() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("GHA-1"));
        vm.prank(admin);
        hub.closeEpoch();
        vm.prank(seller);
        vm.expectRevert();
        hub.claim(1);
    }

    function test_ClaimUnclosedEpoch_reverts() public {
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(SettlementHub.EpochNotClosed.selector, 1));
        hub.claim(1);
    }

    function test_DoubleClaim_reverts() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("GHA-1"));
        vm.prank(admin);
        hub.closeEpoch();
        vm.warp(block.timestamp + 61);
        vm.startPrank(seller);
        hub.claim(1);
        vm.expectRevert(SettlementHub.AlreadyClaimed.selector);
        hub.claim(1);
        vm.stopPrank();
    }

    function test_TwoCarriers_oneClaim() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("A1"));
        _fullDelivery(ledgerB, CHAIN_B, keccak256("B1"));
        vm.prank(admin);
        hub.closeEpoch();
        vm.warp(block.timestamp + 61);
        vm.prank(seller);
        hub.claim(1);
        assertEq(usdc.balanceOf(seller), 2 * 38_600_000);
    }

    function test_EscrowCommit_failsWhenUnderfunded() public {
        // 500 USDC funded = 12.5M VND. Deliver 14 orders * 965k = 13.51M VND.
        for (uint256 i = 0; i < 14; i++) {
            _fullDelivery(ledgerA, CHAIN_A, keccak256(abi.encode("o", i)));
        }
        vm.prank(admin);
        vm.expectRevert(); // EscrowUnderfunded
        hub.closeEpoch();
        assertEq(hub.currentEpoch(), 1, "epoch not advanced");
    }

    function test_Escrow_commitOnlyHub_andWithdrawBounds() public {
        vm.expectRevert(CarrierEscrow.NotHub.selector);
        escrowA.commit(1);
        vm.expectRevert(CarrierEscrow.NotHub.selector);
        escrowA.payout(seller, 1);
        vm.prank(carrierA);
        vm.expectRevert();
        escrowA.withdraw(501e6);
        vm.prank(carrierA);
        escrowA.withdraw(500e6);
        vm.prank(seller);
        vm.expectRevert();
        escrowA.withdraw(0);
    }

    function test_Courier_cannotMarkOthersOrder() public {
        bytes32 key = keccak256("GHA-1");
        _create(ledgerA, key, courier);
        _create(ledgerA, keccak256("other"), courier2); // gives courier2 the role
        vm.prank(courier2);
        vm.expectRevert(DeliveryLedger.NotAssignedCourier.selector);
        ledgerA.markPickedUp(key);
        vm.prank(seller);
        vm.expectRevert(); // no COURIER role at all
        ledgerA.markPickedUp(key);
    }

    function test_InvalidTransitions_revert() public {
        bytes32 key = keccak256("GHA-1");
        _create(ledgerA, key, courier);
        vm.startPrank(courier);
        vm.expectRevert(); // Created -> Delivered
        ledgerA.markDelivered(key);
        vm.expectRevert(); // Created -> Returned
        ledgerA.markReturned(key);
        ledgerA.markPickedUp(key);
        vm.expectRevert(); // PickedUp twice
        ledgerA.markPickedUp(key);
        ledgerA.markDelivered(key);
        vm.expectRevert(); // Delivered -> Returned
        ledgerA.markReturned(key);
        vm.expectRevert(); // Delivered twice
        ledgerA.markDelivered(key);
        vm.expectRevert(); // unknown order
        ledgerA.markPickedUp(keccak256("nope"));
        vm.stopPrank();
    }

    function test_CreateOrder_duplicateReverts() public {
        _create(ledgerA, keccak256("a"), courier);
        DeliveryLedger.OrderInput[] memory arr = new DeliveryLedger.OrderInput[](1);
        arr[0] = _order(keccak256("a"), courier);
        vm.prank(admin);
        vm.expectRevert();
        ledgerA.createOrders(arr);
    }

    function test_SeqIncrementsFromOne() public {
        _fullDelivery(ledgerA, CHAIN_A, keccak256("a"));
        _fullDelivery(ledgerA, CHAIN_A, keccak256("b"));
        SettlementMessage memory m = abi.decode(ledgerA.sentPayload(2), (SettlementMessage));
        assertEq(m.seq, 2);
        assertEq(m.feeVnd, 35_000);
    }

    // ---------------------------------------------------------------- fuzz

    /// Total USDC paid out never exceeds total committed (and commits never exceed funding).
    function testFuzz_payoutNeverExceedsCommitted(uint8 nDelivered, uint8 nReturned, uint32 rate) public {
        nDelivered = uint8(bound(nDelivered, 0, 12));
        nReturned = uint8(bound(nReturned, 0, 12));
        rate = uint32(bound(rate, 1_000, 100_000));
        vm.prank(admin);
        hub.setVndPerUsdc(rate);

        uint64 sent;
        for (uint256 i = 0; i < nDelivered; i++) {
            bytes32 key = keccak256(abi.encode("d", i));
            _create(ledgerA, key, courier);
            vm.startPrank(courier);
            ledgerA.markPickedUp(key);
            ledgerA.markDelivered(key);
            vm.stopPrank();
            _deliverMsg(CHAIN_A, ledgerA, ++sent);
        }
        for (uint256 i = 0; i < nReturned; i++) {
            bytes32 key = keccak256(abi.encode("r", i));
            _create(ledgerA, key, courier);
            vm.startPrank(courier);
            ledgerA.markPickedUp(key);
            ledgerA.markReturned(key);
            vm.stopPrank();
            _deliverMsg(CHAIN_A, ledgerA, ++sent);
        }

        usdc.mint(carrierA, 100_000e6);
        vm.startPrank(carrierA);
        usdc.approve(address(escrowA), type(uint256).max);
        escrowA.deposit(100_000e6);
        vm.stopPrank();

        vm.prank(admin);
        hub.closeEpoch();
        uint256 committedBefore = escrowA.committed();
        uint256 escrowBefore = escrowA.balance();

        vm.warp(block.timestamp + 61);
        vm.prank(seller);
        try hub.claim(1) {} catch {}

        uint256 paid = usdc.balanceOf(seller);
        assertLe(paid, committedBefore);
        assertEq(escrowBefore - escrowA.balance(), paid);
        assertEq(escrowA.committed(), committedBefore - paid);
    }
}
