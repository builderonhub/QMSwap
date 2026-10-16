import { ethers } from "ethers";
import deployment from "./deployments/qmswap-v2.json";
import poolAbi from "./src/abis/QMSwapV2Pool.json";
import tokenAbi from "./src/abis/QMSV2Token.json";
import wqmsAbi from "./src/abis/WQMS.json";
import routerAbi from "./src/abis/QMSwapV2Router.json";

const CFG = {
  chainId: 19480,
  chainHex: "0x4c18",
  rpc: "https://rpc.testnet.qms.finance",
  explorer: "https://testnet.qmsscan.io",
  wqms: deployment.wqms,
  router: deployment.router,
  tokens: deployment.tokens
};
async function loadDeploymentConfig() {
  try {
    const response = await fetch("/deployments/qmswap-v2.json?ts=" + Date.now(), {
      cache: "no-store"
    });

    if (!response.ok) return;

    const data = await response.json();

    if (Number(data.chainId) !== 19480 || !data.router || !data.tokens) {
      console.warn("Invalid QMSwap deployment config; using current CFG.");
      return;
    }

    if (String(data.router).toLowerCase() !== String(CFG.router).toLowerCase()) {
      console.warn("Router in deployment JSON does not match CFG.");
      return;
    }

    CFG.tokens = data.tokens;
    if (data.wqms) CFG.wqms = data.wqms;
    if (data.feeBps != null) CFG.feeBps = data.feeBps;

    symbols = Object.keys(CFG.tokens);
  } catch (error) {
    console.warn("Could not load deployment JSON; using current CFG.", error);
  }
}
let symbols = Object.keys(CFG.tokens);
function tokenDecimals(symbol) { return Number(CFG.tokens[symbol]?.decimals ?? 18); }
const $ = (id) => document.getElementById(id);
const fmt = (value, decimals = 18, places = 7) => {
  let s = ethers.formatUnits(value, decimals);
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + places + 1);
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "") || "0";
};
const short = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—";
const sqrt = (n) => {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
};

const app = $("app");
app.innerHTML = `
<header class="topbar">
  <a class="brand" href="/"><div class="logo">↗</div><div>QMS<span>wap</span></div></a>
  <div class="top-actions">
    <div class="network">● &nbsp; QMS TESTNET</div>
    <button class="btn" id="connectBtn">Connect Wallet</button>
  </div>
</header>
<main class="page">
  <section class="intro">
    <div class="eyebrow">Decentralized Exchange · V2</div>
    <h1>Swap with QMS.</h1>
    <p>Native QMS ↔ token. Quotes update automatically based on each pool's liquidity.</p>
  </section>
  <div class="tabs">
    <button class="tab active" data-tab="swap">Swap</button>
    <button class="tab" data-tab="liquidity">Add Liquidity</button>
  </div>

  <section id="swapView" class="card">
    <div class="card-head">
      <div><h2>Swap</h2><div class="subtle">AMM · Trading fee 0,30%</div></div>
      <button class="icon-btn" id="refreshBtn" title="Refresh">↻</button>
    </div>
    <div class="panel">
      <div class="panel-top"><span id="fromTitle">You pay</span><span id="balanceFrom">Balance: —</span></div>
      <div class="amount-line">
        <input class="amount" id="amountIn" inputmode="decimal" placeholder="0.0" autocomplete="off">
        <button class="token-pill" id="fromToken">QMS</button>
      </div>
      <div class="balance"><span>Pool reserve</span><span id="reserveFrom">—</span></div>
      <div class="balance"><span></span><button class="small-link" id="maxBtn">MAX</button></div>
    </div>
    <div class="flip-row"><button class="flip" id="flipBtn" title="Reverse direction">↕</button></div>
    <div class="panel">
      <div class="panel-top"><span>You receive (estimated)</span><span id="balanceTo">Balance: —</span></div>
      <div class="amount-line">
        <input class="amount" id="amountOut" readonly placeholder="0.0">
        <select class="token-pill" id="tokenSelect"></select>
      </div>
      <div class="balance"><span>Pool reserve</span><span id="reserveTo">—</span></div>
    </div>
    <div class="details">
      <div class="detail-row"><span>Rate</span><strong id="rate">—</strong></div>
      <div class="detail-row"><span>Price impact</span><strong id="impact">—</strong></div>
      <div class="detail-row"><span>Slippage tolerance</span>
        <select id="swapSlippage" class="select">
          <option value="10">0.1%</option><option value="50" selected>0.5%</option><option value="100">1.0%</option>
        </select>
      </div>
      <div class="detail-row"><span>Minimum received</span><strong id="minOut">—</strong></div>
      <div class="detail-row"><span>Pool</span><strong id="poolAddress">—</strong></div>
    </div>
    <button class="btn primary" id="swapBtn">Enter an amount</button>
    <div class="status" id="swapStatus" role="status">Loading pool data…</div>
    <a class="tx-link" id="swapTx" target="_blank" rel="noopener noreferrer" hidden></a>
  </section>

  <section id="liqView" class="card hidden">
    <div class="card-head">
      <div><h2>Add liquidity</h2><div class="subtle">Provide QMS and tokens to the pool</div></div>
      <button class="icon-btn" id="refreshLiqBtn" title="Refresh">↻</button>
    </div>
    <div class="panel">
      <div class="panel-top"><span>Token pair</span><span id="liqPoolAddress">—</span></div>
      <select id="liqTokenSelect" class="select" style="width:100%"></select>
    </div>
    <div class="panel">
      <div class="panel-top"><span>QMS native</span><span id="liqQmsBalance">Balance: —</span></div>
      <div class="amount-line"><input class="amount" id="liqQms" inputmode="decimal" placeholder="0.0"></div>
      <div class="balance"><span>Current reserve</span><span id="liqQmsReserve">—</span></div>
      <div class="balance"><span></span><button class="small-link" id="liqMaxQms">MAX</button></div>
    </div>
    <div class="flip-row"><span class="subtle">AND</span></div>
    <div class="panel">
      <div class="panel-top"><span id="liqTokenTitle">Token</span><span id="liqTokenBalance">Balance: —</span></div>
      <div class="amount-line"><input class="amount" id="liqTokenAmount" inputmode="decimal" placeholder="0.0"></div>
      <div class="balance"><span>Current reserve</span><span id="liqTokenReserve">—</span></div>
      <div class="balance"><span></span><button class="small-link" id="liqMaxToken">MAX</button></div>
    </div>
    <div class="details">
      <div class="detail-row"><span>Pool ratio</span><strong id="liqRatio">—</strong></div>
      <div class="detail-row"><span>Estimated LP shares</span><strong id="liqShares">—</strong></div>
      <div class="detail-row"><span>LP slippage tolerance</span>
        <select id="liqSlippage" class="select">
          <option value="10">0.1%</option><option value="50" selected>0.5%</option><option value="100">1.0%</option>
        </select>
      </div>
    </div>
    <button class="btn primary" id="addLiqBtn">Add Liquidity</button>
    <div class="status" id="liqStatus" role="status">Loading pool data…</div>
    <a class="tx-link" id="liqTx" target="_blank" rel="noopener noreferrer" hidden></a>
  </section>

  <div class="notice"><strong>Testnet only.</strong> QMSUSDT, QMSUSDC, QMSETH, QMSBNB and QMSBTC are sample tokens created by this project. They are not official or backed assets. Keep native QMS in the wallet for gas.</div>
  <div class="footer">QMSwap V2 · QMS Testnet · Verify transactions in your wallet.</div>
</main>`;

