// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISepoliaEthUsdFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Sepolia-only prototype: self-reported gameplay, no prize custody or delivery.
contract TrixHuntSepoliaSettlement {
    uint256 public constant SHOTS = 10;
    uint256 public constant ROUND_TIMEOUT = 1 days;
    uint256 public constant MAX_FEED_AGE = 2 hours;
    ISepoliaEthUsdFeed public immutable feed;
    address public immutable operator;

    struct Round {
        address player;
        uint64 deadline;
        uint8 pack;
        bool settled;
        uint256 price;
    }
    mapping(bytes32 => Round) public rounds;
    mapping(address => uint256) public credit;
    bool private locked;

    event RoundStarted(bytes32 indexed sessionId, address indexed player, uint8 pack, uint256 price, uint256 deadline);
    event RoundFinalized(bytes32 indexed sessionId, uint8 shotsUsed, bytes32 resultHash, uint256 refund);
    event RoundExpired(bytes32 indexed sessionId, uint256 refund);
    event Withdrawal(address indexed account, uint256 amount);

    constructor(address priceFeed, address trustedOperator) {
        require(block.chainid == 11155111, "Sepolia only");
        require(priceFeed != address(0) && trustedOperator != address(0), "invalid config");
        feed = ISepoliaEthUsdFeed(priceFeed);
        operator = trustedOperator;
    }

    /// @param pack 0 = $5, 1 = $7.50, 2 = $10, each for ten shots.
    function quote(uint8 pack) public view returns (uint256) {
        require(pack < 3, "invalid pack");
        require(feed.decimals() == 8, "invalid decimals");
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        require(roundId > 0 && answer > 0 && updatedAt != 0 && updatedAt <= block.timestamp &&
            block.timestamp - updatedAt <= MAX_FEED_AGE && answeredInRound >= roundId, "invalid feed");
        uint256 cents = pack == 0 ? 500 : pack == 1 ? 750 : 1000;
        // cents/100 USD divided by answer/1e8 USD per ETH, in wei.
        uint256 numerator = cents * 1e24;
        uint256 denominator = uint256(answer);
        uint256 weiPrice = numerator / denominator + (numerator % denominator == 0 ? 0 : 1);
        return ((weiPrice + SHOTS - 1) / SHOTS) * SHOTS;
    }

    function startRound(bytes32 sessionId, uint8 pack, uint256 maxPrice) external payable {
        require(sessionId != bytes32(0) && rounds[sessionId].player == address(0), "invalid session");
        uint256 price = quote(pack);
        require(price <= maxPrice && msg.value >= price && msg.value <= maxPrice, "invalid payment");
        uint256 deadline = block.timestamp + ROUND_TIMEOUT;
        rounds[sessionId] = Round(msg.sender, uint64(deadline), pack, false, price);
        credit[msg.sender] += msg.value - price;
        emit RoundStarted(sessionId, msg.sender, pack, price, deadline);
    }

    function finalizeRound(bytes32 sessionId, uint8 shotsUsed, bytes32 resultHash) external {
        Round storage round = rounds[sessionId];
        require(round.player != address(0) && !round.settled, "invalid round");
        // Test ETH only: players may settle their own unverified simulated round.
        require(msg.sender == operator || msg.sender == round.player, "unauthorized");
        require(block.timestamp < round.deadline, "expired");
        require(shotsUsed <= SHOTS && resultHash != bytes32(0), "invalid result");
        round.settled = true;
        uint256 refund = (round.price / SHOTS) * (SHOTS - shotsUsed);
        credit[round.player] += refund;
        credit[operator] += round.price - refund;
        emit RoundFinalized(sessionId, shotsUsed, resultHash, refund);
    }

    function expireRound(bytes32 sessionId) external {
        Round storage round = rounds[sessionId];
        require(round.player != address(0) && !round.settled && block.timestamp >= round.deadline, "not expirable");
        round.settled = true;
        credit[round.player] += round.price;
        emit RoundExpired(sessionId, round.price);
    }

    function withdraw() external {
        require(!locked, "reentrant");
        locked = true;
        uint256 amount = credit[msg.sender];
        require(amount != 0, "no credit");
        credit[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "withdraw failed");
        locked = false;
        emit Withdrawal(msg.sender, amount);
    }
}
