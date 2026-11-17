// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICarrierEscrow {
    function commit(uint256 amount) external;
    function payout(address seller, uint256 amount) external;
    function available() external view returns (uint256);
}
