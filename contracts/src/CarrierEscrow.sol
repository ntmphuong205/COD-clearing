// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Holds pre-funded USDC for one carrier. Only the hub can commit and pay out.
contract CarrierEscrow is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable hub;
    uint256 public committed;

    error NotHub();
    error InsufficientAvailable(uint256 available, uint256 requested);
    error CommittedTooLow();

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Committed(uint256 amount, uint256 totalCommitted);
    event PaidOut(address indexed seller, uint256 amount);

    modifier onlyHub() {
        if (msg.sender != hub) revert NotHub();
        _;
    }

    constructor(IERC20 usdc_, address hub_, address owner_) Ownable(owner_) {
        usdc = usdc_;
        hub = hub_;
    }

    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function available() public view returns (uint256) {
        return balance() - committed;
    }

    function deposit(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        uint256 avail = available();
        if (amount > avail) revert InsufficientAvailable(avail, amount);
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function commit(uint256 amount) external onlyHub {
        uint256 avail = available();
        if (amount > avail) revert InsufficientAvailable(avail, amount);
        committed += amount;
        emit Committed(amount, committed);
    }

    function payout(address seller, uint256 amount) external onlyHub {
        if (amount > committed) revert CommittedTooLow();
        committed -= amount;
        usdc.safeTransfer(seller, amount);
        emit PaidOut(seller, amount);
    }
}
