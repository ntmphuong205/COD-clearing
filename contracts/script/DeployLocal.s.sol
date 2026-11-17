// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DeliveryLedger} from "../src/DeliveryLedger.sol";
import {SettlementHub} from "../src/SettlementHub.sol";
import {CarrierEscrow} from "../src/CarrierEscrow.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockTeleporterMessenger} from "../src/mocks/MockTeleporterMessenger.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporter.sol";

/// Deploys the whole demo onto three local Anvil chains and writes deployments/local.json.
/// Run via `pnpm demo:local` (anvils must be running), or: forge script script/DeployLocal.s.sol --broadcast
contract DeployLocal is Script {
    // Anvil default dev keys (public, local only).
    uint256 constant ADMIN_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80; // #0
    uint256 constant CARRIER_A_KEY = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a; // #2
    uint256 constant CARRIER_B_KEY = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6; // #3
    bytes32 constant HUB_ID = bytes32(uint256(31337));

    // Forks are created once: the script simulates first and broadcasts afterwards,
    // so re-creating a fork would lose the simulated state.
    uint256 hubFork;
    uint256[2] carrierFork;

    MockTeleporterMessenger hubMsgr;
    MockUSDC usdc;
    SettlementHub hub;
    address[2] escrow;
    address[2] msgr;
    address[2] ledger;

    function run() external {
        address admin = vm.addr(ADMIN_KEY);
        hubFork = vm.createFork("hub");
        carrierFork[0] = vm.createFork("carrierA");
        carrierFork[1] = vm.createFork("carrierB");

        vm.selectFork(hubFork);
        vm.startBroadcast(ADMIN_KEY);
        hubMsgr = new MockTeleporterMessenger();
        usdc = new MockUSDC();
        hub = new SettlementHub(address(hubMsgr), admin);
        escrow[0] = address(new CarrierEscrow(usdc, address(hub), vm.addr(CARRIER_A_KEY)));
        escrow[1] = address(new CarrierEscrow(usdc, address(hub), vm.addr(CARRIER_B_KEY)));
        usdc.mint(vm.addr(CARRIER_A_KEY), 10_000e6);
        usdc.mint(vm.addr(CARRIER_B_KEY), 10_000e6);
        vm.stopBroadcast();

        _fund(CARRIER_A_KEY, escrow[0]);
        _fund(CARRIER_B_KEY, escrow[1]);

        for (uint256 i = 0; i < 2; i++) {
            vm.selectFork(carrierFork[i]);
            vm.startBroadcast(ADMIN_KEY);
            MockTeleporterMessenger m = new MockTeleporterMessenger();
            msgr[i] = address(m);
            ledger[i] = address(new DeliveryLedger(ITeleporterMessenger(msgr[i]), HUB_ID, address(hub), admin));
            vm.stopBroadcast();
        }

        vm.selectFork(hubFork);
        vm.startBroadcast(ADMIN_KEY);
        hub.registerCarrier(bytes32(uint256(20261)), ledger[0], escrow[0], "Carrier A");
        hub.registerCarrier(bytes32(uint256(20262)), ledger[1], escrow[1], "Carrier B");
        vm.stopBroadcast();

        _write();
        console.log("wrote deployments/local.json");
    }

    function _fund(uint256 key, address esc) internal {
        vm.startBroadcast(key);
        usdc.approve(esc, type(uint256).max);
        CarrierEscrow(esc).deposit(5_000e6);
        vm.stopBroadcast();
    }

    function _write() internal {
        string memory h = "hub";
        vm.serializeString(h, "rpc", "http://127.0.0.1:8545");
        vm.serializeUint(h, "chainId", 31337);
        vm.serializeBytes32(h, "blockchainId", HUB_ID);
        vm.serializeAddress(h, "messenger", address(hubMsgr));
        vm.serializeAddress(h, "usdc", address(usdc));
        string memory hubJson = vm.serializeAddress(h, "hub", address(hub));

        string memory root = "root";
        vm.serializeString(root, "mode", "local");
        vm.serializeString(root, "explorer", "");
        vm.serializeString(root, "hubChain", hubJson);
        vm.serializeString(root, "carrierA", _carrierJson("a", "Carrier A", "http://127.0.0.1:8546", 20261, 0));
        string memory out = vm.serializeString(root, "carrierB", _carrierJson("b", "Carrier B", "http://127.0.0.1:8547", 20262, 1));
        vm.writeJson(out, "../deployments/local.json");
    }

    function _carrierJson(string memory k, string memory name, string memory rpc, uint256 chainId, uint256 i)
        internal
        returns (string memory)
    {
        vm.serializeString(k, "name", name);
        vm.serializeString(k, "rpc", rpc);
        vm.serializeUint(k, "chainId", chainId);
        vm.serializeBytes32(k, "blockchainId", bytes32(chainId));
        vm.serializeAddress(k, "messenger", msgr[i]);
        vm.serializeAddress(k, "ledger", ledger[i]);
        vm.serializeAddress(k, "escrow", escrow[i]);
        return vm.serializeUint(k, "carrierId", i + 1);
    }
}
