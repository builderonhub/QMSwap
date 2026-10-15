// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQMSV2ERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address,address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
    function approve(address,uint256) external returns (bool);
}

abstract contract QMSV2ERC20 is IQMSV2ERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    event Transfer(address indexed from,address indexed to,uint256 value);
    event Approval(address indexed owner,address indexed spender,uint256 value);

    constructor(string memory n,string memory s) {
        name = n;
        symbol = s;
    }

    function approve(address spender,uint256 amount) external override returns(bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender,spender,amount);
        return true;
    }

    function transfer(address to,uint256 amount) external override returns(bool) {
        _transfer(msg.sender,to,amount);
        return true;
    }

    function transferFrom(address from,address to,uint256 amount) external override returns(bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount,"ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from,msg.sender,allowance[from][msg.sender]);
        }
        _transfer(from,to,amount);
        return true;
    }

    function _transfer(address from,address to,uint256 amount) internal {
        require(to != address(0),"ZERO_TO");
        require(balanceOf[from] >= amount,"BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from,to,amount);
    }

    function _mint(address to,uint256 amount) internal {
        require(to != address(0),"ZERO_TO");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0),to,amount);
    }

    function _burn(address from,uint256 amount) internal {
        require(balanceOf[from] >= amount,"BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            totalSupply -= amount;
        }
        emit Transfer(from,address(0),amount);
    }
}

contract QMSV2Token is QMSV2ERC20 {
    address public immutable owner;

    constructor(string memory n,string memory s,uint256 initialSupply)
        QMSV2ERC20(n,s)
    {
        owner = msg.sender;
        _mint(msg.sender,initialSupply);
    }

    function mint(address to,uint256 amount) external {
        require(msg.sender == owner,"OWNER_ONLY");
        _mint(to,amount);
    }
}

contract WQMS is QMSV2ERC20 {
    constructor() QMSV2ERC20("Wrapped QMS","WQMS") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        require(msg.value > 0,"ZERO_VALUE");
        _mint(msg.sender,msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender,amount);
        (bool ok,) = payable(msg.sender).call{value:amount}("");
        require(ok,"NATIVE_TRANSFER_FAILED");
    }
}

