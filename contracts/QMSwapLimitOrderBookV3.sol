// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQWAPLimitOrderERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IQWAPLimitOrderRouter {
    function WQMS() external view returns (address);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract QMSwapLimitOrderBookV3 {
    enum Status {
        None,
        Open,
        Executed,
        Cancelled,
        Expired
    }

    struct Order {
        uint256 id;
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 expiry;
        address[] path;
        Status status;
    }

    uint256 public constant MAX_PATH_LENGTH = 5;

    IQWAPLimitOrderRouter public immutable router;
    address public immutable wrappedNative;

    uint256 public nextOrderId = 1;
    uint256 private lockState = 1;

    mapping(uint256 => Order) private orderData;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed owner,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 expiry
    );

    event OrderExecuted(
        uint256 indexed orderId,
        address indexed executor,
        uint256 amountIn,
        uint256 amountOut
    );

    event OrderCancelled(uint256 indexed orderId, address indexed owner);
    event OrderExpired(uint256 indexed orderId, address indexed owner);

    modifier nonReentrant() {
        require(lockState == 1, "REENTRANT");
        lockState = 2;
        _;
        lockState = 1;
    }

    constructor(address router_) {
        require(router_ != address(0) && router_.code.length > 0, "BAD_ROUTER");

        router = IQWAPLimitOrderRouter(router_);

        address wrapped = IQWAPLimitOrderRouter(router_).WQMS();
        require(wrapped != address(0) && wrapped.code.length > 0, "BAD_WQMS");

        wrappedNative = wrapped;
    }

    receive() external payable {}

    function createLimitOrder(
        address[] calldata path,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 expiry
    ) external payable nonReentrant returns (uint256 orderId) {
        _validatePath(path);

        require(amountIn > 0, "ZERO_AMOUNT");
        require(minAmountOut > 0, "ZERO_MIN_OUTPUT");
        require(recipient != address(0), "BAD_RECIPIENT");
        require(expiry > block.timestamp, "BAD_EXPIRY");

        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        if (tokenIn == wrappedNative) {
            require(msg.value == amountIn, "NATIVE_VALUE_MISMATCH");
        } else {
            require(msg.value == 0, "UNEXPECTED_NATIVE_VALUE");

            uint256 beforeBalance = _balanceOf(tokenIn, address(this));

            _safeTransferFrom(
                tokenIn,
                msg.sender,
                address(this),
                amountIn
            );

            uint256 afterBalance = _balanceOf(tokenIn, address(this));

            require(
                afterBalance >= beforeBalance &&
                afterBalance - beforeBalance == amountIn,
                "UNSUPPORTED_TOKEN"
            );
        }

        orderId = nextOrderId++;

        Order storage order = orderData[orderId];

        order.id = orderId;
        order.owner = msg.sender;
        order.tokenIn = tokenIn;
        order.tokenOut = tokenOut;
        order.amountIn = amountIn;
        order.minAmountOut = minAmountOut;
        order.recipient = recipient;
        order.expiry = expiry;
        order.status = Status.Open;

        for (uint256 i; i < path.length; i++) {
            order.path.push(path[i]);
        }

        emit OrderCreated(
            orderId,
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient,
            expiry
        );

        _tryAutoExecute(orderId);
    }

    function _validatePath(address[] calldata path) private view {
        require(path.length >= 2, "PATH_TOO_SHORT");
        require(path.length <= MAX_PATH_LENGTH, "PATH_TOO_LONG");

        for (uint256 i; i < path.length; i++) {
            require(path[i] != address(0), "ZERO_PATH_TOKEN");

            for (uint256 j; j < i; j++) {
                require(path[i] != path[j], "DUPLICATE_PATH_TOKEN");
            }
        }
    }

    function _tryAutoExecute(uint256 orderId) private {
        Order storage order = orderData[orderId];

        try router.getAmountsOut(order.amountIn, order.path)
            returns (uint256[] memory amounts)
        {
            uint256 output = amounts[amounts.length - 1];

            if (output >= order.minAmountOut) {
                // A failed immediate swap must not destroy the submitted order.
                try this.executeImmediately(orderId) {} catch {}
            }
        } catch {}
    }

    function executeImmediately(uint256 orderId) external {
        require(msg.sender == address(this), "ONLY_SELF");
        _executeOrder(orderId, address(this));
    }

    function executeOrder(
        uint256 orderId
    ) external nonReentrant returns (uint256 amountOut) {
        return _executeOrder(orderId, msg.sender);
    }

    function _executeOrder(
        uint256 orderId,
        address executor
    ) private returns (uint256 amountOut) {
        Order storage order = orderData[orderId];

        require(order.status == Status.Open, "ORDER_NOT_OPEN");
        require(block.timestamp <= order.expiry, "ORDER_EXPIRED");

        uint256[] memory quotedAmounts = router.getAmountsOut(
            order.amountIn,
            order.path
        );

        require(
            quotedAmounts[quotedAmounts.length - 1] >= order.minAmountOut,
            "LIMIT_NOT_REACHED"
        );

        order.status = Status.Executed;

        uint256[] memory amounts;

        if (order.tokenIn == wrappedNative) {
            amounts = router.swapExactETHForTokens{value: order.amountIn}(
                order.minAmountOut,
                order.path,
                order.recipient,
                block.timestamp
            );
        } else {
            _safeApprove(order.tokenIn, address(router), 0);
            _safeApprove(order.tokenIn, address(router), order.amountIn);

            if (order.tokenOut == wrappedNative) {
                amounts = router.swapExactTokensForETH(
                    order.amountIn,
                    order.minAmountOut,
                    order.path,
                    order.recipient,
                    block.timestamp
                );
            } else {
                amounts = router.swapExactTokensForTokens(
                    order.amountIn,
                    order.minAmountOut,
                    order.path,
                    order.recipient,
                    block.timestamp
                );
            }

            _safeApprove(order.tokenIn, address(router), 0);
        }

        amountOut = amounts[amounts.length - 1];

        emit OrderExecuted(
            orderId,
            executor,
            order.amountIn,
            amountOut
        );
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orderData[orderId];

        require(order.status == Status.Open, "ORDER_NOT_OPEN");
        require(msg.sender == order.owner, "NOT_ORDER_OWNER");

        order.status = Status.Cancelled;
        _refund(order);

        emit OrderCancelled(orderId, order.owner);
    }

    function expireOrder(uint256 orderId) external nonReentrant {
        Order storage order = orderData[orderId];

        require(order.status == Status.Open, "ORDER_NOT_OPEN");
        require(block.timestamp > order.expiry, "NOT_EXPIRED");

        order.status = Status.Expired;
        _refund(order);

        emit OrderExpired(orderId, order.owner);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        require(orderData[orderId].status != Status.None, "ORDER_NOT_FOUND");
        return orderData[orderId];
    }

    function getOrderCount() external view returns (uint256) {
        return nextOrderId - 1;
    }

    function _refund(Order storage order) private {
        if (order.tokenIn == wrappedNative) {
            (bool ok,) = payable(order.owner).call{value: order.amountIn}("");
            require(ok, "NATIVE_REFUND_FAILED");
        } else {
            _safeTransfer(order.tokenIn, order.owner, order.amountIn);
        }
    }

    function _balanceOf(
        address token,
        address account
    ) private view returns (uint256 balance) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(
                IQWAPLimitOrderERC20.balanceOf.selector,
                account
            )
        );

        require(ok && data.length >= 32, "BALANCE_QUERY_FAILED");
        balance = abi.decode(data, (uint256));
    }

    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(
                IQWAPLimitOrderERC20.transferFrom.selector,
                from,
                to,
                amount
            )
        );

        require(
            ok && (data.length == 0 || (
                data.length >= 32 && abi.decode(data, (bool))
            )),
            "TRANSFER_FROM_FAILED"
        );
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 amount
    ) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(
                IQWAPLimitOrderERC20.transfer.selector,
                to,
                amount
            )
        );

        require(
            ok && (data.length == 0 || (
                data.length >= 32 && abi.decode(data, (bool))
            )),
            "TRANSFER_FAILED"
        );
    }

    function _safeApprove(
        address token,
        address spender,
        uint256 amount
    ) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(
                IQWAPLimitOrderERC20.approve.selector,
                spender,
                amount
            )
        );

        require(
            ok && (data.length == 0 || (
                data.length >= 32 && abi.decode(data, (bool))
            )),
            "APPROVE_FAILED"
        );
    }
}