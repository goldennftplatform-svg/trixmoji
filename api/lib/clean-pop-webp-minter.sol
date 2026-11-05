// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice Candidate WebP relaunch. It does not alter the deployed V1 minter.
/// @dev Each exact data URI is committed by ROOT; protocol uniqueness is off-chain.
contract CleanPopWebpMinter {
    event ethscriptions_protocol_CreateEthscription(address indexed initialOwner, string contentURI);
    event SalePaused(bool paused);

    address public constant OWNER = 0x915A3D363D0a4e4470B531f008F5142c540E5417;
    address public constant SITE = 0x15e85a85B7026875d3529EF0c6de2723C285DA11;
    uint256 public constant PRICE = 200000000000000;
    bytes32 public constant ROOT = 0xfe6a7cece9e254f117607c2ef328ca17e47141be89c50a893d1547bc2bc838cc;
    bool public paused = true;
    bool private entered;
    mapping(uint256 => bool) public minted;
    mapping(address => uint256) public mintedBy;

    modifier ownerOnly() { require(msg.sender == OWNER, "owner"); _; }
    modifier nonReentrant() { require(!entered, "reentrant"); entered = true; _; entered = false; }

    function setPaused(bool value) external ownerOnly {
        paused = value;
        emit SalePaused(value);
    }

    function mint(string calldata contentURI, bytes32[] calldata proof, uint256 tokenNo) external payable nonReentrant {
        require(!paused, "paused");
        require(msg.value == PRICE, "price");
        require(mintedBy[msg.sender] < 20, "wallet");
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
        emit ethscriptions_protocol_CreateEthscription(msg.sender, contentURI);
        mintedBy[msg.sender]++;
        (bool siteOK,) = SITE.call{value: msg.value / 200}("");
        (bool creatorOK,) = OWNER.call{value: msg.value - msg.value / 200}("");
        require(siteOK && creatorOK, "pay");
    }
}
