import assert from "node:assert/strict";
import hre from "hardhat";
const { ethers } = hre;

async function deployFixture() {
    const [owner, trader] = await ethers.getSigners();

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
    const wrappedNativeToken = await WrappedNative.deploy();
    await wrappedNativeToken.waitForDeployment();

    const Factory = await ethers.getContractFactory("QMSwapMultiFactoryV3");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    // Token A is used as a nonzero wrapped-native placeholder.
    // These tests do not exercise native-token functions.
    const Router = await ethers.getContractFactory("QMSwapMultiRouterV3");
    const router = await Router.deploy(
        await factory.getAddress(),
        await wrappedNativeToken.getAddress()
    );
    await router.waitForDeployment();

    await (await factory.setRouter(await router.getAddress())).wait();

    return { owner, trader, tokenA, tokenB, wrappedNativeToken, factory, router };
}

async function createPairAndAddLiquidity(f) {
    const {
        owner, tokenA, tokenB, factory, router
    } = f;

    const addressA = await tokenA.getAddress();
    const addressB = await tokenB.getAddress();

    await (await factory.createPair(addressA, addressB)).wait();

    const pairAddress = await factory.getPair(addressA, addressB);
    assert.notEqual(pairAddress, ethers.ZeroAddress);

    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("1000", 18);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const routerAddress = await router.getAddress();

    await (await tokenA.approve(routerAddress, amountA)).wait();
    await (await tokenB.approve(routerAddress, amountB)).wait();

    await (await router.addLiquidity(
        addressA,
        addressB,
        amountA,
        amountB,
        1n,
        deadline,
        owner.address
    )).wait();

    const pair = await ethers.getContractAt(
        "QMSwapMultiPairV3",
        pairAddress
    );

    return { pair, deadline };
}

describe("QMSwap MultiPair V3 â€” local tests", function () {
    it("deploys test tokens with the expected metadata and supply", async function () {
        const f = await deployFixture();

        assert.equal(await f.tokenA.name(), "QMSwap Test A");
        assert.equal(await f.tokenA.symbol(), "TSTA");
        assert.equal(await f.tokenA.decimals(), 18n);
        assert.equal(
            await f.tokenA.totalSupply(),
            ethers.parseUnits("1000000", 18)
        );
        assert.equal(await f.tokenA.owner(), f.owner.address);
    });

    it("connects the Router to the Factory and creates a pair", async function () {
        const f = await deployFixture();

        assert.equal(
            await f.router.factory(),
            await f.factory.getAddress()
        );
        assert.equal(
            await f.factory.router(),
            await f.router.getAddress()
        );

        const addressA = await f.tokenA.getAddress();
        const addressB = await f.tokenB.getAddress();

        await (await f.factory.createPair(addressA, addressB)).wait();

        const pairAddress = await f.factory.getPair(addressA, addressB);
        assert.notEqual(pairAddress, ethers.ZeroAddress);

        assert.equal(
            await f.factory.getPair(addressB, addressA),
            pairAddress
        );
        assert.equal(await f.factory.allPairsLength(), 1n);

        const code = await ethers.provider.getCode(pairAddress);
        assert.notEqual(code, "0x");
    });

    it("adds liquidity and gives the provider LP tokens", async function () {
        const f = await deployFixture();
        const { pair } = await createPairAndAddLiquidity(f);

        assert((await pair.totalSupply()) > 0n);
        assert((await pair.balanceOf(f.owner.address)) > 0n);

        const [reserve0, reserve1] = await pair.getReserves();
        assert(reserve0 > 0n);
        assert(reserve1 > 0n);
    });

    it("swaps tokens and increases the trader's output-token balance", async function () {
        const f = await deployFixture();
        const { tokenA, tokenB, router, trader } = f;
        const { deadline } = await createPairAndAddLiquidity(f);

        const amountIn = ethers.parseUnits("1", 18);
        const routerAddress = await router.getAddress();

        await (await tokenA.transfer(
            trader.address,
            ethers.parseUnits("10", 18)
        )).wait();

        await (await tokenA.connect(trader).approve(
            routerAddress,
            amountIn
        )).wait();

        const balanceBefore = await tokenB.balanceOf(trader.address);

        await (await router.connect(trader).swapExactTokensForTokens(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountIn,
            0n,
            deadline,
            trader.address
        )).wait();

        const balanceAfter = await tokenB.balanceOf(trader.address);
        assert(balanceAfter > balanceBefore);
    });

    it("rejects a swap when minimum output is unrealistically high", async function () {
        const f = await deployFixture();
        const { tokenA, tokenB, router, trader } = f;
        const { deadline } = await createPairAndAddLiquidity(f);

        const amountIn = ethers.parseUnits("1", 18);
        const routerAddress = await router.getAddress();

        await (await tokenA.transfer(
            trader.address,
            ethers.parseUnits("10", 18)
        )).wait();

        await (await tokenA.connect(trader).approve(
            routerAddress,
            amountIn
        )).wait();

        await assert.rejects(async () => {
            await router.connect(trader).swapExactTokensForTokens(
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                amountIn,
                ethers.parseUnits("100000", 18),
                deadline,
                trader.address
            );
        });
    });
});