const provider = new ethers.JsonRpcProvider(CFG.rpc);
let walletProvider = null;
let signer = null;
let account = "";
let direction = "QMS_TO_TOKEN";
let tokenContracts = {};
let pools = {};
let poolStates = {};
let qmsBalance = 0n;
let tokenBalances = {};
let busy = false;

function setStatus(id, text, type = "") {
  $(id).textContent = text;
  $(id).className = `status ${type}`.trim();
}
function currentSymbol() { return $("tokenSelect").value; }
function liqSymbol() { return $("liqTokenSelect").value; }
function qmsIn() { return direction === "QMS_TO_TOKEN"; }
function pairState(symbol = currentSymbol()) { return poolStates[symbol]; }

function calculateOut(amountIn, reserveIn, reserveOut) {
  if (!amountIn || amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const withFee = amountIn * 9970n;
  return withFee * reserveOut / (reserveIn * 10000n + withFee);
}
function updateDirectionLabels() {
  $("fromToken").textContent = qmsIn() ? "QMS" : currentSymbol();
  $("fromToken").insertAdjacentHTML("afterbegin", `<span class="token-symbol">${qmsIn() ? "Q" : "T"}</span>`);
}
function updateSwapQuote() {
  if (!symbolsReady()) return;
  const symbol = currentSymbol();
  const token = tokenContracts[symbol];
  const state = pairState(symbol);
  updateDirectionLabels();
  $("poolAddress").textContent = short(CFG.tokens[symbol].pool);
  $("poolAddress").title = CFG.tokens[symbol].pool;

  if (!state) return;
  const inReserve = qmsIn() ? state.reserveQms : state.reserveToken;
  const outReserve = qmsIn() ? state.reserveToken : state.reserveQms;
  const inSymbol = qmsIn() ? "QMS" : symbol;
  const outSymbol = qmsIn() ? symbol : "QMS";

  $("reserveFrom").textContent = `${fmt(inReserve, qmsIn() ? 18 : tokenDecimals(symbol))} ${inSymbol}`;
  $("reserveTo").textContent = `${fmt(outReserve, qmsIn() ? tokenDecimals(symbol) : 18)} ${outSymbol}`;
  $("balanceFrom").textContent = account
    ? `Balance: ${fmt(qmsIn() ? qmsBalance : (tokenBalances[symbol] || 0n), qmsIn() ? 18 : tokenDecimals(symbol))}`
    : "Balance: Connect wallet";
  $("balanceTo").textContent = account
    ? `Balance: ${fmt(qmsIn() ? (tokenBalances[symbol] || 0n) : qmsBalance, qmsIn() ? tokenDecimals(symbol) : 18)}`
    : "Balance: Connect wallet";

  const input = $("amountIn").value.trim();
  $("amountOut").value = "";
  $("rate").textContent = "—";
  $("impact").textContent = "—";
  $("minOut").textContent = "—";

  if (inReserve === 0n || outReserve === 0n) {
    setStatus("swapStatus", "The pool has no liquidity. Go to Add Liquidity and deposit QMS and a token first.");
    $("swapBtn").disabled = true;
    $("swapBtn").textContent = "Pool needs liquidity";
    return;
  }
  if (!input) {
    $("swapBtn").disabled = true;
    $("swapBtn").textContent = "Enter an amount";
    return;
  }

  let amountIn;
  try {
    amountIn = ethers.parseUnits(input, qmsIn() ? 18 : tokenDecimals(symbol));
  } catch {
    setStatus("swapStatus", "Invalid input amount.");
    $("swapBtn").disabled = true;
    return;
  }

  const amountOut = calculateOut(amountIn, inReserve, outReserve);
  if (amountOut <= 0n) {
    setStatus("swapStatus", "The amount is too small or the output rounds down to zero.");
    $("swapBtn").disabled = true;
    return;
  }

  $("amountOut").value = fmt(amountOut, qmsIn() ? tokenDecimals(symbol) : 18);
  const inDecimals = qmsIn() ? 18 : tokenDecimals(symbol);
               Number(ethers.formatUnits(amountIn, inDecimals));
  $("rate").textContent = `1 ${inSymbol} ≈ ${rate.toLocaleString(undefined,{maximumSignificantDigits:7})} ${outSymbol}`;

  const noFeeOut = amountIn * outReserve / (inReserve + amountIn);
  const impact = noFeeOut > 0n ? Number((noFeeOut - amountOut) * 10000n / noFeeOut) / 100 : 0;
  $("impact").textContent = `${Math.max(0, impact).toFixed(3)}% (estimated, including fees)`;

  const slip = BigInt($("swapSlippage").value || "50");
  const min = amountOut * (10000n - slip) / 10000n;
  $("minOut").textContent = `${fmt(min)} ${outSymbol}`;
  $("swapBtn").disabled = busy;
  $("swapBtn").textContent = signer ? "Swap" : "Connect wallet to Swap";
  setStatus("swapStatus", "The quote is estimated from pool reserves. The actual price may change before the transaction is confirmed.");
}
function symbolsReady() { return symbols.length >= 4 && symbols.every((s) => Boolean(tokenContracts[s])); }

async function readPool(symbol) {
  const p = pools[symbol];
  const [reserves, supply, t0] = await Promise.all([
    p.getReserves(), p.totalSupply(), p.token0()
  ]);
  const wrapperIs0 = t0.toLowerCase() === CFG.wqms.toLowerCase();
  return {
    reserveQms: BigInt(wrapperIs0 ? reserves[0].toString() : reserves[1].toString()),
    reserveToken: BigInt(wrapperIs0 ? reserves[1].toString() : reserves[0].toString()),
    supply: BigInt(supply.toString()),
    token0: t0
  };
}
async function refreshAllPools(silent = true) {
  try {
    const rows = await Promise.all(symbols.map(async (s) => [s, await readPool(s)]));
    for (const [s, state] of rows) poolStates[s] = state;
    updateSwapQuote();
    updateLiquidityView();
    if (!silent) setStatus("swapStatus", "Pool updated on QMS Testnet.", "success");
  } catch (e) {
    if (!silent) setStatus("swapStatus", `Unable to read pool: ${e.shortMessage || e.message}`, "error");
  }
}
async function refreshWallet() {
  if (!account || !walletProvider) return;
  qmsBalance = BigInt((await walletProvider.getBalance(account)).toString());
  const rows = await Promise.all(symbols.map(async (s) => {
    const c = new ethers.Contract(CFG.tokens[s].address, tokenAbi, walletProvider);
    return [s, BigInt((await c.balanceOf(account)).toString())];
  }));
  tokenBalances = Object.fromEntries(rows);
  updateSwapQuote();
  updateLiquidityView();
}
async function switchNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask or a compatible EVM wallet was not found.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chainHex }]
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CFG.chainHex,
        chainName: "QMS Testnet",
        nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
        rpcUrls: [CFG.rpc],
        blockExplorerUrls: [CFG.explorer]
      }]
    });

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chainHex }]
    });
  }
}
async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask or an EVM-compatible wallet is not installed.");
    setStatus("swapStatus", "Requesting wallet connection from MetaMask…");
    await switchNetwork();
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    await walletProvider.send("eth_requestAccounts", []);
    const n = await walletProvider.getNetwork();
    if (n.chainId !== 19480n) throw new Error("Your wallet is not connected to QMS Testnet.");
    signer = await walletProvider.getSigner();
    account = await signer.getAddress();
    $("connectBtn").textContent = short(account);
    await refreshWallet();
    setStatus("swapStatus", `Connected ${short(account)} on QMS Testnet.`, "success");
  } catch (e) {
    setStatus("swapStatus", `Failed to connect wallet: ${e.shortMessage || e.message}`, "error");
    setStatus("liqStatus", `Failed to connect wallet: ${e.shortMessage || e.message}`, "error");
  }
}

