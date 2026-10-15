// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQMSV3ERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address account, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IQMSV3Wrapped is IQMSV3ERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IQMSV3FactoryView {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

contract QMSwapMultiTokenV3 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    uint256 public immutable maxSupply;
    uint256 public immutable faucetAmount;

    address public owner;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastClaimAt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FaucetClaimed(address indexed account, uint256 amount, uint256 nextClaimAt);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 faucetAmount_,
        uint256 maxSupply_,
        uint256 initialSupply_,
        address admin_
    ) {
        require(admin_ != address(0), "BAD_ADMIN");
        require(decimals_ <= 18, "BAD_DECIMALS");
        require(faucetAmount_ > 0, "BAD_FAUCET_AMOUNT");
        require(initialSupply_ > 0 && initialSupply_ < maxSupply_, "BAD_INITIAL_SUPPLY");

        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        faucetAmount = faucetAmount_;
        maxSupply = maxSupply_;
        owner = admin_;

        _mint(admin_, initialSupply_);
        emit OwnershipTransferred(address(0), admin_);
    }

    function nextClaimAt(address account) public view returns (uint256) {
        if (lastClaimAt[account] == 0) return 0;
        return lastClaimAt[account] + FAUCET_COOLDOWN;
    }

    function faucet() external returns (uint256 amount) {
        uint256 next = nextClaimAt(msg.sender);
        require(next == 0 || block.timestamp >= next, "FAUCET_COOLDOWN");

        amount = faucetAmount;
        lastClaimAt[msg.sender] = block.timestamp;
        _mint(msg.sender, amount);

        emit FaucetClaimed(msg.sender, amount, nextClaimAt(msg.sender));
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BAD_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
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

contract QMSwapMultiPairV3 {
    string public constant name = "QMSwap LP";
    string public constant symbol = "QMS-LP";
    uint8 public constant decimals = 18;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS = 10000;

    address public immutable router;
    address public immutable token0;
    address public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private lockState = 1;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut, address indexed to);

    modifier onlyRouter() {
        require(msg.sender == router, "ONLY_ROUTER");
        _;
    }

    modifier lock() {
        require(lockState == 1, "LOCKED");
        lockState = 2;
        _;
        lockState = 1;
    }

    constructor(address router_, address a, address b) {
        require(router_ != address(0), "BAD_ROUTER");
        require(a != address(0) && b != address(0) && a != b, "BAD_PAIR");
        require(a.code.length > 0 && b.code.length > 0, "TOKEN_NO_CODE");

        router = router_;

        if (a < b) {
            token0 = a;
            token1 = b;
        } else {
            token0 = b;
            token1 = a;
        }
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserve0, reserve1);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transferLP(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];

        if (allowed != type(uint256).max) {
            require(allowed >= amount, "LP_ALLOWANCE_LOW");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transferLP(from, to, amount);
        return true;
    }

    function previewLiquidity(uint256 amount0, uint256 amount1) public view returns (uint256 shares) {
        if (amount0 == 0 || amount1 == 0) return 0;

        if (totalSupply == 0) {
            uint256 root = _sqrt(amount0 * amount1);
            return root > MINIMUM_LIQUIDITY ? root - MINIMUM_LIQUIDITY : 0;
        }

        if (reserve0 == 0 || reserve1 == 0) return 0;

        uint256 shares0 = amount0 * totalSupply / reserve0;
        uint256 shares1 = amount1 * totalSupply / reserve1;

        return shares0 < shares1 ? shares0 : shares1;
    }

    function addLiquidity(
        uint256 amount0,
        uint256 amount1,
        uint256 minShares,
        address recipient
    ) external onlyRouter lock returns (uint256 shares) {
        require(amount0 > 0 && amount1 > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        shares = previewLiquidity(amount0, amount1);
        require(shares > 0 && shares >= minShares, "SHARES_BELOW_MIN");

        _safeTransferFrom(token0, msg.sender, address(this), amount0);
        _safeTransferFrom(token1, msg.sender, address(this), amount1);

        if (totalSupply == 0) _mintLP(address(0), MINIMUM_LIQUIDITY);
        _mintLP(recipient, shares);

        _sync();

        emit LiquidityAdded(recipient, amount0, amount1, shares);
    }

    function getAmountOut(address tokenIn, uint256 amountIn) public view returns (uint256 amountOut) {
        require(amountIn > 0, "ZERO_INPUT");

        uint256 reserveIn;
        uint256 reserveOut;

        if (tokenIn == token0) {
            reserveIn = reserve0;
            reserveOut = reserve1;
        } else if (tokenIn == token1) {
            reserveIn = reserve1;
            reserveOut = reserve0;
        } else {
            revert("TOKEN_NOT_IN_PAIR");
        }

        require(reserveIn > 0 && reserveOut > 0, "NO_LIQUIDITY");

        uint256 amountInWithFee = amountIn * (BPS - FEE_BPS);
        amountOut = amountInWithFee * reserveOut /
            (reserveIn * BPS + amountInWithFee);

        require(amountOut > 0 && amountOut < reserveOut, "BAD_OUTPUT");
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external onlyRouter lock returns (uint256 amountOut) {
        require(recipient != address(0), "BAD_RECIPIENT");

        amountOut = getAmountOut(tokenIn, amountIn);
        require(amountOut >= minAmountOut, "OUTPUT_BELOW_MIN");

        address tokenOut = tokenIn == token0 ? token1 : token0;

        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        _safeTransfer(tokenOut, recipient, amountOut);

        _sync();

        emit Swap(msg.sender, tokenIn, amountIn, amountOut, recipient);
    }

    function _sync() internal {
        reserve0 = IQMSV3ERC20(token0).balanceOf(address(this));
        reserve1 = IQMSV3ERC20(token1).balanceOf(address(this));
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IQMSV3ERC20.transfer.selector, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IQMSV3ERC20.transferFrom.selector, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _transferLP(address from, address to, uint256 amount) internal {
        require(to != address(0) && balanceOf[from] >= amount, "BAD_LP_TRANSFER");

        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mintLP(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract QMSwapMultiFactoryV3 {
    address public owner;
    address public router;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event RouterSet(address indexed router);
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function setRouter(address router_) external onlyOwner {
        require(router == address(0), "ROUTER_ALREADY_SET");
        require(router_ != address(0) && router_.code.length > 0, "BAD_ROUTER");

        router = router_;
        emit RouterSet(router_);
    }

    function createPair(address tokenA, address tokenB) external onlyOwner returns (address pair) {
        require(router != address(0), "ROUTER_NOT_SET");
        require(tokenA != address(0) && tokenB != address(0) && tokenA != tokenB, "BAD_PAIR");
        require(tokenA.code.length > 0 && tokenB.code.length > 0, "TOKEN_NO_CODE");
        require(getPair[tokenA][tokenB] == address(0), "PAIR_EXISTS");

        QMSwapMultiPairV3 created = new QMSwapMultiPairV3(router, tokenA, tokenB);
        pair = address(created);

        address a = created.token0();
        address b = created.token1();

        getPair[a][b] = pair;
        getPair[b][a] = pair;

        allPairs.push(pair);

        emit PairCreated(a, b, pair, allPairs.length - 1);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BAD_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}

contract QMSwapMultiRouterV3 {
    address public immutable factory;
    address public immutable wrappedNative;

    uint256 public constant feeBps = 30;
    uint256 private constant BPS = 10000;
    bool private entered;

    event LiquidityAdded(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 shares);
    event SwapExecuted(address indexed trader, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address recipient);

    modifier nonReentrant() {
        require(!entered, "REENTRANT");
        entered = true;
        _;
        entered = false;
    }

    modifier beforeDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "EXPIRED");
        _;
    }

    constructor(address factory_, address wrappedNative_) {
        require(factory_ != address(0) && factory_.code.length > 0, "BAD_FACTORY");
        require(wrappedNative_ != address(0) && wrappedNative_.code.length > 0, "BAD_WRAPPED_NATIVE");

        factory = factory_;
        wrappedNative = wrappedNative_;
    }

    receive() external payable {
        require(msg.sender == wrappedNative, "NATIVE_ONLY_FROM_WRAPPED");
    }

    function getPair(address tokenA, address tokenB) external view returns (address) {
        return IQMSV3FactoryView(factory).getPair(tokenA, tokenB);
    }

    function quoteOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        address pairAddress = _pair(tokenIn, tokenOut);
        return QMSwapMultiPairV3(pairAddress).getAmountOut(tokenIn, amountIn);
    }

    function previewLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external view returns (uint256 shares) {
        address pairAddress = _pair(tokenA, tokenB);
        QMSwapMultiPairV3 pair = QMSwapMultiPairV3(pairAddress);

        if (pair.token0() == tokenA) {
            shares = pair.previewLiquidity(amountA, amountB);
        } else {
            shares = pair.previewLiquidity(amountB, amountA);
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 minShares,
        uint256 deadline,
        address recipient
    ) external nonReentrant beforeDeadline(deadline) returns (uint256 shares) {
        require(tokenA != wrappedNative && tokenB != wrappedNative, "USE_NATIVE_FUNCTION");
        require(tokenA != tokenB && amountA > 0 && amountB > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        address pairAddress = _pair(tokenA, tokenB);

        _safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        _safeTransferFrom(tokenB, msg.sender, address(this), amountB);

        _safeApprove(tokenA, pairAddress, amountA);
        _safeApprove(tokenB, pairAddress, amountB);

        QMSwapMultiPairV3 pair = QMSwapMultiPairV3(pairAddress);
        uint256 amount0;
        uint256 amount1;

        if (pair.token0() == tokenA) {
            amount0 = amountA;
            amount1 = amountB;
        } else {
            amount0 = amountB;
            amount1 = amountA;
        }

        shares = pair.addLiquidity(amount0, amount1, minShares, recipient);
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, shares);
    }

    function addLiquidityNative(
        address token,
        uint256 tokenAmount,
        uint256 minShares,
        uint256 deadline,
        address recipient
    ) external payable nonReentrant beforeDeadline(deadline) returns (uint256 shares) {
        require(token != wrappedNative && tokenAmount > 0 && msg.value > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        address pairAddress = _pair(wrappedNative, token);

        IQMSV3Wrapped(payable(wrappedNative)).deposit{value: msg.value}();
        _safeTransferFrom(token, msg.sender, address(this), tokenAmount);

        _safeApprove(wrappedNative, pairAddress, msg.value);
        _safeApprove(token, pairAddress, tokenAmount);

        QMSwapMultiPairV3 pair = QMSwapMultiPairV3(pairAddress);
        uint256 amount0;
        uint256 amount1;

        if (pair.token0() == wrappedNative) {
            amount0 = msg.value;
            amount1 = tokenAmount;
        } else {
            amount0 = tokenAmount;
            amount1 = msg.value;
        }

        shares = pair.addLiquidity(amount0, amount1, minShares, recipient);
        emit LiquidityAdded(msg.sender, wrappedNative, token, msg.value, tokenAmount, shares);
    }

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external nonReentrant beforeDeadline(deadline) returns (uint256 amountOut) {
        require(tokenIn != wrappedNative && tokenOut != wrappedNative, "USE_NATIVE_FUNCTION");
        require(tokenIn != tokenOut && amountIn > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        address pairAddress = _pair(tokenIn, tokenOut);

        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        _safeApprove(tokenIn, pairAddress, amountIn);

        amountOut = QMSwapMultiPairV3(pairAddress).swap(
            tokenIn, amountIn, minAmountOut, recipient
        );

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, recipient);
    }

    function swapExactQMSForTokens(
        address tokenOut,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external payable nonReentrant beforeDeadline(deadline) returns (uint256 amountOut) {
        require(tokenOut != wrappedNative && msg.value > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        address pairAddress = _pair(wrappedNative, tokenOut);

        IQMSV3Wrapped(payable(wrappedNative)).deposit{value: msg.value}();
        _safeApprove(wrappedNative, pairAddress, msg.value);

        amountOut = QMSwapMultiPairV3(pairAddress).swap(
            wrappedNative, msg.value, minAmountOut, recipient
        );

        emit SwapExecuted(msg.sender, wrappedNative, tokenOut, msg.value, amountOut, recipient);
    }

    function swapExactTokensForQMS(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external nonReentrant beforeDeadline(deadline) returns (uint256 amountOut) {
        require(tokenIn != wrappedNative && amountIn > 0, "BAD_AMOUNT");
        require(recipient != address(0), "BAD_RECIPIENT");

        address pairAddress = _pair(tokenIn, wrappedNative);

        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        _safeApprove(tokenIn, pairAddress, amountIn);

        amountOut = QMSwapMultiPairV3(pairAddress).swap(
            tokenIn, amountIn, minAmountOut, address(this)
        );

        IQMSV3Wrapped(payable(wrappedNative)).withdraw(amountOut);

        (bool ok,) = payable(recipient).call{value: amountOut}("");
        require(ok, "QMS_SEND_FAILED");

        emit SwapExecuted(msg.sender, tokenIn, wrappedNative, amountIn, amountOut, recipient);
    }

    function _pair(address tokenA, address tokenB) internal view returns (address pairAddress) {
        pairAddress = IQMSV3FactoryView(factory).getPair(tokenA, tokenB);
        require(pairAddress != address(0), "PAIR_NOT_FOUND");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IQMSV3ERC20.transferFrom.selector, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IQMSV3ERC20.approve.selector, spender, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "APPROVE_FAILED");
    }
}