import assert from "node:assert/strict";
import hre from "hardhat";

const { ethers, network } = hre;

async function deployFixture() {
    const [owner, maker, executor, recipient] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("QMSwapMultiTokenV3");

    const initialSupply = ethers.parseUnits("1000000", 18);
    const maxSupply = ethers.parseUnits("2000000", 18);
    const faucetAmount = ethers.parseUnits("100", 18);

    const tokenA = await Token.deploy(
        "QMSwap Test A",
        "TSTA",
        18,
        faucetAmount,
        maxSupply,
        initialSupply,
        owner.address
    );
    await tokenA.waitForDeployment();

    const tokenB = await Token.deploy(
        "QMSwap Test B",
        "TSTB",
        18,
        faucetAmount,
        maxSupply,
        initialSupply,
        owner.address
    );
    await tokenB.waitForDeployment();

    const WrappedNative = await ethers.getContractFactory("MockWrappedNative");
    const wrapped = await WrappedNative.deploy();
    await wrapped.waitForDeployment();

    const Factory = await ethers.getContractFactory("QMSwapMultiFactoryV3");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    const Router = await ethers.getContractFactory("QMSwapMultiRouterV3");
    const router = await Router.deploy(
        await factory.getAddress(),
        await wrapped.getAddress()
    );
    await router.waitForDeployment();

    await (await factory.setRouter(await router.getAddress())).wait();

    const pairAddressA = await tokenA.getAddress();
    const pairAddressB = await tokenB.getAddress();

    await (await factory.createPair(pairAddressA, pairAddressB)).wait();

    const routerAddress = await router.getAddress();
    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("1000", 18);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    await (await tokenA.approve(routerAddress, amountA)).wait();
    await (await tokenB.approve(routerAddress, amountB)).wait();

    await (await router.addLiquidity(
        pairAddressA,
        pairAddressB,
        amountA,
        amountB,
        1n,
        deadline,
        owner.address
    )).wait();

    const OrderBook = await ethers.getContractFactory(
        "QMSwapLimitOrderBookV2"
    );

    const orderBook = await OrderBook.deploy(routerAddress);
    await orderBook.waitForDeployment();

    return {
        owner,
        maker,
        executor,
        recipient,
        tokenA,
        tokenB,
        wrapped,
        factory,
        router,
        orderBook
    };
}

