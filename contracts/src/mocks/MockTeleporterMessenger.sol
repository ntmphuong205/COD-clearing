// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    ITeleporterMessenger,
    ITeleporterReceiver,
    TeleporterMessageInput
} from "../interfaces/ITeleporter.sol";

/// Test and local only. On the source chain it records the message and emits an event;
/// a relayer script calls `deliver` on the hub chain's mock.
contract MockTeleporterMessenger is ITeleporterMessenger {
    uint256 public nonce;

    event MockMessageSent(
        bytes32 indexed destinationBlockchainID,
        address indexed destinationAddress,
        address sender,
        bytes message
    );

    function sendCrossChainMessage(TeleporterMessageInput calldata input) external returns (bytes32 id) {
        id = keccak256(abi.encode(block.chainid, msg.sender, ++nonce));
        emit MockMessageSent(input.destinationBlockchainID, input.destinationAddress, msg.sender, input.message);
    }

    function deliver(bytes32 sourceBlockchainID, address originSender, address destination, bytes calldata message)
        external
    {
        ITeleporterReceiver(destination).receiveTeleporterMessage(sourceBlockchainID, originSender, message);
    }
}