// Additional negative and access-control tests.
describe("QMSwap V3 â€” negative and access-control tests", function () {
    it("rejects duplicate trading pairs", async function () {
        const f = await deployFixture();

        const tokenA = await f.tokenA.getAddress();
        const tokenB = await f.tokenB.getAddress();

        await (await f.factory.createPair(tokenA, tokenB)).wait();

        await assert.rejects(async () => {
            await f.factory.createPair(tokenA, tokenB);
        });
    });

    it("prevents a non-owner from changing the Router", async function () {
        const f = await deployFixture();

        await assert.rejects(async () => {
            await f.factory.connect(f.trader).setRouter(f.trader.address);
        });
    });

    it("rejects swaps submitted after the deadline", async function () {
        const f = await deployFixture();
        const { tokenA, tokenB, router, trader } = f;

        await createPairAndAddLiquidity(f);

        const amountIn = ethers.parseUnits("1", 18);
        const routerAddress = await router.getAddress();

        await (await tokenA.transfer(
            trader.address,
            ethers.parseUnits("10", 18)
        )).wait();

        await (await tokenA.connect(trader).approve(
            routerAddress,
            amountIn
        )).wait();

        await assert.rejects(async () => {
            await router.connect(trader).swapExactTokensForTokens(
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                amountIn,
                0n,
                1n,
                trader.address
            );
        });
    });
});

// Deeper correctness tests based on the current V3 contract implementation.
describe("QMSwap V3 â€” deeper correctness tests", function () {

    it("calculates swap output using the configured 0.30% fee", async function () {
        const f = await deployFixture();
        const { pair } = await createPairAndAddLiquidity(f);

        const feeBps = await pair.FEE_BPS();
        const bps = await pair.BPS();
        const token0 = await pair.token0();
        const [reserve0, reserve1] = await pair.getReserves();
        const amountIn = ethers.parseUnits("1", 18);

        assert.equal(feeBps, 30n);
        assert.equal(await f.router.feeBps(), feeBps);

        const amountInWithFee = amountIn * (bps - feeBps);
        const expectedOut =
            amountInWithFee * reserve1 /
            (reserve0 * bps + amountInWithFee);

        const actualOut = await pair.getAmountOut(token0, amountIn);
        assert.equal(actualOut, expectedOut);
    });

    it("locks the minimum initial LP liquidity", async function () {
        const f = await deployFixture();
        const { pair } = await createPairAndAddLiquidity(f);

        const minimum = await pair.MINIMUM_LIQUIDITY();

        assert.equal(minimum, 1000n);
        assert.equal(await pair.balanceOf(ethers.ZeroAddress), minimum);
        assert.equal(
            await pair.totalSupply(),
            (await pair.balanceOf(f.owner.address)) + minimum
        );
    });

    it("rejects zero input and tokens outside the pair", async function () {
        const f = await deployFixture();
        const { pair } = await createPairAndAddLiquidity(f);
        const token0 = await pair.token0();

        await assert.rejects(async () => {
            await pair.getAmountOut(token0, 0n);
        });

        await assert.rejects(async () => {
            await pair.getAmountOut(
                f.trader.address,
                ethers.parseUnits("1", 18)
            );
        });
    });

    it("swaps between 6-decimal and 18-decimal tokens", async function () {
        const f = await deployFixture();
        const { owner, trader, tokenA, factory, router } = f;

        const Token = await ethers.getContractFactory("QMSwapMultiTokenV3");
        const token6 = await Token.deploy(
            "Six Decimal Token",
            "T6",
            6,
            ethers.parseUnits("100", 6),
            ethers.parseUnits("2000000", 6),
            ethers.parseUnits("1000000", 6),
            owner.address
        );
        await token6.waitForDeployment();

        // tokenA is an ordinary 18-decimal token, not the Router's wrapped-native token.
        const address6 = await token6.getAddress();
        const address18 = await tokenA.getAddress();
        const routerAddress = await router.getAddress();

        await (await factory.createPair(address6, address18)).wait();

        const amount6 = ethers.parseUnits("1000", 6);
        const amount18 = ethers.parseUnits("1000", 18);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        await (await token6.approve(routerAddress, amount6)).wait();
        await (await tokenA.approve(routerAddress, amount18)).wait();

        await (await router.addLiquidity(
            address6,
            address18,
            amount6,
            amount18,
            1n,
            deadline,
            owner.address
        )).wait();

        const amountIn = ethers.parseUnits("1", 6);

        await (await token6.transfer(
            trader.address,
            ethers.parseUnits("10", 6)
        )).wait();

        await (await token6.connect(trader).approve(
            routerAddress,
            amountIn
        )).wait();

        const expectedOut = await router.quoteOut(
            address6,
            address18,
            amountIn
        );

        assert(expectedOut > ethers.parseUnits("0.99", 18));
        assert(expectedOut < ethers.parseUnits("1", 18));

        const balanceBefore = await tokenA.balanceOf(trader.address);

        await (await router.connect(trader).swapExactTokensForTokens(
            address6,
            address18,
            amountIn,
            expectedOut,
            deadline,
            trader.address
        )).wait();

        const balanceAfter = await tokenA.balanceOf(trader.address);

        assert.equal(balanceAfter - balanceBefore, expectedOut);
    });
});