async function swap() {
  if (busy) return;
  if (!signer) await connectWallet();
  if (!signer || !account) return;

  busy = true;
  $("swapBtn").disabled = true;
  $("swapTx").hidden = true;
  try {
    await refreshAllPools(true);
    const symbol = currentSymbol();
    const tokenInfo = CFG.tokens[symbol];
    const token = new ethers.Contract(tokenInfo.address, tokenAbi, signer);
    const router = new ethers.Contract(CFG.router, routerAbi, signer);
    const amountIn = ethers.parseUnits($("amountIn").value.trim(), qmsIn() ? 18 : tokenDecimals(symbol));
    if (amountIn <= 0n) throw new Error("Enter a swap amount greater than zero.");

    let outReserveIn, outReserve;
    const state = pairState(symbol);
    if (!state || state.reserveQms === 0n || state.reserveToken === 0n) {
      throw new Error("Pool has no liquidity.");
    }
    outReserveIn = qmsIn() ? state.reserveQms : state.reserveToken;
    outReserve = qmsIn() ? state.reserveToken : state.reserveQms;
    const amountOut = calculateOut(amountIn, outReserveIn, outReserve);
    const minOut = amountOut * (10000n - BigInt($("swapSlippage").value || "50")) / 10000n;
    if (amountOut <= 0n) throw new Error("The output token amount is too small.");

    let tx;
    if (qmsIn()) {
      const balance = BigInt((await walletProvider.getBalance(account)).toString());
      if (balance <= amountIn) throw new Error("Insufficient QMS to swap and pay gas.");
      setStatus("swapStatus", "Simulating QMS → token swap…");
      await router.swapExactQMSForToken.staticCall(tokenInfo.address, minOut, account, { value: amountIn });
      setStatus("swapStatus", "Review and confirm the swap in MetaMask…");
      tx = await router.swapExactQMSForToken(tokenInfo.address, minOut, account, { value: amountIn });
    } else {
      const balance = BigInt((await token.balanceOf(account)).toString());
      if (balance < amountIn) throw new Error(`Insufficient ${symbol} in your wallet.`);
      const allowance = BigInt((await token.allowance(account, CFG.router)).toString());
      if (allowance < amountIn) {
        setStatus("swapStatus", `Confirm the approval for ${symbol} in MetaMask…`);
        const approval = await token.approve(CFG.router, amountIn);
        await approval.wait();
      }
      setStatus("swapStatus", "Simulating token → QMS swap…");
      await router.swapExactTokenForQMS.staticCall(tokenInfo.address, amountIn, minOut, account);
      setStatus("swapStatus", "Review and confirm the swap in MetaMask…");
      tx = await router.swapExactTokenForQMS(tokenInfo.address, amountIn, minOut, account);
    }

    setStatus("swapStatus", `Transaction submitted: ${tx.hash}. Waiting for confirmation…`);
    const receipt = await tx.wait();
    $("swapTx").href = `${CFG.explorer}/tx/${tx.hash}`;
    $("swapTx").textContent = "View transaction on QMSScan ↗";
    $("swapTx").hidden = false;
    await refreshAllPools(true);
    await refreshWallet();
    setStatus("swapStatus", `Swap successful at block ${receipt.blockNumber}.`, "success");
  } catch (e) {
    setStatus("swapStatus", `Swap failed or was not submitted: ${e.shortMessage || e.reason || e.message}`, "error");
  } finally {
    busy = false;
    updateSwapQuote();
  }
}

