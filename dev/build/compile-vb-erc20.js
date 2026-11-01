const solc = require('solc');
const fs = require('fs');
const path = require('path');

const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract VantablackToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 supply_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        totalSupply = supply_;
        balanceOf[msg.sender] = supply_;
        emit Transfer(address(0), msg.sender, supply_);
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        unchecked { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; }
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allow");
        require(balanceOf[from] >= amount, "bal");
        unchecked {
            allowance[from][msg.sender] = a - amount;
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }
}
`;

const input = {
  language: 'Solidity',
  sources: { 'VantablackToken.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors) {
  out.errors.forEach((e) => console.log(e.severity, e.formattedMessage));
  if (out.errors.some((e) => e.severity === 'error')) process.exit(1);
}
const c = out.contracts['VantablackToken.sol'].VantablackToken;
const artifact = {
  abi: c.abi,
  bytecode: '0x' + c.evm.bytecode.object
};
const dest = path.join(__dirname, 'vantablack-erc20-artifact.json');
fs.writeFileSync(dest, JSON.stringify(artifact, null, 2));
console.log('wrote', dest, 'bytecode bytes', artifact.bytecode.length / 2 - 1);
