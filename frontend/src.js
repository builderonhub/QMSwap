import { ethers } from "ethers";
import poolAbi from "./src/abis/QMSwapPool.json";
import tokenAbi from "./src/abis/TestToken.json";

const CFG = {
  chainId: 19480,
  chainIdHex: "0x4c18",
  rpc: "https://rpc.testnet.qms.finance",
  explorer: "https://testnet.qmsscan.io",
  token0: "0xC44dcB6DeDE7A8f1d79F7f4D9fc65a9a0C81E67f",
  token1: "0xf7c438924364a467eDDc96D9fFe78caA2f8E26DE",
  pool: "0x198D92e18aF4ca620F3a183E470c27A3acAAa099"
};

const $ = (q) => document.querySelector(q);
const app = $("#app");

app.innerHTML = `
  <header class="topbar">
    <div class="brand"><div class="logo">↗</div><div>QM<span>Swap</span></div></div>
    <div class="top-actions">
      <div class="network-chip">● &nbsp; QMS TESTNET</div>
      <a class="wallet-btn" id="openLiquidityBtn" href="/liquidity.html">+ Add Liquidity</a>
      <button class="wallet-btn" id="connectBtn">Connect Wallet</button>
    </div>
  </header>
  <main class="page">
    <section class="intro">
      <div class="eyebrow">Decentralized Exchange</div>
      <h1>Swap tokens instantly.</h1>
      <p>Choose a token, enter an amount, and instantly see the estimated amount received.</p>
    </section>
    <section class="swap-card">
      <div class="card-head">
        <div><h2>Swap</h2><div class="subtle" style="margin-top:5px">Trade tokens from your wallet</div></div>
        <button class="icon-btn" id="refreshBtn" title="Refresh reserves">↻</button>
      </div>
      <div class="amount-panel">
        <div class="panel-top"><span>You pay</span><span id="fromBalance">Balance: —</span></div>
        <div class="amount-line">
          <input class="amount-input" id="amountIn" inputmode="decimal" autocomplete="off" placeholder="0.0" value="1">
          <button class="token-pill" id="fromToken">TOKEN A</button>
        </div>
        <div class="balance-line"><span>From pool</span><span id="fromPool">—</span></div>
        <div class="balance-line"><span></span><span><button class="max-btn" id="maxBtn">MAX</button></span></div>
      </div>
      <div class="switch-wrap"><button class="switch-btn" id="flipBtn" title="Reverse swap direction">↕</button></div>
      <div class="amount-panel">
        <div class="panel-top"><span>You receive (estimated)</span><span id="toBalance">Balance: —</span></div>
        <div class="amount-line">
          <input class="amount-input" id="amountOut" placeholder="0.0" readonly>
          <button class="token-pill" id="toToken">TOKEN B</button>
        </div>
        <div class="balance-line"><span>From pool</span><span id="toPool">—</span></div>
      </div>
      <div class="quote-box">
        <div class="quote-row"><span>Rate</span><strong id="rateText">Loading pool…</strong></div>
        <div class="quote-row"><span>Pool fee</span><strong id="feeText">—</strong></div>
        <div class="quote-row"><span>Slippage tolerance</span>
          <select id="slippage" style="background:#242033;color:#eee;border:1px solid #383348;padding:5px 8px;border-radius:9px">
            <option value="10">0.1%</option><option value="50" selected>0.5%</option><option value="100">1.0%</option>
          </select>
        </div>
        <div class="quote-row"><span>Minimum received</span><strong id="minOutText">—</strong></div>
        <div class="quote-row"><span>Pool contract</span><strong id="poolShort">—</strong></div>
      </div>
      <button class="primary" id="swapBtn" disabled>Enter an amount</button>
      <div class="status" id="status" role="status">Connecting to QMS Testnet to retrieve pool prices…</div>
      <a class="tx-link" id="txLink" target="_blank" rel="noopener noreferrer" hidden></a>
    </section>
    <div class="notice"><strong>Testnet only.</strong> Tokens A and B are project test tokens, not official QMS assets. The displayed price is estimated from pool reserves and may change before the transaction is confirmed.</div>
    <div class="footer">QMSwap · AMM test interface · Always verify transaction details in your wallet.</div>
  </main>`;

const rpcProvider = new ethers.JsonRpcProvider(CFG.rpc);
let poolRead = new ethers.Contract(CFG.pool, poolAbi, rpcProvider);
let signer = null;
let walletProvider = null;
let account = "";
let tokens = [];
let reserves = [0n, 0n];
let userBalances = [0n, 0n];
let activeInIndex = 0;
let feeBps = 30n;
let currentQuote = null;
let busy = false;