function updateLiquidityView() {
  if (!symbolsReady()) return;
  const symbol = liqSymbol();
  const state = poolStates[symbol];
  const token = tokenContracts[symbol];
  if (!state) return;

  $("liqPoolAddress").textContent = short(CFG.tokens[symbol].pool);
  $("liqPoolAddress").title = CFG.tokens[symbol].pool;
  $("liqTokenTitle").textContent = symbol;
  $("liqQmsBalance").textContent = account ? `Balance: ${fmt(qmsBalance)} QMS` : "Balance: Connect wallet";
  $("liqTokenBalance").textContent = account ? `Balance: ${fmt(tokenBalances[symbol] || 0n, tokenDecimals(symbol))} ${symbol}` : "Balance: Connect wallet";
  $("liqQmsReserve").textContent = `${fmt(state.reserveQms)} QMS`;
  $("liqTokenReserve").textContent = `${fmt(state.reserveToken, tokenDecimals(symbol))} ${symbol}`;

  if (state.reserveQms > 0n && state.reserveToken > 0n) {
    const ratio = Number(ethers.formatUnits(state.reserveToken, tokenDecimals(symbol))) /
                  Number(ethers.formatUnits(state.reserveQms, 18));
    $("liqRatio").textContent = `1 QMS ≈ ${ratio.toLocaleString(undefined,{maximumSignificantDigits:7})} ${symbol}`;
  } else {
    $("liqRatio").textContent = "Empty pool — choose the initial ratio";
  }
  updateLiquidityEstimate();
}
function updateLiquidityRatio(changed) {
  const state = poolStates[liqSymbol()];
  if (!state || state.reserveQms === 0n || state.reserveToken === 0n) {
    updateLiquidityEstimate();
    return;
  }
  try {
    if (changed === "qms") {
      const q = ethers.parseUnits($("liqQms").value || "0", 18);
      const t = q * state.reserveToken / state.reserveQms;
      $("liqTokenAmount").value = t === 0n ? "" : fmt(t, tokenDecimals(liqSymbol()), 10);
    } else {
      const t = ethers.parseUnits($("liqTokenAmount").value || "0", tokenDecimals(liqSymbol()));
      const q = t * state.reserveQms / state.reserveToken;
      $("liqQms").value = q === 0n ? "" : fmt(q, 18, 10);
    }
  } catch {}
  updateLiquidityEstimate();
}
function estimateLiquidity() {
  const state = poolStates[liqSymbol()];
  if (!state) return null;
  let q, t;
  try {
    q = ethers.parseUnits($("liqQms").value.trim(), 18);
    t = ethers.parseUnits($("liqTokenAmount").value.trim(), tokenDecimals(liqSymbol()));
  } catch { return null; }
  if (q <= 0n || t <= 0n) return null;

  let usedQ = q, usedT = t;
  if (state.supply > 0n && state.reserveQms > 0n && state.reserveToken > 0n) {
    const optT = q * state.reserveToken / state.reserveQms;
    if (optT > 0n && optT <= t) {
      usedT = optT;
    } else {
      usedT = t;
      usedQ = t * state.reserveQms / state.reserveToken;
    }
  }
  let shares;
  if (state.supply === 0n) {
    shares = sqrt(usedQ * usedT);
  } else {
    const a = usedQ * state.supply / state.reserveQms;
    const b = usedT * state.supply / state.reserveToken;
    shares = a < b ? a : b;
  }
  return shares > 0n ? { shares, usedQ, usedT, q, t } : null;
}
function updateLiquidityEstimate() {
  const estimate = estimateLiquidity();
  if (!estimate) {
    $("liqShares").textContent = "Enter both amounts";
    return;
  }
  $("liqShares").textContent =
    `${fmt(estimate.shares)} LP (estimated); using ${fmt(estimate.usedQ, 18)} QMS + ${fmt(estimate.usedT, tokenDecimals(liqSymbol()))} ${liqSymbol()}`;
}
async function addLiquidity() {
  if (busy) return;
  if (!signer) await connectWallet();
  if (!signer || !account) return;

  busy = true;
  $("addLiqBtn").disabled = true;
  $("liqTx").hidden = true;
  try {
    await refreshAllPools(true);
    const symbol = liqSymbol();
    const tokenInfo = CFG.tokens[symbol];
    const state = pairState(symbol);
    const qmsAmount = ethers.parseUnits($("liqQms").value.trim(), 18);
    const tokenAmount = ethers.parseUnits($("liqTokenAmount").value.trim(), tokenDecimals(symbol));
    if (qmsAmount <= 0n || tokenAmount <= 0n) {
      throw new Error("Enter QMS and token amounts greater than zero.");
    }

    const nativeBalance = BigInt((await walletProvider.getBalance(account)).toString());
    if (nativeBalance <= qmsAmount) throw new Error("Insufficient QMS to provide liquidity and pay gas.");
    const token = new ethers.Contract(tokenInfo.address, tokenAbi, signer);
    const tokenBalance = BigInt((await token.balanceOf(account)).toString());
    if (tokenBalance < tokenAmount) throw new Error(`Insufficient ${symbol} in your wallet.`);

    let usedQ = qmsAmount, usedT = tokenAmount;
    if (state.supply > 0n && state.reserveQms > 0n && state.reserveToken > 0n) {
      const optT = qmsAmount * state.reserveToken / state.reserveQms;
      if (optT > 0n && optT <= tokenAmount) usedT = optT;
      else { usedT = tokenAmount; usedQ = tokenAmount * state.reserveQms / state.reserveToken; }
    }
    let expected;
    if (state.supply === 0n) expected = sqrt(usedQ * usedT);
    else {
      const a = usedQ * state.supply / state.reserveQms;
      const b = usedT * state.supply / state.reserveToken;
      expected = a < b ? a : b;
    }
    if (expected <= 0n) throw new Error("Unable to calculate the minimum LP shares.");

    const slip = BigInt($("liqSlippage").value || "50");
    const minShares = expected * (10000n - slip) / 10000n;
    const router = new ethers.Contract(CFG.router, routerAbi, signer);
    const allowance = BigInt((await token.allowance(account, CFG.router)).toString());

    if (allowance < tokenAmount) {
      setStatus("liqStatus", `Review and confirm approval for ${symbol} in MetaMask…`);
      const approval = await token.approve(CFG.router, tokenAmount);
      await approval.wait();
    }

    setStatus("liqStatus", "Simulating Add Liquidity on the blockchain…");
    await router.addLiquidityNative.staticCall(tokenInfo.address, tokenAmount, minShares, account, { value: qmsAmount });

    setStatus("liqStatus", "Simulation successful. Confirm Add Liquidity in MetaMask…");
    const tx = await router.addLiquidityNative(tokenInfo.address, tokenAmount, minShares, account, { value: qmsAmount });
    setStatus("liqStatus", `Submitted ${tx.hash}. Waiting for confirmation…`);
    const receipt = await tx.wait();

    $("liqTx").href = `${CFG.explorer}/tx/${tx.hash}`;
    $("liqTx").textContent = "View transaction on QMSScan ↗";
    $("liqTx").hidden = false;
    await refreshAllPools(true);
    await refreshWallet();
    setStatus("liqStatus", `Liquidity added successfully at block ${receipt.blockNumber}.`, "success");
  } catch (e) {
    setStatus("liqStatus", `Failed to add liquidity: ${e.shortMessage || e.reason || e.message}`, "error");
  } finally {
    busy = false;
    $("addLiqBtn").disabled = false;
  }
}

