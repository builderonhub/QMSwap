// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQMSLimitOrderERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IQMSLimitOrderRouter {
    function wrappedNative() external view returns (address);

    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address);

    function quoteOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256);

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external returns (uint256 amountOut);

    function swapExactQMSForTokens(
        address tokenOut,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external payable returns (uint256 amountOut);

    function swapExactTokensForQMS(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) external returns (uint256 amountOut);
}

contract QMSwapLimitOrderBookV1 {
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
        Status status;
    }

    IQMSLimitOrderRouter public immutable router;
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

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed owner
    );

    event OrderExpired(
        uint256 indexed orderId,
        address indexed owner
    );

    modifier nonReentrant() {
        require(lockState == 1, "REENTRANT");
        lockState = 2;
        _;
        lockState = 1;
    }

    constructor(address router_) {
        require(
            router_ != address(0) && router_.code.length > 0,
            "BAD_ROUTER"
        );

        router = IQMSLimitOrderRouter(router_);

        address wrapped = IQMSLimitOrderRouter(router_).wrappedNative();

        require(
            wrapped != address(0) && wrapped.code.length > 0,
            "BAD_WRAPPED_NATIVE"
        );

        wrappedNative = wrapped;
    }

    function createLimitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 expiry
    ) external payable nonReentrant returns (uint256 orderId) {
        require(tokenIn != address(0), "BAD_TOKEN_IN");
        require(tokenOut != address(0), "BAD_TOKEN_OUT");
        require(tokenIn != tokenOut, "SAME_TOKEN");
        require(amountIn > 0, "ZERO_AMOUNT");
        require(minAmountOut > 0, "ZERO_MIN_OUTPUT");
        require(recipient != address(0), "BAD_RECIPIENT");
        require(expiry > block.timestamp, "BAD_EXPIRY");

        address pairAddress = router.getPair(tokenIn, tokenOut);
        require(pairAddress != address(0), "PAIR_NOT_FOUND");

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

        orderData[orderId] = Order({
            id: orderId,
            owner: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            recipient: recipient,
            expiry: expiry,
            status: Status.Open
        });

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
    }

    // Anyone can execute an order once its target output is reached.
    function executeOrder(
        uint256 orderId
    ) external nonReentrant returns (uint256 amountOut) {
        Order storage order = orderData[orderId];

        require(order.status == Status.Open, "ORDER_NOT_OPEN");
        require(block.timestamp <= order.expiry, "ORDER_EXPIRED");

        uint256 quotedOutput = router.quoteOut(
            order.tokenIn,
            order.tokenOut,
            order.amountIn
        );

        require(
            quotedOutput >= order.minAmountOut,
            "LIMIT_NOT_REACHED"
        );

        // State is updated before external calls; a revert rolls it back.
        order.status = Status.Executed;

        if (order.tokenIn == wrappedNative) {
            amountOut = router.swapExactQMSForTokens{
                value: order.amountIn
            }(
                order.tokenOut,
                order.minAmountOut,
                block.timestamp,
                order.recipient
            );
        } else {
            // Router pulls input tokens from this contract.
            _safeApprove(order.tokenIn, address(router), 0);
            _safeApprove(
                order.tokenIn,
                address(router),
                order.amountIn
            );

            if (order.tokenOut == wrappedNative) {
                amountOut = router.swapExactTokensForQMS(
                    order.tokenIn,
                    order.amountIn,
                    order.minAmountOut,
                    block.timestamp,
                    order.recipient
                );
            } else {
                amountOut = router.swapExactTokensForTokens(
                    order.tokenIn,
                    order.tokenOut,
                    order.amountIn,
                    order.minAmountOut,
                    block.timestamp,
                    order.recipient
                );
            }

            _safeApprove(order.tokenIn, address(router), 0);
        }

        emit OrderExecuted(
            orderId,
            msg.sender,
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

    // Anyone can trigger a refund after the order expiry.
    function expireOrder(uint256 orderId) external nonReentrant {
        Order storage order = orderData[orderId];

        require(order.status == Status.Open, "ORDER_NOT_OPEN");
        require(block.timestamp > order.expiry, "NOT_EXPIRED");

        order.status = Status.Expired;
        _refund(order);

        emit OrderExpired(orderId, order.owner);
    }

    function getOrder(
        uint256 orderId
    ) external view returns (Order memory) {
        require(orderData[orderId].status != Status.None, "ORDER_NOT_FOUND");
        return orderData[orderId];
    }

    function getOrderCount() external view returns (uint256) {
        return nextOrderId - 1;
    }

    function _refund(Order storage order) private {
        if (order.tokenIn == wrappedNative) {
            (bool ok,) = payable(order.owner).call{
                value: order.amountIn
            }("");

            require(ok, "NATIVE_REFUND_FAILED");
        } else {
            _safeTransfer(
                order.tokenIn,
                order.owner,
                order.amountIn
            );
        }
    }

    function _balanceOf(
        address token,
        address account
    ) private view returns (uint256 balance) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(
                IQMSLimitOrderERC20.balanceOf.selector,
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
                IQMSLimitOrderERC20.transferFrom.selector,
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
                IQMSLimitOrderERC20.transfer.selector,
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
                IQMSLimitOrderERC20.approve.selector,
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