// QMSwap V3 - remove-liquidity tests
describe("QMSwap V3 - remove-liquidity tests", function () {

    it("removes a portion of liquidity and returns both tokens", async function () {
        const f = await deployFixture();
        const { owner, tokenA, tokenB, router } = f;
        const { pair, deadline } = await createPairAndAddLiquidity(f);

        const routerAddress = await router.getAddress();
        const pairAddress = await pair.getAddress();
        const addressA = await tokenA.getAddress();
        const addressB = await tokenB.getAddress();

        const sharesBefore = await pair.balanceOf(owner.address);
        const liquidity = sharesBefore / 2n;
        assert(liquidity > 0n);

        await (await pair.approve(routerAddress, liquidity)).wait();

        const tokenABefore = await tokenA.balanceOf(owner.address);
        const tokenBBefore = await tokenB.balanceOf(owner.address);
        const supplyBefore = await pair.totalSupply();

        await (await router.removeLiquidity(
            addressA,
            addressB,
            liquidity,
            1n,
            1n,
            deadline,
            owner.address
        )).wait();

        assert((await tokenA.balanceOf(owner.address)) > tokenABefore);
        assert((await tokenB.balanceOf(owner.address)) > tokenBBefore);
        assert.equal(
            await pair.balanceOf(owner.address),
            sharesBefore - liquidity
        );
        assert.equal(await pair.totalSupply(), supplyBefore - liquidity);
        assert.equal(await pair.balanceOf(pairAddress), 0n);
    });

    it("rejects removal when minimum token amounts are too high", async function () {
        const f = await deployFixture();
        const { owner, tokenA, tokenB, router } = f;
        const { pair, deadline } = await createPairAndAddLiquidity(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;
        await (await pair.approve(await router.getAddress(), liquidity)).wait();

        const sharesBefore = await pair.balanceOf(owner.address);
        const balanceABefore = await tokenA.balanceOf(owner.address);
        const balanceBBefore = await tokenB.balanceOf(owner.address);

        await assert.rejects(async () => {
            await router.removeLiquidity(
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                liquidity,
                ethers.MaxUint256,
                ethers.MaxUint256,
                deadline,
                owner.address
            );
        });

        // A reverted removal must not consume LP or alter user token balances.
        assert.equal(await pair.balanceOf(owner.address), sharesBefore);
        assert.equal(await tokenA.balanceOf(owner.address), balanceABefore);
        assert.equal(await tokenB.balanceOf(owner.address), balanceBBefore);
    });

    it("rejects removal without LP approval", async function () {
        const f = await deployFixture();
        const { owner, tokenA, tokenB, router } = f;
        const { pair, deadline } = await createPairAndAddLiquidity(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;

        await assert.rejects(async () => {
            await router.removeLiquidity(
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                liquidity,
                1n,
                1n,
                deadline,
                owner.address
            );
        });
    });

    it("rejects removal after its deadline", async function () {
        const f = await deployFixture();
        const { owner, tokenA, tokenB, router } = f;
        const { pair } = await createPairAndAddLiquidity(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;

        await assert.rejects(async () => {
            await router.removeLiquidity(
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                liquidity,
                0n,
                0n,
                0n,
                owner.address
            );
        });
    });
});

// QMSwap V3 - native removal tests
describe("QMSwap V3 - native removal tests", function () {
    async function createNativePool(f) {
        const { owner, tokenA, wrappedNativeToken, factory, router } = f;
        const wrappedAddress = await wrappedNativeToken.getAddress();
        const tokenAddress = await tokenA.getAddress();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const nativeAmount = ethers.parseEther("10");
        const tokenAmount = ethers.parseUnits("1000", 18);

        await (await factory.createPair(wrappedAddress, tokenAddress)).wait();
        await (await tokenA.approve(await router.getAddress(), tokenAmount)).wait();

        await (await router.addLiquidityNative(
            tokenAddress,
            tokenAmount,
            1n,
            deadline,
            owner.address,
            { value: nativeAmount }
        )).wait();

        const pairAddress = await factory.getPair(wrappedAddress, tokenAddress);
        const pair = await ethers.getContractAt("QMSwapMultiPairV3", pairAddress);

        return { pair, tokenAddress, deadline };
    }

    it("removes native QMS liquidity and returns QMS plus the paired token", async function () {
        const f = await deployFixture();
        const { owner, trader, tokenA, router, wrappedNativeToken } = f;
        const { pair, tokenAddress, deadline } = await createNativePool(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;
        assert(liquidity > 0n);

        await (await pair.approve(await router.getAddress(), liquidity)).wait();

        const tokenBefore = await tokenA.balanceOf(trader.address);
        const nativeBefore = await ethers.provider.getBalance(trader.address);

        const quote = await router.removeLiquidityNative.staticCall(
            tokenAddress, liquidity, 1n, 1n, deadline, trader.address
        );
        const expectedToken = quote[0];
        const expectedNative = quote[1];

        await (await router.removeLiquidityNative(
            tokenAddress, liquidity, 1n, 1n, deadline, trader.address
        )).wait();

        assert.equal(
            (await tokenA.balanceOf(trader.address)) - tokenBefore,
            expectedToken
        );
        assert.equal(
            (await ethers.provider.getBalance(trader.address)) - nativeBefore,
            expectedNative
        );
        assert.equal(
            await wrappedNativeToken.balanceOf(await router.getAddress()),
            0n
        );
    });

    it("rejects native removal when token minimum is too high", async function () {
        const f = await deployFixture();
        const { owner, tokenA, router } = f;
        const { pair, tokenAddress, deadline } = await createNativePool(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;
        await (await pair.approve(await router.getAddress(), liquidity)).wait();

        const lpBefore = await pair.balanceOf(owner.address);
        const tokenBefore = await tokenA.balanceOf(owner.address);

        await assert.rejects(async () => {
            await router.removeLiquidityNative(
                tokenAddress,
                liquidity,
                ethers.MaxUint256,
                0n,
                deadline,
                owner.address
            );
        });

        assert.equal(await pair.balanceOf(owner.address), lpBefore);
        assert.equal(await tokenA.balanceOf(owner.address), tokenBefore);
    });

    it("rejects native removal after deadline", async function () {
        const f = await deployFixture();
        const { owner, router } = f;
        const { pair, tokenAddress } = await createNativePool(f);

        const liquidity = (await pair.balanceOf(owner.address)) / 2n;

        await assert.rejects(async () => {
            await router.removeLiquidityNative(
                tokenAddress, liquidity, 0n, 0n, 0n, owner.address
            );
        });
    });
});