function showTab(tab) {
  const isSwap = tab === "swap";
  $("swapView").classList.toggle("hidden", !isSwap);
  $("liqView").classList.toggle("hidden", isSwap);
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (isSwap) updateSwapQuote();
  else updateLiquidityView();
}

function populateSelects() {
  for (const id of ["tokenSelect","liqTokenSelect"]) {
    const select = $(id);
    select.innerHTML = symbols.map((s) => `<option value="${s}">${CFG.tokens[s].displayName || s}</option>`).join("");
  }
}
function setupDedicatedPages() {
  const header = document.querySelector(".topbar");
  if (!header) throw new Error("Khong tim thay thanh menu.");

  let nav = header.querySelector(".main-nav");
  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "main-nav";
    nav.innerHTML = `
      <a href="/" data-page="swap">Swap</a>
      <a href="/liquidity.html" data-page="liquidity">Add Liquidity</a>
      <a href="/faucet.html" data-page="faucet">Faucet</a>`;
    const actions = header.querySelector(".top-actions");
    if (!actions) throw new Error("Khong tim thay top-actions.");
    actions.insertAdjacentElement("beforebegin", nav);
  }

  let faucetView = document.getElementById("faucetView");
  if (!faucetView) {
    faucetView = document.createElement("section");
    faucetView.id = "faucetView";
    faucetView.className = "card hidden";
    faucetView.innerHTML = `
      <div class="card-head">
        <div>
          <h2>Faucet</h2>
          <div class="subtle">Nhan token thu nghiem vao vi QMS Testnet</div>
        </div>
        <button class="btn" id="faucetRefreshBtn" type="button">Refresh</button>
      </div>
      <p class="subtle" id="faucetStatus">Connect your wallet to view your balance and claim tokens.</p>
      <div id="faucetCards" class="faucet-grid"></div>
      <div class="faucet-warning">
        TESTNET ONLY — cac token nay la token mo phong do QMSwap phat hanh,
        These are not real assets and are not backed by real assets.
      </div>`;
    $("liqView").insertAdjacentElement("afterend", faucetView);
  }

  const style = document.createElement("style");
  style.textContent = `
    .main-nav{display:flex;align-items:center;gap:8px;margin:0 auto;padding:0 18px}
    .main-nav a{display:inline-flex;align-items:center;padding:10px 13px;border-radius:10px;
      color:var(--muted,#a5a5bd);text-decoration:none;font-weight:600;white-space:nowrap}
    .main-nav a:hover{background:rgba(130,130,180,.12);color:var(--text,#fff)}
    .main-nav a.active{background:rgba(125,100,255,.18);color:var(--text,#fff)}
    .tabs{display:none!important}
    .faucet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
    .faucet-token-card{min-width:0;border:1px solid rgba(140,140,180,.24);border-radius:16px;
      padding:18px;background:rgba(100,100,145,.06)}
    .faucet-token-title{font-size:18px;font-weight:700;margin-bottom:8px}
    .faucet-token-address{font-size:11px;opacity:.7;overflow-wrap:anywhere;margin:8px 0}
    .faucet-balance{font-size:13px;margin:10px 0}
    .faucet-claim-btn{width:100%;padding:11px;border:0;border-radius:10px;
      background:linear-gradient(100deg,#7257ff,#5b75ff);color:white;font-weight:700;cursor:pointer}
    .faucet-claim-btn:disabled{opacity:.55;cursor:wait}
    .faucet-token-status{font-size:12px;min-height:32px;margin-top:10px;overflow-wrap:anywhere}
    .faucet-warning{margin-top:18px;font-size:12px;line-height:1.6;opacity:.75}
    @media(max-width:760px){.topbar{flex-wrap:wrap}.main-nav{order:3;width:100%;justify-content:center;padding:8px 0}
      .main-nav a{padding:9px 10px;font-size:13px}.faucet-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const path = window.location.pathname.toLowerCase();
  const page = path.endsWith("/faucet.html") ? "faucet" :
    path.endsWith("/liquidity.html") ? "liquidity" : "swap";

  $("swapView").classList.toggle("hidden", page !== "swap");
  $("liqView").classList.toggle("hidden", page !== "liquidity");
  faucetView.classList.toggle("hidden", page !== "faucet");

  nav.querySelectorAll("a[data-page]").forEach(a => {
    a.classList.toggle("active", a.dataset.page === page);
    if (a.dataset.page === page) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  });

  document.title = page === "faucet" ? "QMSwap — Faucet" :
    page === "liquidity" ? "QMSwap — Add Liquidity" : "QMSwap — Swap";

  renderFaucetCards();
  $("faucetRefreshBtn").onclick = refreshFaucetBalances;
}

function renderFaucetCards() {
  const root = $("faucetCards");
  if (!root) return;

  root.replaceChildren();

  for (const symbol of symbols) {
    const info = CFG.tokens[symbol];
    const card = document.createElement("article");
    card.className = "faucet-token-card";
    card.dataset.faucetSymbol = symbol;

    const title = document.createElement("div");
    title.className = "faucet-token-title";
    title.textContent = info.displayName || symbol;

    const address = document.createElement("div");
    address.className = "faucet-token-address";
    address.textContent = info.address || "Chua co dia chi token";

    const balance = document.createElement("div");
    balance.className = "faucet-balance";
    balance.textContent = "Balance: connect wallet";

    const claim = document.createElement("button");
    claim.className = "faucet-claim-btn";
    claim.type = "button";
    claim.textContent = "Nhan " + symbol;
    claim.addEventListener("click", () => claimTestFaucet(symbol, claim, card));

    const status = document.createElement("div");
    status.className = "faucet-token-status";
    status.setAttribute("role","status");

    card.append(title, address, balance, claim, status);
    root.appendChild(card);
  }
}

const faucetAbi = [
  "function faucet() returns (uint256)",
  "function faucetAmount() view returns (uint256)",
  "function nextClaimAt(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

async function refreshFaucetBalances() {
  const root = $("faucetCards");
  if (!root) return;

  if (!account) {
    root.querySelectorAll(".faucet-balance").forEach(e => {
      e.textContent = "Balance: please connect your wallet";
    });
    return;
  }

  for (const symbol of symbols) {
    try {
      const info = CFG.tokens[symbol];
      const token = new ethers.Contract(info.address, faucetAbi, provider);
      const balance = await token.balanceOf(account);
      const card = root.querySelector(`[data-faucet-symbol="${symbol}"]`);
      const label = card?.querySelector(".faucet-balance");
      if (label) label.textContent =
        "So du: " + fmt(balance, tokenDecimals(symbol), 8) + " " + symbol;
    } catch (e) {
      const card = root.querySelector(`[data-faucet-symbol="${symbol}"]`);
      const label = card?.querySelector(".faucet-balance");
      if (label) label.textContent = "Could not read token balance.";
    }
  }
}

async function claimTestFaucet(symbol, button, card) {
  const status = card.querySelector(".faucet-token-status");
  button.disabled = true;

  try {
    if (!account || !signer) await connectWallet();
    if (!account || !signer) throw new Error("Please connect MetaMask first.");

    const network = await signer.provider.getNetwork();
    if (network.chainId !== 19480n) throw new Error("Hay chuyen MetaMask sang QMS Testnet.");

    const info = CFG.tokens[symbol];
    const token = new ethers.Contract(info.address, faucetAbi, signer);
    const [nextAt, amount] = await Promise.all([
      token.nextClaimAt(account),
      token.faucetAmount()
    ]);

    const block = await provider.getBlock("latest");
    const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));

    if (BigInt(nextAt) > now) {
      const mins = Math.ceil(Number(BigInt(nextAt) - now) / 60);
      throw new Error("This wallet has already claimed tokens. Try again in about " + mins + " phut.");
    }

    status.textContent = "Hay xac nhan Faucet " + symbol + " trong MetaMask...";
    const tx = await token.faucet();

    status.textContent = "Da gui giao dich " + tx.hash + ". Dang cho xac nhan...";
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Faucet transaction failed.");

    status.textContent = "Successfully claimed " +
      fmt(amount, tokenDecimals(symbol), 8) + " " + symbol + " (token test).";

    await refreshFaucetBalances();
    try { await refreshWallet(); } catch {}
  } catch (e) {
    status.textContent = "Faucet failed: " +
      (e.shortMessage || e.reason || e.message || String(e));
  } finally {
    button.disabled = false;
  }
}
async function init() {
  try {
    await loadDeploymentConfig();
    populateSelects();
    setupDedicatedPages();
    for (const symbol of symbols) {
      tokenContracts[symbol] = new ethers.Contract(CFG.tokens[symbol].address, tokenAbi, provider);
      pools[symbol] = new ethers.Contract(CFG.tokens[symbol].pool, poolAbi, provider);
    }

    await refreshAllPools(false);
    const empty = symbols.filter((s) => !poolStates[s] || poolStates[s].reserveQms === 0n || poolStates[s].reserveToken === 0n);
    if (empty.length) {
      setStatus("swapStatus", `Pool has no liquidity: ${empty.join(", ")}. Go to Add Liquidity to set the initial price.`);
    }
    updateLiquidityView();
    await refreshFaucetBalances();
  } catch (e) {
    setStatus("swapStatus", `Failed to initialize the interface: ${e.shortMessage || e.message}`, "error");
    setStatus("liqStatus", `Failed to initialize the interface: ${e.shortMessage || e.message}`, "error");
  }
}

$("connectBtn").addEventListener("click", connectWallet);
$("swapBtn").addEventListener("click", swap);
$("addLiqBtn").addEventListener("click", addLiquidity);
$("refreshBtn").addEventListener("click", () => refreshAllPools(false));
$("refreshLiqBtn").addEventListener("click", async () => { await refreshAllPools(false); await refreshWallet(); });
$("tokenSelect").addEventListener("change", async () => { await refreshAllPools(true); updateSwapQuote(); });
$("liqTokenSelect").addEventListener("change", () => updateLiquidityView());
$("amountIn").addEventListener("input", updateSwapQuote);
$("swapSlippage").addEventListener("change", updateSwapQuote);
$("liqSlippage").addEventListener("change", updateLiquidityEstimate);
$("flipBtn").addEventListener("click", () => {
  direction = qmsIn() ? "TOKEN_TO_QMS" : "QMS_TO_TOKEN";
  updateSwapQuote();
});
$("maxBtn").addEventListener("click", () => {
  if (!account) return setStatus("swapStatus", "Connect your wallet first.");
  $("amountIn").value = fmt(qmsIn() ? qmsBalance : (tokenBalances[currentSymbol()] || 0n), qmsIn() ? 18 : tokenDecimals(currentSymbol()), 8);
  updateSwapQuote();
});
$("liqQms").addEventListener("input", () => updateLiquidityRatio("qms"));
$("liqTokenAmount").addEventListener("input", () => updateLiquidityRatio("token"));
$("liqMaxQms").addEventListener("click", () => {
  if (!account) return setStatus("liqStatus", "Connect your wallet first.");
  $("liqQms").value = fmt(qmsBalance, 18, 8);
  updateLiquidityRatio("qms");
});
$("liqMaxToken").addEventListener("click", () => {
  if (!account) return setStatus("liqStatus", "Connect your wallet first.");
  $("liqTokenAmount").value = fmt(tokenBalances[liqSymbol()] || 0n, tokenDecimals(liqSymbol()), 8);
  updateLiquidityRatio("token");
});
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
await init();

if (window.ethereum) {
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length) {
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      if (BigInt(chain) === 19480n) {
        walletProvider = new ethers.BrowserProvider(window.ethereum);
        signer = await walletProvider.getSigner(accounts[0]);
        account = await signer.getAddress();
        $("connectBtn").textContent = short(account);
        await refreshWallet();
      }
    }
  } catch {}
}
setInterval(() => refreshAllPools(true), 15000);