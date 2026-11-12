// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Local testing only. No Ethscription custody, verification or delivery.
contract TrixHuntSettlement {
    uint256 public constant SHOTS = 10;
    address public immutable operator;
    uint256[3] public prices;
    uint256 public immutable roundTimeout;
    mapping(bytes32 => Round) public rounds;
    mapping(address => uint256) public credit;
    bool private locked;

    struct Round {
        address player;
        uint64 deadline;
        uint8 pack;
        bool settled;
    }

    event RoundStarted(bytes32 indexed sessionId, address indexed player, uint8 pack, uint256 price, uint256 deadline);
    // IDs are unverified operator assertions, not ownership or delivery records.
    event RoundFinalized(bytes32 indexed sessionId, uint8 shotsUsed, bytes32 resultHash, bytes32[] claimedCapturedIds, uint256 refund);
    event RoundExpired(bytes32 indexed sessionId, uint256 refund);
    event Withdrawal(address indexed account, uint256 amount);

    modifier nonReentrant() {
        require(!locked, "reentrant");
        locked = true;
        _;
        locked = false;
    }

    constructor(address roundOperator, uint256[3] memory localPrices, uint256 timeoutSeconds) {
        require(roundOperator != address(0) && timeoutSeconds > 0 && timeoutSeconds <= 30 days, "invalid config");
        for (uint256 i; i < 3; ++i) {
            require(localPrices[i] > 0 && localPrices[i] % SHOTS == 0, "invalid price");
            prices[i] = localPrices[i];
        }
        operator = roundOperator;
        roundTimeout = timeoutSeconds;
    }

    function startRound(bytes32 sessionId, uint8 pack) external payable {
        require(sessionId != bytes32(0) && rounds[sessionId].player == address(0), "invalid session");
        require(pack < 3 && msg.value == prices[pack], "invalid payment");
        uint256 deadline = block.timestamp + roundTimeout;
        rounds[sessionId] = Round(msg.sender, uint64(deadline), pack, false);
        emit RoundStarted(sessionId, msg.sender, pack, msg.value, deadline);
    }

    function finalizeRound(bytes32 sessionId, uint8 shotsUsed, bytes32 resultHash, bytes32[] calldata claimedCapturedIds) external {
        require(msg.sender == operator, "operator only");
        Round storage round = rounds[sessionId];
        require(round.player != address(0) && !round.settled, "invalid round");
        require(block.timestamp < round.deadline, "expired");
        require(shotsUsed <= SHOTS && claimedCapturedIds.length <= shotsUsed && resultHash != bytes32(0), "invalid result");
        for (uint256 i; i < claimedCapturedIds.length; ++i) {
            require(claimedCapturedIds[i] != bytes32(0), "invalid id");
            for (uint256 j; j < i; ++j) require(claimedCapturedIds[i] != claimedCapturedIds[j], "duplicate id");
        }
        round.settled = true;
        uint256 price = prices[round.pack];
        uint256 refund = (price / SHOTS) * (SHOTS - shotsUsed);
        credit[round.player] += refund;
        credit[operator] += price - refund;
        emit RoundFinalized(sessionId, shotsUsed, resultHash, claimedCapturedIds, refund);
    }

    /// @notice Anyone may trigger the full player refund once the deadline passes.
    function expireRound(bytes32 sessionId) external {
        Round storage round = rounds[sessionId];
        require(round.player != address(0) && !round.settled && block.timestamp >= round.deadline, "not expirable");
        round.settled = true;
        uint256 refund = prices[round.pack];
        credit[round.player] += refund;
        emit RoundExpired(sessionId, refund);
    }

    function withdraw() external nonReentrant {
        uint256 amount = credit[msg.sender];
        require(amount != 0, "no credit");
        credit[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawal(msg.sender, amount);
    }
}