function hasMethod(contract, name) {
  return contract.interface.fragments.some(
    (f) => f.type === "function" && f.name === name
  );
}
function shortAddress(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}
function cleanAmount(raw, decimals, maxDecimals = 7) {
  let s = ethers.formatUnits(raw, decimals);
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1 + maxDecimals);
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") || "0";
}
function setStatus(message, kind = "") {
  $("#status").textContent = message;
  $("#status").className = "status" + (kind ? ` ${kind}` : "");
}
function pairIndices() {
  return [activeInIndex, 1 - activeInIndex];
}
function activeReserves() {
  const [i, o] = pairIndices();
  return { reserveIn: reserves[i], reserveOut: reserves[o], i, o };
}
function calculateQuote(amountIn) {
  const { reserveIn, reserveOut } = activeReserves();
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return null;
  if (feeBps < 0n || feeBps >= 10000n) return null;
  const amountInAfterFee = amountIn * (10000n - feeBps);
  const amountOut =
    (amountInAfterFee * reserveOut) /
    (reserveIn * 10000n + amountInAfterFee);
  return amountOut > 0n ? { amountIn, amountOut } : null;
}
function updateQuote() {
  currentQuote = null;
  if (tokens.length !== 2) {
    $("#amountOut").value = "";
    return;
  }

  const { reserveIn, reserveOut, i, o } = activeReserves();
  $("#fromPool").textContent = cleanAmount(reserveIn, tokens[i].decimals, 5);
  $("#toPool").textContent = cleanAmount(reserveOut, tokens[o].decimals, 5);
  $("#feeText").textContent = `${Number(feeBps) / 100}%`;

  if (reserveIn > 0n && reserveOut > 0n) {
    const inUnits = Number(ethers.formatUnits(reserveIn, tokens[i].decimals));
    const outUnits = Number(ethers.formatUnits(reserveOut, tokens[o].decimals));
    const rate = outUnits / inUnits;
    $("#rateText").textContent = Number.isFinite(rate)
      ? `1 ${tokens[i].symbol} ≈ ${rate.toLocaleString(undefined, { maximumSignificantDigits: 7 })} ${tokens[o].symbol}`
      : "—";
  } else {
    $("#rateText").textContent = "Pool has no liquidity";
  }

  const value = $("#amountIn").value.trim();
  if (!value) {
    $("#amountOut").value = "";
    $("#minOutText").textContent = "—";
    syncSwapButton();
    return;
  }

  let amountIn;
  try {
    amountIn = ethers.parseUnits(value, tokens[i].decimals);
    if (amountIn <= 0n) throw new Error("Please enter an amount greater than zero.");
  } catch {
    $("#amountOut").value = "";
    $("#minOutText").textContent = "—";
    syncSwapButton();
    return;
  }

  const quote = calculateQuote(amountIn);
  if (!quote) {
    $("#amountOut").value = "";
    $("#minOutText").textContent = "—";
    syncSwapButton();
    return;
  }

  currentQuote = quote;
  $("#amountOut").value = cleanAmount(quote.amountOut, tokens[o].decimals, 9);
  const slipBps = BigInt($("#slippage").value || "50");
  const minimum = quote.amountOut * (10000n - slipBps) / 10000n;
  $("#minOutText").textContent =
    `${cleanAmount(minimum, tokens[o].decimals, 8)} ${tokens[o].symbol}`;
  syncSwapButton();
}
function syncTokenLabels() {
  if (tokens.length !== 2) return;
  const [i, o] = pairIndices();
  $("#fromToken").innerHTML = `<span class="token-icon">${i === 0 ? "A" : "B"}</span>${tokens[i].symbol}⌄`;
  $("#toToken").innerHTML = `<span class="token-icon">${o === 0 ? "A" : "B"}</span>${tokens[o].symbol}⌄`;
  $("#fromBalance").textContent = account
    ? `Balance: ${cleanAmount(userBalances[i], tokens[i].decimals, 5)}`
    : "Balance: —";
  $("#toBalance").textContent = account
    ? `Balance: ${cleanAmount(userBalances[o], tokens[o].decimals, 5)}`
    : "Balance: —";
}
function syncSwapButton() {
  const button = $("#swapBtn");
  if (busy) {
    button.disabled = true;
    button.textContent = "Processing…";
  } else if (!currentQuote) {
    button.disabled = true;
    button.textContent = tokens.length === 2 && reserves.every((r) => r > 0n)
      ? "Enter an amount"
      : "Pool needs liquidity";
  } else {
    button.disabled = false;
    button.textContent = signer ? "Swap" : "Connect wallet to Swap";
  }
}
async function loadToken(address) {
  const c = new ethers.Contract(address, tokenAbi, rpcProvider);
  const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()]);
  return { address, symbol: String(symbol), decimals: Number(decimals) };
}
async function refreshReserves(silent = false) {
  try {
    if (tokens.length !== 2) return;
    const c0 = new ethers.Contract(tokens[0].address, tokenAbi, rpcProvider);
    const c1 = new ethers.Contract(tokens[1].address, tokenAbi, rpcProvider);
    const [r0, r1] = await Promise.all([
      c0.balanceOf(CFG.pool), c1.balanceOf(CFG.pool)
    ]);
    reserves = [BigInt(r0.toString()), BigInt(r1.toString())];

    if (hasMethod(poolRead, "FEE_BPS")) {
      const rawFee = await poolRead.getFunction("FEE_BPS")();
      feeBps = BigInt(rawFee.toString());
    }
    syncTokenLabels();
    updateQuote();
    if (!silent) setStatus("Reserves and quotes updated from QMS Testnet.");
  } catch (e) {
    if (!silent) setStatus(`Unable to load pool reserves: ${e.shortMessage || e.message}`, "error");
  }
}
async function refreshUserBalances() {
  if (!account || tokens.length !== 2) return;
  const balances = await Promise.all(tokens.map(async (t) => {
    const c = new ethers.Contract(t.address, tokenAbi, walletProvider);
    return BigInt((await c.balanceOf(account)).toString());
  }));
  userBalances = balances;
  syncTokenLabels();
}
async function addOrSwitchNetwork() {
  if (!window.ethereum) throw new Error("MetaMask or a compatible EVM wallet was not found.");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chainIdHex }]
    });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CFG.chainIdHex,
        chainName: "QMS Testnet",
        nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
        rpcUrls: [CFG.rpc],
        blockExplorerUrls: [CFG.explorer]
      }]
    });
  }
}
async function connectWallet() {
  try {
    await addOrSwitchNetwork();
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    await walletProvider.send("eth_requestAccounts", []);
    const network = await walletProvider.getNetwork();
    if (network.chainId !== BigInt(CFG.chainId)) {
      throw new Error("Your wallet is not connected to QMS Testnet.");
    }
    signer = await walletProvider.getSigner();
    account = await signer.getAddress();
    $("#connectBtn").textContent = shortAddress(account);
    await refreshUserBalances();
    updateQuote();
    setStatus(`Wallet connected: ${shortAddress(account)} on QMS Testnet.`);
  } catch (e) {
    setStatus(`Failed to connect wallet: ${e.shortMessage || e.message}`, "error");
  }
}
function findSwapFunction(contract) {
  const fragments = contract.interface.fragments.filter(
    (f) => f.type === "function" && /swap/i.test(f.name)
  );
  return fragments.find((f) => f.name.toLowerCase() === "swap") || fragments[0] || null;
}
async function executeSwap() {
  if (busy) return;
  if (!signer) {
    await connectWallet();
    return;
  }
  try {
    busy = true;
    $("#txLink").hidden = true;
    syncSwapButton();

    await refreshReserves(true);
    const [i, o] = pairIndices();
    const amountText = $("#amountIn").value.trim();
    const amountIn = ethers.parseUnits(amountText, tokens[i].decimals);
    const quote = calculateQuote(amountIn);
    if (!quote) throw new Error("No quote available. Check the pool's liquidity.");

    if (amountIn > userBalances[i]) {
      throw new Error(`Insufficient ${tokens[i].symbol} balance in your wallet.`);
    }

    const slipBps = BigInt($("#slippage").value || "50");
    const minAmountOut = quote.amountOut * (10000n - slipBps) / 10000n;

    const poolWithSigner = new ethers.Contract(CFG.pool, poolAbi, signer);
    const fragment = findSwapFunction(poolWithSigner);
    if (!fragment) {
      throw new Error("The ABI does not contain a swap function. The transaction was not submitted.");
    }

    const numericIndexes = fragment.inputs
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => p.type.startsWith("uint") || p.type.startsWith("int"))
      .map(({ index }) => index);

    let minIndex = fragment.inputs.findIndex((p) =>
      /min|minimum/i.test(p.name || "")
    );
    if (minIndex < 0 && numericIndexes.length >= 2) {
      minIndex = numericIndexes[1];
    }
    if (minIndex < 0) {
      throw new Error("The swap function does not support a minimum output parameter. The transaction was not submitted for safety.");
    }

    let numericCount = 0;
    const args = fragment.inputs.map((p, index) => {
      const name = (p.name || "").toLowerCase();
      if (p.type === "address") {
        if (/recipient|receiver|(^to$)|useraddress/.test(name)) return account;
        return tokens[i].address;
      }
      if (p.type === "bool") return i === 0;
      if (p.type.startsWith("uint") || p.type.startsWith("int")) {
        if (index === minIndex) return minAmountOut;
        if (/deadline/.test(name)) return BigInt(Math.floor(Date.now() / 1000) + 1200);
        numericCount++;
        return amountIn;
      }
      throw new Error(`The swap function parameter type ${p.type} is not supported; the transaction was not submitted.`);
    });

    const tokenWithSigner = new ethers.Contract(tokens[i].address, tokenAbi, signer);
    const allowance = BigInt((await tokenWithSigner.allowance(account, CFG.pool)).toString());
    if (allowance < amountIn) {
      setStatus(`Confirm the approval transaction for ${tokens[i].symbol} in your wallet…`);
      const approval = await tokenWithSigner.approve(CFG.pool, amountIn);
      await approval.wait();
    }

    setStatus("Confirm the swap transaction in your wallet…");
    const method = poolWithSigner.getFunction(fragment.format("sighash"));
    const tx = await method(...args);
    setStatus(`Transaction submitted: ${tx.hash}. Waiting for confirmation…`);
    await tx.wait();

    $("#txLink").href = `${CFG.explorer}/tx/${tx.hash}`;
    $("#txLink").textContent = "View transaction on QMSScan ↗";
    $("#txLink").hidden = false;

    await refreshUserBalances();
    await refreshReserves(true);
    setStatus(`Swap successful: ${cleanAmount(quote.amountIn, tokens[i].decimals)} ${tokens[i].symbol} → approximately ${cleanAmount(quote.amountOut, tokens[o].decimals)} ${tokens[o].symbol}.`);
  } catch (e) {
    setStatus(`Swap unsuccessful: ${e.shortMessage || e.reason || e.message}`, "error");
  } finally {
    busy = false;
    syncSwapButton();
  }
}

