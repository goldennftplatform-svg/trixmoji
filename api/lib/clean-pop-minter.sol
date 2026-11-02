// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ILegacyPhunks {
    function minted(uint256 tokenNo) external view returns (bool);
}

/// @notice Separate Clean Pop collection. Never changes legacy mint records.
/// @dev Owner manually verifies legacy ownership before replacement delivery.
contract CleanPopMinter {
    event ethscriptions_protocol_CreateEthscription(address indexed initialOwner, string contentURI);
    event ReplacementDelivered(bytes32 indexed legacyId, uint256 indexed tokenNo, address indexed recipient);
    event SalePaused(bool paused);

    address public constant OWNER = 0x915A3D363D0a4e4470B531f008F5142c540E5417;
    address public constant SITE = 0x15e85a85B7026875d3529EF0c6de2723C285DA11;
    address public constant LEGACY = 0x64A0CA6fE1f944De3210a64bD1DAb0619725281d;
    uint256 public constant PRICE = 200000000000000;
    bytes32 public constant ROOT = 0x9fc47a397158abd5575d778503a2a58e0ced72ee663635b91a79dca022c30669;
    bool public paused = true;
    bool private entered;
    mapping(uint256 => bool) public minted;
    mapping(address => uint256) public mintedBy;
    mapping(bytes32 => bool) public replaced;

    modifier ownerOnly() { require(msg.sender == OWNER, "owner"); _; }
    modifier nonReentrant() {
        require(!entered, "reentrant"); entered = true; _; entered = false;
    }

    function setPaused(bool value) external ownerOnly {
        paused = value;
        emit SalePaused(value);
    }

    function mint(string calldata contentURI, bytes32[] calldata proof, uint256 tokenNo) external payable nonReentrant {
        require(!paused, "paused");
        require(msg.value == PRICE, "price");
        // Every previously minted legacy number stays reserved for its holder.
        require(!ILegacyPhunks(LEGACY).minted(tokenNo), "legacy reserved");
        require(mintedBy[msg.sender] < 20, "wallet");
        _create(msg.sender, contentURI, proof, tokenNo);
        mintedBy[msg.sender]++;
        (bool siteOK,) = SITE.call{value: msg.value / 200}("");
        (bool creatorOK,) = OWNER.call{value: msg.value - msg.value / 200}("");
        require(siteOK && creatorOK, "pay");
    }

    /// @notice Project wallet pays gas. Zero mint price; works while public sale is paused.
    /// @dev legacyId/recipient ownership is manually verified OFF CHAIN by OWNER.
    function deliverReplacement(string calldata contentURI, bytes32[] calldata proof, uint256 tokenNo,
                                bytes32 legacyId, address recipient) external ownerOnly nonReentrant {
        require(legacyId != bytes32(0) && !replaced[legacyId], "legacy id");
        require(ILegacyPhunks(LEGACY).minted(tokenNo), "not legacy minted");
        require(recipient != address(0) && recipient != address(this), "recipient");
        replaced[legacyId] = true;
        _create(recipient, contentURI, proof, tokenNo);
        emit ReplacementDelivered(legacyId, tokenNo, recipient);
    }

    function _create(address recipient, string calldata contentURI, bytes32[] calldata proof, uint256 tokenNo) private {
        require(tokenNo < 10000 && !minted[tokenNo], "token");
        require(proof.length == 14, "proof length");
        bytes32 h = sha256(bytes(contentURI));
        uint256 index = tokenNo;
        for (uint256 p; p < 14; p++) {
            h = (index & 1) == 0 ? sha256(abi.encodePacked(h, proof[p])) : sha256(abi.encodePacked(proof[p], h));
            index >>= 1;
        }
        require(h == ROOT, "art");
        minted[tokenNo] = true;
        // The creation event must be the first creation event in the transaction.
        emit ethscriptions_protocol_CreateEthscription(recipient, contentURI);
    }
}
