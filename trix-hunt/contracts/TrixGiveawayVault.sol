// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Local prototype. Recorded deposits and emitted transfers require indexer verification.
contract TrixGiveawayVault {
    enum Status { None, Deposited, Reserved, DeliveryRequested, RecoveryRequested, RescueRequested, Closed }
    struct Entry {
        uint256 receivedBlock;
        bytes32 roundId;
        address beneficiary;
        Status status;
        uint256 lastRequestBlock;
        uint256 requestCount;
    }

    address public immutable depositor;
    address public immutable curator;
    uint256 public constant COOLDOWN_BLOCKS = 5;
    mapping(bytes32 => Entry) public entries;

    event PotentialDeposit(bytes32 indexed id, address indexed depositor, uint256 blockNumber);
    event Reserved(bytes32 indexed id, bytes32 indexed roundId, address indexed beneficiary);
    event DeliveryRequested(bytes32 indexed id, bytes32 indexed roundId, address indexed beneficiary);
    event RecoveryRequested(bytes32 indexed id, address indexed depositor);
    event TransferRetried(bytes32 indexed id, address indexed recipient, uint256 requestCount);
    event RescueRequested(bytes32 indexed id, address indexed recipient);
    event ResolvedConfirmed(bytes32 indexed id, Status indexed priorStatus, address indexed curator);
    event ethscriptions_protocol_TransferEthscription(address indexed recipient, bytes32 indexed id);
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner, address indexed recipient, bytes32 indexed id
    );

    constructor(address depositor_, address curator_) {
        require(depositor_ != address(0) && depositor_ != address(this) && curator_ != address(0), "invalid address");
        depositor = depositor_;
        curator = curator_;
    }

    // ESIP-2 deposits must be direct transactions from the previous owner.
    fallback() external {
        require(msg.sender == depositor && tx.origin == depositor, "direct depositor only");
        require(msg.data.length == 32, "invalid length");
        bytes32 id = abi.decode(msg.data, (bytes32));
        require(id != bytes32(0), "zero id");
        require(entries[id].status == Status.None, "id already used");
        entries[id] = Entry(block.number, bytes32(0), address(0), Status.Deposited, 0, 0);
        emit PotentialDeposit(id, depositor, block.number);
    }

    /// @dev Curator must first verify indexed custody and the correct winner off-chain.
    function reserve(bytes32 id, bytes32 roundId, address beneficiary) external {
        require(msg.sender == curator, "curator only");
        require(roundId != bytes32(0) && beneficiary != address(0) && beneficiary != address(this), "invalid reservation");
        Entry storage entry = entries[id];
        require(entry.status == Status.Deposited, "not available");
        entry.roundId = roundId;
        entry.beneficiary = beneficiary;
        entry.status = Status.Reserved;
        emit Reserved(id, roundId, beneficiary);
    }

    function claim(bytes32 id) external {
        Entry storage entry = entries[id];
        require(entry.status == Status.Reserved, "not reserved");
        _checkCooldown(entry);
        entry.status = Status.DeliveryRequested;
        entry.lastRequestBlock = block.number;
        entry.requestCount = 1;
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(depositor, entry.beneficiary, id);
        emit DeliveryRequested(id, entry.roundId, entry.beneficiary);
    }

    function recover(bytes32 id) external {
        require(msg.sender == depositor, "depositor only");
        Entry storage entry = entries[id];
        require(entry.status == Status.Deposited, "not available");
        _checkCooldown(entry);
        entry.status = Status.RecoveryRequested;
        entry.lastRequestBlock = block.number;
        entry.requestCount = 1;
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(depositor, depositor, id);
        emit RecoveryRequested(id, depositor);
    }

    /// @notice Curator retries a request, never changing its recipient or allocation.
    function retry(bytes32 id) external {
        require(msg.sender == curator, "curator only");
        Entry storage entry = entries[id];
        require(entry.status == Status.DeliveryRequested || entry.status == Status.RecoveryRequested || entry.status == Status.RescueRequested, "no request");
        require(block.number >= entry.lastRequestBlock + COOLDOWN_BLOCKS, "cooldown");
        address recipient = entry.status == Status.RecoveryRequested ? depositor : entry.beneficiary;
        entry.lastRequestBlock = block.number;
        entry.requestCount += 1;
        if (entry.status == Status.RescueRequested) {
            emit ethscriptions_protocol_TransferEthscription(recipient, id);
        } else {
            emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(depositor, recipient, id);
        }
        emit TransferRetried(id, recipient, entry.requestCount);
    }

    /// @notice Curator attests to independently verified final resolution; not on-chain proof.
    function confirmResolved(bytes32 id) external {
        require(msg.sender == curator, "curator only");
        Entry storage entry = entries[id];
        Status priorStatus = entry.status;
        require(priorStatus == Status.DeliveryRequested || priorStatus == Status.RecoveryRequested || priorStatus == Status.RescueRequested, "no request");
        entry.status = Status.Closed;
        emit ResolvedConfirmed(id, priorStatus, msg.sender);
    }

    /// @notice Privileged ESIP-1 request for IDs with no entry; depositor must verify indexed custody and last sender.
    function rescueUnrecorded(bytes32 id, address recipient) external {
        require(msg.sender == depositor, "depositor only");
        require(id != bytes32(0) && recipient != address(0) && recipient != address(this), "invalid rescue");
        Entry storage entry = entries[id];
        require(entry.status == Status.None, "id already used");
        entry.beneficiary = recipient;
        entry.status = Status.RescueRequested;
        entry.lastRequestBlock = block.number;
        entry.requestCount = 1;
        emit ethscriptions_protocol_TransferEthscription(recipient, id);
        emit RescueRequested(id, recipient);
    }

    function _checkCooldown(Entry storage entry) private view {
        require(block.number >= entry.receivedBlock + COOLDOWN_BLOCKS, "cooldown");
    }
}
