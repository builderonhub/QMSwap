// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract QMSwapFaucetToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    uint256 public immutable faucetAmount;
    uint256 public immutable maxSupply;
    address public owner;

    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastClaimAt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FaucetClaimed(address indexed account, uint256 amount, uint256 nextClaimAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 faucetAmount_,
        uint256 maxSupply_
    ) {
        require(decimals_ <= 18, "BAD_DECIMALS");
        require(faucetAmount_ > 0 && maxSupply_ >= faucetAmount_, "BAD_SUPPLY");

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        faucetAmount = faucetAmount_;
        maxSupply = maxSupply_;
        owner = msg.sender;
    }

    function nextClaimAt(address account) public view returns (uint256) {
        return lastClaimAt[account] + FAUCET_COOLDOWN;
    }

    function faucet() external returns (uint256 amount) {
        require(block.timestamp >= nextClaimAt(msg.sender), "FAUCET_COOLDOWN");
        amount = faucetAmount;
        lastClaimAt[msg.sender] = block.timestamp;
        _mint(msg.sender, amount);
        emit FaucetClaimed(msg.sender, amount, nextClaimAt(msg.sender));
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "BAD_SPENDER");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE_LOW");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "BAD_RECIPIENT");
        require(amount > 0, "ZERO_AMOUNT");
        require(totalSupply + amount <= maxSupply, "MAX_SUPPLY");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "BAD_RECIPIENT");
        require(balanceOf[from] >= amount, "BALANCE_LOW");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}