describe("QMSwap Limit Order Book V2", function () {
    it("automatically completes a marketable token-to-token order", async function () {
        const f = await deployFixture();
        const {
            owner, maker, executor, recipient,
            tokenA, tokenB, router, orderBook
        } = f;

        const amountIn = ethers.parseUnits("10", 18);
        const quote = await router.quoteOut(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountIn
        );

        const minAmountOut = quote * 99n / 100n;
        const recipientBefore = await tokenB.balanceOf(recipient.address);
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const expiry = BigInt(now + 3600);

        await (await tokenA.transfer(maker.address, amountIn)).wait();
        await (await tokenA.connect(maker).approve(
            await orderBook.getAddress(),
            amountIn
        )).wait();

        await (await orderBook.connect(maker).createLimitOrder(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountIn,
            minAmountOut,
            recipient.address,
            expiry
        )).wait();

        // A marketable order must execute during createLimitOrder().
        assert.equal(
            await tokenA.balanceOf(await orderBook.getAddress()),
            0n
        );

        const recipientAfter = await tokenB.balanceOf(recipient.address);
        const orderAfter = await orderBook.getOrder(1n);

        assert.ok(recipientAfter > recipientBefore);
        assert.equal(orderAfter.status, 2n);
        assert.equal(orderAfter.owner, maker.address);
        assert.equal(
            await tokenA.balanceOf(await orderBook.getAddress()),
            0n
        );

        // Router allowance must not remain open after execution.
        assert.equal(
            await tokenA.allowance(
                await orderBook.getAddress(),
                await router.getAddress()
            ),
            0n
        );
    });

    it("does not execute below the limit and allows the owner to cancel", async function () {
        const f = await deployFixture();
        const { maker, executor, recipient, tokenA, tokenB, router, orderBook } = f;

        const amountIn = ethers.parseUnits("10", 18);
        const quote = await router.quoteOut(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountIn
        );

        // One unit above the current quote: this order must not execute.
        const minAmountOut = quote + 1n;
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const expiry = BigInt(now + 3600);

        await (await tokenA.transfer(maker.address, amountIn)).wait();
        await (await tokenA.connect(maker).approve(
            await orderBook.getAddress(),
            amountIn
        )).wait();

        await (await orderBook.connect(maker).createLimitOrder(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountIn,
            minAmountOut,
            recipient.address,
            expiry
        )).wait();

        await assert.rejects(
            orderBook.connect(executor).executeOrder(1n),
            /LIMIT_NOT_REACHED/
        );

        assert.equal((await orderBook.getOrder(1n)).status, 1n);

        await (await orderBook.connect(maker).cancelOrder(1n)).wait();

        assert.equal((await orderBook.getOrder(1n)).status, 3n);
        assert.equal(
            await tokenA.balanceOf(await orderBook.getAddress()),
            0n
        );
        assert.equal(
            await tokenA.balanceOf(maker.address),
            amountIn
        );
    });

    it("keeps a reverse-direction order Open when its limit is not reached", async function () {
        const {
            maker, executor, recipient,
            tokenA, tokenB, router, orderBook
        } = await deployFixture();

        const amountIn = ethers.parseUnits("10", 18);
        const tokenIn = await tokenB.getAddress();
        const tokenOut = await tokenA.getAddress();

        const quote = await router.quoteOut(
            tokenIn,
            tokenOut,
            amountIn
        );

        const minAmountOut = quote + 1n;
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const expiry = BigInt(now + 3600);

        await (await tokenB.transfer(maker.address, amountIn)).wait();
        await (await tokenB.connect(maker).approve(
            await orderBook.getAddress(),
            amountIn
        )).wait();

        await (await orderBook.connect(maker).createLimitOrder(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient.address,
            expiry
        )).wait();

        assert.equal((await orderBook.getOrder(1n)).status, 1n);

        await assert.rejects(
            orderBook.connect(executor).executeOrder(1n),
            /LIMIT_NOT_REACHED/
        );

        await (await orderBook.connect(maker).cancelOrder(1n)).wait();

        assert.equal((await orderBook.getOrder(1n)).status, 3n);
        assert.equal(
            await tokenB.balanceOf(await orderBook.getAddress()),
            0n
        );
    });
    it("escrows native QMS and refunds it on cancellation or expiry", async function () {
        const f = await deployFixture();
        const {
            maker, executor, tokenB, wrapped,
            factory, orderBook
        } = f;

        const wrappedAddress = await wrapped.getAddress();
        const tokenBAddress = await tokenB.getAddress();

        // The pair must exist; it does not need liquidity for order creation.
        await (await factory.createPair(
            wrappedAddress,
            tokenBAddress
        )).wait();

        const amountIn = ethers.parseEther("1");
        const minAmountOut = 1n;

        let now = (await ethers.provider.getBlock("latest")).timestamp;
        let expiry = BigInt(now + 3600);

        await (await orderBook.connect(maker).createLimitOrder(
            wrappedAddress,
            tokenBAddress,
            amountIn,
            minAmountOut,
            maker.address,
            expiry,
            { value: amountIn }
        )).wait();

        assert.equal((await orderBook.getOrder(1n)).status, 1n);

        assert.equal(
            await ethers.provider.getBalance(await orderBook.getAddress()),
            amountIn
        );

        await (await orderBook.connect(maker).cancelOrder(1n)).wait();

        assert.equal((await orderBook.getOrder(1n)).status, 3n);
        assert.equal(
            await ethers.provider.getBalance(await orderBook.getAddress()),
            0n
        );

        now = (await ethers.provider.getBlock("latest")).timestamp;
        expiry = BigInt(now + 60);

        await (await orderBook.connect(maker).createLimitOrder(
            wrappedAddress,
            tokenBAddress,
            amountIn,
            minAmountOut,
            maker.address,
            expiry,
            { value: amountIn }
        )).wait();

        await network.provider.send("evm_increaseTime", [90]);
        await network.provider.send("evm_mine");

        await (await orderBook.connect(executor).expireOrder(2n)).wait();

        assert.equal((await orderBook.getOrder(2n)).status, 4n);
        assert.equal(
            await ethers.provider.getBalance(await orderBook.getAddress()),
            0n
        );
    });
});