contract QMSwapV2Pool {
    address public immutable token0;
    address public immutable token1;
    address public immutable router;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private lastTimestamp;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    string public constant name = "QMSwap V2 LP";
    string public constant symbol = "QMS-V2-LP";
    uint8 public constant decimals = 18;

    event Transfer(address indexed from,address indexed to,uint256 value);
    event Approval(address indexed owner,address indexed spender,uint256 value);
    event Mint(address indexed to,uint256 amount0,uint256 amount1,uint256 shares);
    event Swap(address indexed tokenIn,uint256 amountIn,uint256 amountOut,address indexed to);
    event Sync(uint112 reserve0,uint112 reserve1);

    modifier onlyRouter() {
        require(msg.sender == router,"ROUTER_ONLY");
        _;
    }

    constructor(address a,address b,address r) {
        require(a != address(0) && b != address(0) && a != b,"BAD_PAIR");
        require(r != address(0),"BAD_ROUTER");

        if (a < b) {
            token0 = a;
            token1 = b;
        } else {
            token0 = b;
            token1 = a;
        }
        router = r;
    }

    function getReserves() external view returns(uint112,uint112,uint32) {
        return (reserve0,reserve1,lastTimestamp);
    }

    function approve(address spender,uint256 amount) external returns(bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender,spender,amount);
        return true;
    }

    function transfer(address to,uint256 amount) external returns(bool) {
        _transferLP(msg.sender,to,amount);
        return true;
    }

    function transferFrom(address from,address to,uint256 amount) external returns(bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount,"LP_ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from,msg.sender,allowance[from][msg.sender]);
        }
        _transferLP(from,to,amount);
        return true;
    }

    function _transferLP(address from,address to,uint256 amount) internal {
        require(to != address(0),"ZERO_TO");
        require(balanceOf[from] >= amount,"LP_BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from,to,amount);
    }

    function mintShares(address to,uint256 minShares)
        external onlyRouter returns(uint256 shares)
    {
        uint256 b0 = IQMSV2ERC20(token0).balanceOf(address(this));
        uint256 b1 = IQMSV2ERC20(token1).balanceOf(address(this));

        require(b0 >= reserve0 && b1 >= reserve1,"BAD_BALANCE");
        uint256 amount0 = b0 - uint256(reserve0);
        uint256 amount1 = b1 - uint256(reserve1);
        require(amount0 > 0 && amount1 > 0,"BOTH_TOKENS_REQUIRED");

        if (totalSupply == 0) {
            shares = _sqrt(amount0 * amount1);
        } else {
            require(reserve0 > 0 && reserve1 > 0,"BAD_RESERVES");
            uint256 s0 = amount0 * totalSupply / uint256(reserve0);
            uint256 s1 = amount1 * totalSupply / uint256(reserve1);
            shares = s0 < s1 ? s0 : s1;
        }

        require(shares > 0 && shares >= minShares,"MIN_SHARES");
        totalSupply += shares;
        balanceOf[to] += shares;
        emit Transfer(address(0),to,shares);
        emit Mint(to,amount0,amount1,shares);

        _update(b0,b1);
    }

    function swapExactIn(address tokenIn,address to,uint256 minOut)
        external onlyRouter returns(uint256 amountOut)
    {
        bool zeroForOne = tokenIn == token0;
        require(zeroForOne || tokenIn == token1,"BAD_TOKEN");

        uint256 balanceIn;
        uint256 balanceOut;
        uint256 reserveIn;
        uint256 reserveOut;
        address tokenOut;

        if (zeroForOne) {
            balanceIn = IQMSV2ERC20(token0).balanceOf(address(this));
            balanceOut = IQMSV2ERC20(token1).balanceOf(address(this));
            reserveIn = reserve0;
            reserveOut = reserve1;
            tokenOut = token1;
        } else {
            balanceIn = IQMSV2ERC20(token1).balanceOf(address(this));
            balanceOut = IQMSV2ERC20(token0).balanceOf(address(this));
            reserveIn = reserve1;
            reserveOut = reserve0;
            tokenOut = token0;
        }

        require(balanceIn > reserveIn,"NO_INPUT");
        uint256 amountIn = balanceIn - reserveIn;
        uint256 amountInWithFee = amountIn * 9970;
        amountOut = amountInWithFee * reserveOut /
            (reserveIn * 10000 + amountInWithFee);

        require(amountOut > 0 && amountOut >= minOut,"MIN_OUTPUT");
        require(balanceOut > amountOut,"INSUFFICIENT_LIQUIDITY");

        require(IQMSV2ERC20(tokenOut).transfer(to,amountOut),"OUTPUT_TRANSFER_FAILED");

        uint256 b0 = IQMSV2ERC20(token0).balanceOf(address(this));
        uint256 b1 = IQMSV2ERC20(token1).balanceOf(address(this));
        _update(b0,b1);
        emit Swap(tokenIn,amountIn,amountOut,to);
    }

    function _update(uint256 b0,uint256 b1) private {
        require(b0 <= type(uint112).max && b1 <= type(uint112).max,"RESERVE_OVERFLOW");
        reserve0 = uint112(b0);
        reserve1 = uint112(b1);
        lastTimestamp = uint32(block.timestamp);
        emit Sync(reserve0,reserve1);
    }

    function _sqrt(uint256 y) private pure returns(uint256 z) {
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

contract QMSwapV2Router {
    address public immutable wqms;
    address public immutable owner;
    mapping(address => address) public poolForToken;

    event PoolRegistered(address indexed token,address indexed pool);

    modifier onlyOwner() {
        require(msg.sender == owner,"OWNER_ONLY");
        _;
    }

    constructor(address wrappedQMS) {
        require(wrappedQMS != address(0),"BAD_WQMS");
        wqms = wrappedQMS;
        owner = msg.sender;
    }

    receive() external payable {
        require(msg.sender == wqms,"ONLY_WQMS_CAN_SEND_NATIVE");
    }

    function setPool(address token,address pool) external onlyOwner {
        require(token != address(0) && pool != address(0),"BAD_ADDRESS");
        require(token != wqms,"BAD_TOKEN");

        QMSwapV2Pool p = QMSwapV2Pool(pool);
        address a = p.token0();
        address b = p.token1();
        require(
            (a == wqms && b == token) || (b == wqms && a == token),
            "POOL_PAIR_MISMATCH"
        );
        poolForToken[token] = pool;
        emit PoolRegistered(token,pool);
    }

    function _pool(address token) private view returns(QMSwapV2Pool p) {
        address a = poolForToken[token];
        require(a != address(0),"POOL_NOT_REGISTERED");
        p = QMSwapV2Pool(a);
    }

    function _reserves(QMSwapV2Pool p,address token)
        private view returns(uint256 qmsReserve,uint256 tokenReserve)
    {
        (uint112 r0,uint112 r1,) = p.getReserves();
        if (p.token0() == wqms) return (r0,r1);
        return (r1,r0);
    }

    function swapExactQMSForToken(
        address tokenOut,uint256 minOut,address to
    ) external payable returns(uint256 amountOut) {
        require(msg.value > 0 && to != address(0),"BAD_INPUT");
        QMSwapV2Pool p = _pool(tokenOut);

        WQMS(payable(wqms)).deposit{value:msg.value}();
        require(IQMSV2ERC20(wqms).transfer(address(p),msg.value),"WRAP_TRANSFER_FAILED");
        amountOut = p.swapExactIn(wqms,to,minOut);
    }

    function swapExactTokenForQMS(
        address tokenIn,uint256 amountIn,uint256 minOut,address to
    ) external returns(uint256 amountOut) {
        require(amountIn > 0 && to != address(0),"BAD_INPUT");
        QMSwapV2Pool p = _pool(tokenIn);
        require(IQMSV2ERC20(tokenIn).transferFrom(msg.sender,address(p),amountIn),"INPUT_TRANSFER_FAILED");

        amountOut = p.swapExactIn(tokenIn,address(this),minOut);
        WQMS(payable(wqms)).withdraw(amountOut);

        (bool ok,) = payable(to).call{value:amountOut}("");
        require(ok,"NATIVE_SEND_FAILED");
    }

    function addLiquidityNative(
        address token,uint256 amountTokenDesired,uint256 minShares,address to
    ) external payable returns(uint256 shares) {
        require(msg.value > 0 && amountTokenDesired > 0 && to != address(0),"BAD_INPUT");
        QMSwapV2Pool p = _pool(token);

        uint256 qmsUsed = msg.value;
        uint256 tokenUsed = amountTokenDesired;

        if (p.totalSupply() > 0) {
            (uint256 rq,uint256 rt) = _reserves(p,token);
            require(rq > 0 && rt > 0,"BAD_RESERVES");

            uint256 optimalToken = msg.value * rt / rq;
            if (optimalToken > 0 && optimalToken <= amountTokenDesired) {
                tokenUsed = optimalToken;
                qmsUsed = msg.value;
            } else {
                tokenUsed = amountTokenDesired;
                qmsUsed = amountTokenDesired * rq / rt;
            }
            require(tokenUsed > 0 && qmsUsed > 0,"TOO_SMALL");
        }

        require(
            IQMSV2ERC20(token).transferFrom(msg.sender,address(p),tokenUsed),
            "TOKEN_TRANSFER_FAILED"
        );

        WQMS(payable(wqms)).deposit{value:qmsUsed}();
        require(IQMSV2ERC20(wqms).transfer(address(p),qmsUsed),"WRAP_TRANSFER_FAILED");

        shares = p.mintShares(to,minShares);

        uint256 refund = msg.value - qmsUsed;
        if (refund > 0) {
            (bool ok,) = payable(msg.sender).call{value:refund}("");
            require(ok,"REFUND_FAILED");
        }
    }
}