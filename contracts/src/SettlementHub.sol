// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ITeleporterReceiver} from "./interfaces/ITeleporter.sol";
import {ICarrierEscrow} from "./interfaces/ICarrierEscrow.sol";
import {SettlementMessage, KIND_DELIVERED, KIND_RETURNED} from "./interfaces/SettlementMessage.sol";

/// Lives on the hub chain (Fuji C-Chain). Keeps a net balance per (carrier, seller),
/// closes periods and lets sellers claim one payout per period.
contract SettlementHub is ITeleporterReceiver, Ownable {
    struct Carrier {
        bytes32 sourceBlockchainID;
        address ledger;
        address escrow;
        string name;
    }

    address public immutable messenger;

    Carrier[] private _carriers; // carrierId = index + 1
    mapping(bytes32 => mapping(address => uint256)) public carrierIdOf;

    mapping(uint256 => mapping(uint64 => bool)) public processed;
    mapping(uint256 => mapping(address => int256)) public balanceVnd;
    mapping(uint256 => address[]) private _sellers;
    mapping(uint256 => mapping(address => bool)) private _isSeller;

    uint256 public currentEpoch = 1;
    uint256 public disputeWindow = 60;
    uint256 public vndPerUsdc = 25_000;

    mapping(uint256 => uint256) public closedAt;
    mapping(uint256 => uint256) public claimableAt;
    mapping(uint256 => uint256) public epochRate;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public payoutVnd;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public payoutUsdc;
    mapping(uint256 => mapping(address => bool)) public claimed;

    error NotMessenger();
    error UnknownCarrier(bytes32 sourceBlockchainID, address sender);
    error InvalidKind(uint8 kind);
    error CarrierAlreadyRegistered();
    error EscrowUnderfunded(uint256 carrierId, uint256 needed, uint256 available);
    error EpochNotClosed(uint256 epoch);
    error DisputeWindowOpen(uint256 claimableAt);
    error AlreadyClaimed();
    error NothingToClaim();
    error ZeroRate();

    event CarrierRegistered(uint256 indexed carrierId, bytes32 sourceBlockchainID, address ledger, address escrow, string name);
    event SettlementRecorded(
        uint256 indexed carrierId,
        address indexed seller,
        uint64 seq,
        bytes32 orderKey,
        uint8 kind,
        int256 deltaVnd,
        int256 newBalance
    );
    event DuplicateIgnored(uint256 indexed carrierId, uint64 seq);
    event EpochClosed(uint256 indexed epoch, uint256 closedAt, uint256 claimableAt, uint256 rate);
    event Claimed(uint256 indexed epoch, uint256 indexed carrierId, address indexed seller, uint256 vnd, uint256 usdc);
    event DisputeWindowSet(uint256 seconds_);
    event RateSet(uint256 vndPerUsdc);

    constructor(address messenger_, address owner_) Ownable(owner_) {
        messenger = messenger_;
    }

    // ---------------------------------------------------------------- admin

    function registerCarrier(bytes32 sourceBlockchainID, address ledger, address escrow, string calldata name)
        external
        onlyOwner
        returns (uint256 carrierId)
    {
        if (carrierIdOf[sourceBlockchainID][ledger] != 0) revert CarrierAlreadyRegistered();
        _carriers.push(Carrier(sourceBlockchainID, ledger, escrow, name));
        carrierId = _carriers.length;
        carrierIdOf[sourceBlockchainID][ledger] = carrierId;
        emit CarrierRegistered(carrierId, sourceBlockchainID, ledger, escrow, name);
    }

    function setDisputeWindow(uint256 seconds_) external onlyOwner {
        disputeWindow = seconds_;
        emit DisputeWindowSet(seconds_);
    }

    function setVndPerUsdc(uint256 rate) external onlyOwner {
        if (rate == 0) revert ZeroRate();
        vndPerUsdc = rate;
        emit RateSet(rate);
    }

    // ------------------------------------------------------------- receiving

    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
        override
    {
        if (msg.sender != messenger) revert NotMessenger();
        uint256 carrierId = carrierIdOf[sourceBlockchainID][originSenderAddress];
        if (carrierId == 0) revert UnknownCarrier(sourceBlockchainID, originSenderAddress);

        SettlementMessage memory m = abi.decode(message, (SettlementMessage));
        if (m.kind != KIND_DELIVERED && m.kind != KIND_RETURNED) revert InvalidKind(m.kind);

        if (processed[carrierId][m.seq]) {
            emit DuplicateIgnored(carrierId, m.seq);
            return;
        }
        processed[carrierId][m.seq] = true;

        int256 delta = m.kind == KIND_DELIVERED
            ? int256(uint256(m.codVnd)) - int256(uint256(m.feeVnd))
            : -int256(uint256(m.feeVnd));

        int256 newBalance = balanceVnd[carrierId][m.seller] + delta;
        balanceVnd[carrierId][m.seller] = newBalance;
        if (!_isSeller[carrierId][m.seller]) {
            _isSeller[carrierId][m.seller] = true;
            _sellers[carrierId].push(m.seller);
        }
        emit SettlementRecorded(carrierId, m.seller, m.seq, m.orderKey, m.kind, delta, newBalance);
    }

    // --------------------------------------------------------------- periods

    /// Moves every positive balance into this epoch's payouts and commits the USDC in each escrow.
    /// Negative balances carry over. Reverts with EscrowUnderfunded if a carrier has not funded enough.
    function closeEpoch() external onlyOwner {
        uint256 epoch = currentEpoch;
        uint256 rate = vndPerUsdc;
        uint256 n = _carriers.length;

        for (uint256 id = 1; id <= n; id++) {
            address[] storage sellers = _sellers[id];
            uint256 totalUsdc;
            for (uint256 i = 0; i < sellers.length; i++) {
                address seller = sellers[i];
                int256 bal = balanceVnd[id][seller];
                if (bal <= 0) continue;
                uint256 vnd = uint256(bal);
                uint256 usdcAmt = (vnd * 1e6) / rate;
                if (usdcAmt == 0) continue; // dust stays in the balance
                balanceVnd[id][seller] = 0;
                payoutVnd[epoch][id][seller] = vnd;
                payoutUsdc[epoch][id][seller] = usdcAmt;
                totalUsdc += usdcAmt;
            }
            if (totalUsdc > 0) {
                ICarrierEscrow escrow = ICarrierEscrow(_carriers[id - 1].escrow);
                uint256 avail = escrow.available();
                if (avail < totalUsdc) revert EscrowUnderfunded(id, totalUsdc, avail);
                escrow.commit(totalUsdc);
            }
        }

        closedAt[epoch] = block.timestamp;
        claimableAt[epoch] = block.timestamp + disputeWindow;
        epochRate[epoch] = rate;
        currentEpoch = epoch + 1;
        emit EpochClosed(epoch, block.timestamp, claimableAt[epoch], rate);
    }

    function claim(uint256 epoch) external {
        if (closedAt[epoch] == 0) revert EpochNotClosed(epoch);
        if (block.timestamp < claimableAt[epoch]) revert DisputeWindowOpen(claimableAt[epoch]);
        if (claimed[epoch][msg.sender]) revert AlreadyClaimed();

        claimed[epoch][msg.sender] = true;
        bool any;
        uint256 n = _carriers.length;
        for (uint256 id = 1; id <= n; id++) {
            uint256 usdcAmt = payoutUsdc[epoch][id][msg.sender];
            if (usdcAmt == 0) continue;
            any = true;
            ICarrierEscrow(_carriers[id - 1].escrow).payout(msg.sender, usdcAmt);
            emit Claimed(epoch, id, msg.sender, payoutVnd[epoch][id][msg.sender], usdcAmt);
        }
        if (!any) revert NothingToClaim();
    }

    // ----------------------------------------------------------------- views

    function carrierCount() external view returns (uint256) {
        return _carriers.length;
    }

    function getCarriers() external view returns (Carrier[] memory) {
        return _carriers;
    }

    /// Index i corresponds to carrierId i + 1.
    function balancesOf(address seller) external view returns (int256[] memory out) {
        uint256 n = _carriers.length;
        out = new int256[](n);
        for (uint256 i = 0; i < n; i++) out[i] = balanceVnd[i + 1][seller];
    }

    function payoutsOf(uint256 epoch, address seller)
        external
        view
        returns (uint256[] memory vnd, uint256[] memory usdc, bool isClaimed)
    {
        uint256 n = _carriers.length;
        vnd = new uint256[](n);
        usdc = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            vnd[i] = payoutVnd[epoch][i + 1][seller];
            usdc[i] = payoutUsdc[epoch][i + 1][seller];
        }
        isClaimed = claimed[epoch][seller];
    }

    function epochInfo(uint256 epoch) external view returns (uint256 closed, uint256 claimable, uint256 rate) {
        return (closedAt[epoch], claimableAt[epoch], epochRate[epoch]);
    }

    function sellersOf(uint256 carrierId) external view returns (address[] memory) {
        return _sellers[carrierId];
    }
}
