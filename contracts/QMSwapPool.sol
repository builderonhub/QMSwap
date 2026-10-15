// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQMSToken {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

contract QMSwapPool {
    address public immutable token0;
    address public immutable token1;

    uint112 public reserve0;
    uint112 public reserve1;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    uint256 private unlocked = 1;

    event LiquidityAdded(address indexed user, uint256 amount0, uint256 amount1, uint256 sharesOut);
    event LiquidityRemoved(address indexed user, uint256 amount0, uint256 amount1, uint256 sharesIn);
    event Swap(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);
    event Sync(uint112 reserve0, uint112 reserve1);

    modifier lock() {
        require(unlocked == 1, "locked");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor(address a, address b) {
        require(a != address(0) && b != address(0), "zero address");
        require(a != b, "same token");
        token0 = a;
        token1 = b;
    }

    function quoteOut(address tokenIn, uint256 amountIn)
        public view returns (uint256)
    {
        require(tokenIn == token0 || tokenIn == token1, "unsupported token");
        uint256 rin = tokenIn == token0 ? reserve0 : reserve1;
        uint256 rout = tokenIn == token0 ? reserve1 : reserve0;
        if (amountIn == 0 || rin == 0 || rout == 0) return 0;

        uint256 withFee = amountIn * 997;
        return withFee * rout / (rin * 1000 + withFee);
    }

    function addLiquidity(uint256 amount0, uint256 amount1, uint256 minShares)
        external lock returns (uint256 out)
    {
        require(amount0 > 0 && amount1 > 0, "zero amount");

        uint256 b0 = IQMSToken(token0).balanceOf(address(this));
        uint256 b1 = IQMSToken(token1).balanceOf(address(this));

        _transferFrom(token0, msg.sender, amount0);
        _transferFrom(token1, msg.sender, amount1);

        uint256 got0 = IQMSToken(token0).balanceOf(address(this)) - b0;
        uint256 got1 = IQMSToken(token1).balanceOf(address(this)) - b1;

        if (totalShares == 0) {
            out = _sqrt(got0 * got1);
        } else {
            uint256 s0 = got0 * totalShares / reserve0;
            uint256 s1 = got1 * totalShares / reserve1;
            out = s0 < s1 ? s0 : s1;
        }

        require(out > 0 && out >= minShares, "insufficient shares");
        totalShares += out;
        shares[msg.sender] += out;
        _update();
        emit LiquidityAdded(msg.sender, got0, got1, out);
    }

    function removeLiquidity(uint256 amount, uint256 min0, uint256 min1)
        external lock returns (uint256 out0, uint256 out1)
    {
        require(amount > 0 && shares[msg.sender] >= amount, "shares");

        out0 = amount * reserve0 / totalShares;
        out1 = amount * reserve1 / totalShares;
        require(out0 >= min0 && out1 >= min1, "slippage");

        shares[msg.sender] -= amount;
        totalShares -= amount;

        _transfer(token0, msg.sender, out0);
        _transfer(token1, msg.sender, out1);

        _update();
        emit LiquidityRemoved(msg.sender, out0, out1, amount);
    }

    function swapExactInput(address tokenIn, uint256 amountIn, uint256 minOut)
        external lock returns (uint256 out)
    {
        require(tokenIn == token0 || tokenIn == token1, "unsupported token");
        require(amountIn > 0, "zero input");

        bool forward = tokenIn == token0;
        address tokenOut = forward ? token1 : token0;
        uint256 rin = forward ? reserve0 : reserve1;
        uint256 rout = forward ? reserve1 : reserve0;

        uint256 beforeBal = IQMSToken(tokenIn).balanceOf(address(this));
        _transferFrom(tokenIn, msg.sender, amountIn);
        uint256 actualIn = IQMSToken(tokenIn).balanceOf(address(this)) - beforeBal;

        uint256 withFee = actualIn * 997;
        out = withFee * rout / (rin * 1000 + withFee);

        require(out > 0 && out >= minOut && out < rout, "slippage/liquidity");
        _transfer(tokenOut, msg.sender, out);
        _update();

        emit Swap(msg.sender, tokenIn, actualIn, tokenOut, out);
    }

    function _update() internal {
        uint256 b0 = IQMSToken(token0).balanceOf(address(this));
        uint256 b1 = IQMSToken(token1).balanceOf(address(this));
        require(b0 <= type(uint112).max && b1 <= type(uint112).max, "reserve overflow");
        reserve0 = uint112(b0);
        reserve1 = uint112(b1);
        emit Sync(reserve0, reserve1);
    }

    function _transfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IQMSToken.transfer.selector, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }

    function _transferFrom(address token, address from, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(
                IQMSToken.transferFrom.selector, from, address(this), amount
            )
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom failed");
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
