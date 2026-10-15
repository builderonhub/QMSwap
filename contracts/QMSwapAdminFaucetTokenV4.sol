// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract QMSwapAdminFaucetTokenV4 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    uint256 public immutable maxSupply;
    uint256 public immutable faucetAmount;
    uint256 public immutable adminFaucetAmount;

    address public owner;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastClaimAt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
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
        uint256 adminFaucetAmount_,
        uint256 maxSupply_,
        uint256 initialAdminAllocation_,
        address admin_
    ) {
        require(admin_ != address(0), "ZERO_ADMIN");
        require(maxSupply_ >= initialAdminAllocation_, "INVALID_MAX_SUPPLY");
        require(faucetAmount_ > 0 && adminFaucetAmount_ > 0, "ZERO_FAUCET_AMOUNT");

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        faucetAmount = faucetAmount_;
        adminFaucetAmount = adminFaucetAmount_;
        maxSupply = maxSupply_;
        owner = admin_;

        emit OwnershipTransferred(address(0), admin_);
        if (initialAdminAllocation_ > 0) {
            _mint(admin_, initialAdminAllocation_);
        }
    }

    function nextClaimAt(address account) public view returns (uint256) {
        if (lastClaimAt[account] == 0) return 0;
        return lastClaimAt[account] + FAUCET_COOLDOWN;
    }

    function faucet() external returns (uint256 amount) {
        uint256 next = nextClaimAt(msg.sender);
        require(next == 0 || block.timestamp >= next, "FAUCET_COOLDOWN");

        amount = msg.sender == owner ? adminFaucetAmount : faucetAmount;
        lastClaimAt[msg.sender] = block.timestamp;

        _mint(msg.sender, amount);
        emit FaucetClaimed(msg.sender, amount, nextClaimAt(msg.sender));
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "ZERO_SPENDER");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];

        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowed - amount);
        }

        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ZERO_RECIPIENT");
        require(balanceOf[from] >= amount, "BALANCE");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ZERO_RECIPIENT");
        require(totalSupply + amount <= maxSupply, "MAX_SUPPLY");

        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}