$("#connectBtn").addEventListener("click", connectWallet);
$("#swapBtn").addEventListener("click", executeSwap);
$("#amountIn").addEventListener("input", updateQuote);
$("#slippage").addEventListener("change", updateQuote);
$("#flipBtn").addEventListener("click", () => {
  activeInIndex = 1 - activeInIndex;
  syncTokenLabels();
  updateQuote();
});
$("#fromToken").addEventListener("click", () => {
  activeInIndex = 1 - activeInIndex;
  syncTokenLabels();
  updateQuote();
});
$("#toToken").addEventListener("click", () => {
  activeInIndex = 1 - activeInIndex;
  syncTokenLabels();
  updateQuote();
});
$("#maxBtn").addEventListener("click", () => {
  if (!account || tokens.length !== 2) {
    setStatus("Please connect your wallet to use MAX.");
    return;
  }
  const [i] = pairIndices();
  $("#amountIn").value = ethers.formatUnits(userBalances[i], tokens[i].decimals);
  updateQuote();
});
$("#refreshBtn").addEventListener("click", () => refreshReserves(false));

async function init() {
  try {
    let token0Address = CFG.token0;
    let token1Address = CFG.token1;
    if (hasMethod(poolRead, "token0")) token0Address = await poolRead.getFunction("token0")();
    if (hasMethod(poolRead, "token1")) token1Address = await poolRead.getFunction("token1")();

    tokens = await Promise.all([loadToken(token0Address), loadToken(token1Address)]);
    $("#poolShort").textContent = shortAddress(CFG.pool);
    $("#poolShort").title = CFG.pool;
    syncTokenLabels();

    if (hasMethod(poolRead, "FEE_BPS")) {
      const rawFee = await poolRead.getFunction("FEE_BPS")();
      feeBps = BigInt(rawFee.toString());
    }
    await refreshReserves(true);
    if (reserves[0] === 0n || reserves[1] === 0n) {
      setStatus("RPC connected, but the pool does not have enough liquidity to provide a quote.");
    } else {
      setStatus("Quotes update automatically from pool reserves. Connect your wallet to trade.");
    }
    syncSwapButton();
  } catch (e) {
    setStatus(`Unable to read contract: ${e.shortMessage || e.message}`, "error");
  }
}
if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
init();
setInterval(() => refreshReserves(true), 15000);