// ============================================================
// Native QMS execution tests
// ============================================================

describe("QMSwap Limit Order Book V2 - native execution", function () {

    async function seedNativePair(f) {
        const {
            owner,
            tokenB,
            wrapped,
            factory,
            router
        } = f;

        const wrappedAddress = await wrapped.getAddress();
        const tokenBAddress = await tokenB.getAddress();
        const routerAddress = await router.getAddress();

        await (await factory.createPair(
            wrappedAddress,
            tokenBAddress
        )).wait();

        const amountNative = ethers.parseEther("1000");
        const amountToken = ethers.parseEther("1000");

        // Router wraps native QMS internally in addLiquidityNative().
        await (await tokenB.connect(owner).approve(
            routerAddress,
            amountToken
        )).wait();

        const deadline = BigInt(
            Math.floor(Date.now() / 1000) + 3600
        );

        await (await router.connect(owner).addLiquidityNative(
            tokenBAddress,
            amountToken,
            1n,
            deadline,
            owner.address,
            { value: amountNative }
        )).wait();

        return {
            wrappedAddress,
            tokenBAddress
        };
    }
    it("executes native QMS -> token through the Router", async function () {
        const f = await deployFixture();

        const {
            maker,
            executor,
            recipient,
            router,
            orderBook,
            tokenB
        } = f;

        const {
            wrappedAddress,
            tokenBAddress
        } = await seedNativePair(f);

        const amountIn = ethers.parseEther("1");

        const quote = await router.quoteOut(
            wrappedAddress,
            tokenBAddress,
            amountIn
        );

        const minAmountOut = quote * 95n / 100n;

        const latestBlock = await ethers.provider.getBlock("latest");
        const expiry = BigInt(latestBlock.timestamp + 3600);

        const orderBookAddress = await orderBook.getAddress();
        const recipientBefore = await tokenB.balanceOf(recipient.address);

        await (await orderBook.connect(maker).createLimitOrder(
            wrappedAddress,
            tokenBAddress,
            amountIn,
            minAmountOut,
            recipient.address,
            expiry,
            { value: amountIn }
        )).wait();

        assert.equal(
            await ethers.provider.getBalance(orderBookAddress),
            0n
        );

        const recipientAfter = await tokenB.balanceOf(recipient.address);

        assert.ok(recipientAfter - recipientBefore >= minAmountOut);
        assert.equal((await orderBook.getOrder(1n)).status, 2n);

        assert.equal(
            await ethers.provider.getBalance(orderBookAddress),
            0n
        );
    });

    it("executes token -> native QMS through the Router", async function () {
        const f = await deployFixture();

        const {
            owner,
            maker,
            executor,
            recipient,
            router,
            orderBook,
            tokenB
        } = f;

        const {
            wrappedAddress,
            tokenBAddress
        } = await seedNativePair(f);

        const amountIn = ethers.parseEther("1");

        const quote = await router.quoteOut(
            tokenBAddress,
            wrappedAddress,
            amountIn
        );

        const minAmountOut = quote * 95n / 100n;

        const latestBlock = await ethers.provider.getBlock("latest");
        const expiry = BigInt(latestBlock.timestamp + 3600);

        await (await tokenB.connect(owner).transfer(
            maker.address,
            amountIn
        )).wait();

        await (await tokenB.connect(maker).approve(
            await orderBook.getAddress(),
            amountIn
        )).wait();

        const recipientBefore = await ethers.provider.getBalance(
            recipient.address
        );

        await (await orderBook.connect(maker).createLimitOrder(
            tokenBAddress,
            wrappedAddress,
            amountIn,
            minAmountOut,
            recipient.address,
            expiry
        )).wait();

        const recipientAfter = await ethers.provider.getBalance(
            recipient.address
        );

        assert.ok(recipientAfter - recipientBefore >= minAmountOut);
        assert.equal((await orderBook.getOrder(1n)).status, 2n);

        assert.equal(
            await tokenB.balanceOf(await orderBook.getAddress()),
            0n
        );

        assert.equal(
            await tokenB.allowance(
                await orderBook.getAddress(),
                await router.getAddress()
            ),
            0n
        );
    });
});