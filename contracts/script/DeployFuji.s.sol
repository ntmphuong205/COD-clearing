// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DeliveryLedger} from "../src/DeliveryLedger.sol";
import {SettlementHub} from "../src/SettlementHub.sol";
import {CarrierEscrow} from "../src/CarrierEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITeleporterMessenger} from "../src/interfaces/ITeleporter.sol";

/// Deploys the hub + escrows on Fuji C-Chain and a DeliveryLedger on each carrier L1,
/// registers the carriers and writes deployments/fuji.json.
/// Run via scripts/deploy-fuji.sh (it reads .env and the blockchain IDs). See RUNBOOK.md.
contract DeployFuji is Script {
    address constant TELEPORTER = 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf;
    address constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    uint256 deployerKey;
    uint256 hubFork;
    uint256[2] carrierFork;
    bytes32 hubId;
    bytes32[2] carrierId;
    SettlementHub hub;
    address[2] escrow;
    address[2] ledger;
    uint256 hubStartBlock;

    function run() external {
        deployerKey = vm.envUint("DEPLOYER_KEY");
        address admin = vm.addr(deployerKey);
        hubId = vm.envBytes32("HUB_BLOCKCHAIN_ID");
        carrierId[0] = vm.envBytes32("CARRIER_A_BLOCKCHAIN_ID");
        carrierId[1] = vm.envBytes32("CARRIER_B_BLOCKCHAIN_ID");
        address[2] memory owner = [vm.envAddress("CARRIER_A_ADDRESS"), vm.envAddress("CARRIER_B_ADDRESS")];

        // Forks are created once: the script simulates first and broadcasts afterwards.
        hubFork = vm.createFork(vm.envString("FUJI_RPC"));
        carrierFork[0] = vm.createFork(vm.envString("CARRIER_A_RPC"));
        carrierFork[1] = vm.createFork(vm.envString("CARRIER_B_RPC"));

        vm.selectFork(hubFork);
        hubStartBlock = block.number;
        vm.startBroadcast(deployerKey);
        hub = new SettlementHub(vm.envOr("TELEPORTER_ADDRESS", TELEPORTER), admin);
        IERC20 usdc = IERC20(vm.envOr("USDC_ADDRESS", FUJI_USDC));
        escrow[0] = address(new CarrierEscrow(usdc, address(hub), owner[0]));
        escrow[1] = address(new CarrierEscrow(usdc, address(hub), owner[1]));
        vm.stopBroadcast();

        for (uint256 i = 0; i < 2; i++) {
            vm.selectFork(carrierFork[i]);
            vm.startBroadcast(deployerKey);
            ledger[i] = address(
                new DeliveryLedger(
                    ITeleporterMessenger(vm.envOr("TELEPORTER_ADDRESS", TELEPORTER)), hubId, address(hub), admin
                )
            );
            vm.stopBroadcast();
        }

        vm.selectFork(hubFork);
        vm.startBroadcast(deployerKey);
        hub.registerCarrier(carrierId[0], ledger[0], escrow[0], vm.envOr("CARRIER_A_NAME", string("Carrier A")));
        hub.registerCarrier(carrierId[1], ledger[1], escrow[1], vm.envOr("CARRIER_B_NAME", string("Carrier B")));
        vm.stopBroadcast();

        _write();
        console.log("hub", address(hub));
    }

    function _write() internal {
        string memory h = "hub";
        vm.serializeString(h, "rpc", vm.envString("FUJI_RPC"));
        vm.serializeUint(h, "chainId", vm.envOr("FUJI_CHAIN_ID", uint256(43113)));
        vm.serializeBytes32(h, "blockchainId", hubId);
        vm.serializeAddress(h, "messenger", vm.envOr("TELEPORTER_ADDRESS", TELEPORTER));
        vm.serializeAddress(h, "usdc", vm.envOr("USDC_ADDRESS", FUJI_USDC));
        vm.serializeUint(h, "fromBlock", hubStartBlock);
        string memory hubJson = vm.serializeAddress(h, "hub", address(hub));

        string memory root = "root";
        vm.serializeString(root, "mode", "fuji");
        vm.serializeString(root, "explorer", vm.envOr("EXPLORER_URL", string("https://testnet.snowtrace.io")));
        vm.serializeString(root, "hubChain", hubJson);
        vm.serializeString(root, "carrierA", _carrier("a", "CARRIER_A", "Carrier A", 0, 1));
        string memory out = vm.serializeString(root, "carrierB", _carrier("b", "CARRIER_B", "Carrier B", 1, 2));
        vm.writeJson(out, string.concat("../deployments/", vm.envOr("DEPLOYMENT_FILE", string("fuji.json"))));
    }

    function _carrier(string memory k, string memory p, string memory dflt, uint256 i, uint256 id)
        internal
        returns (string memory)
    {
        vm.serializeString(k, "name", vm.envOr(string.concat(p, "_NAME"), dflt));
        vm.serializeString(k, "rpc", vm.envString(string.concat(p, "_RPC")));
        vm.serializeUint(k, "chainId", vm.envUint(string.concat(p, "_CHAIN_ID")));
        vm.serializeBytes32(k, "blockchainId", carrierId[i]);
        vm.serializeAddress(k, "messenger", vm.envOr("TELEPORTER_ADDRESS", TELEPORTER));
        vm.serializeAddress(k, "ledger", ledger[i]);
        vm.serializeAddress(k, "escrow", escrow[i]);
        return vm.serializeUint(k, "carrierId", id);
    }
}
