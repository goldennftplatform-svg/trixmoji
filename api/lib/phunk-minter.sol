// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract DoswapzPhunkMinter {
    event ethscriptions_protocol_CreateEthscription(address indexed initialOwner, string contentURI);

    address constant ESCROW = 0x15e85a85B7026875d3529EF0c6de2723C285DA11;
    address constant CREATOR = 0x915A3D363D0a4e4470B531f008F5142c540E5417;
    uint256 constant PRICE = 200000000000000;
    uint256 constant SUPPLY = 10000;
    uint256 constant WALLET_MAX = 20;
    bytes32 constant ROOT = 0x6e2506cf02e828690386f45b90d7e0cfc4b0b74e0e8242a348436dd0f8074133;

    mapping(uint256 => bool) public minted;
    mapping(address => uint256) public mintedBy;

    function mint(string calldata contentURI, bytes32[] calldata proof, uint256 tokenNo) external payable {
        require(msg.value == PRICE, "price");
        require(tokenNo < SUPPLY, "token");
        require(!minted[tokenNo], "used");
        require(mintedBy[msg.sender] < WALLET_MAX, "wallet");
        bytes32 leaf = sha256(bytes(contentURI));
        require(_ok(leaf, proof, tokenNo), "art");
        minted[tokenNo] = true;
        mintedBy[msg.sender] += 1;
        uint256 site = msg.value / 200;
        (bool ok1,) = ESCROW.call{value: site}("");
        (bool ok2,) = CREATOR.call{value: msg.value - site}("");
        require(ok1 && ok2, "pay");
        emit ethscriptions_protocol_CreateEthscription(msg.sender, contentURI);
    }

    function _ok(bytes32 leaf, bytes32[] calldata proof, uint256 index) internal pure returns (bool) {
        if (leaf == bytes32(0) || proof.length != 14) return false;
        bytes32 h = leaf;
        uint256 i = index;
        for (uint256 p = 0; p < 14; p++) {
            bytes32 sib = proof[p];
            if ((i & 1) == 0) h = sha256(abi.encodePacked(h, sib));
            else h = sha256(abi.encodePacked(sib, h));
            i >>= 1;
        }
        return h == ROOT && i == 0;
    }
}
