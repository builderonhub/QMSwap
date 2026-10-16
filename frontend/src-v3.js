import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.qms.finance";
const CHAIN_ID = 19480n;
const CHAIN_HEX = "0x4c18";
const ZERO = "0x0000000000000000000000000000000000000000";
const EXPLORER = "https://testnet.qmsscan.io";

const $ = (id) => document.getElementById(id);
const rpc = new ethers.JsonRpcProvider(RPC_URL, 19480);

const QWAP_ROUTER_ADDRESS = "0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619";
const QWAP_FACTORY_ADDRESS = "0x93AFD9aC50822F82c7C4f2Ec8Ec2463b086Fb878";
const QWAP_WRAPPED_NATIVE_ADDRESS = "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34";

const QWAP_TOKEN_ASSETS = Object.freeze({
  QWAP_USDC: {
    address: "0xDfF68E53a0A8275212927c12017f5aB5f1842a04",
    symbol: "USDC",
    decimals: 6,
    displayName: "USDC (QWAP)"
  },
  QWAP_WETH: {
    address: "0x9aff7FEe3C9C0599ca9d8F88C1f23A8dbB002325",
    symbol: "WETH",
    decimals: 18,
    displayName: "WETH (QWAP Testnet)"
  },
  QWAP_USDT: {
    address: "0x72577544f4134a25E7f09d0B5FF0ca05A1249EbF",
    symbol: "USDT",
    decimals: 6,
    displayName: "USDT (QWAP)"
  },
  QWAP_WBTC: {
    address: "0xD0d47E0BFFfdF57d79DC42B03a0aF31e608EF2c6",
    symbol: "WBTC",
    decimals: 8,
    displayName: "WBTC (QWAP)"
  },
  QWAP_WQMS: {
    address: "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",
    symbol: "WQMS",
    decimals: 18,
    displayName: "WQMS (QWAP)"
  }
});

const qwapRouterAbi = [
  "function factory() view returns (address)",
  "function WQMS() view returns (address)",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
  "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256,uint256,address[],address,uint256) returns (uint256[])"
];

let CFG;
let walletProvider = null;
let signer = null;
let account = "";
let quoteOutRaw = 0n;
let liquiditySharesRaw = 0n;
let busy = false;
const balances = {};

const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function faucet() returns (uint256)",
  "function faucetAmount() view returns (uint256)",
  "function adminFaucetAmount() view returns (uint256)",
  "function nextClaimAt(address) view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)"
];

const factoryAbi = [
  "function getPair(address,address) view returns (address)",
  "function allPairsLength() view returns (uint256)"
];

const pairAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint256,uint256)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function previewLiquidity(uint256,uint256) view returns (uint256)",
  "function getAmountOut(address,uint256) view returns (uint256)"
];

const routerAbi = [
  "function factory() view returns (address)",
  "function wrappedNative() view returns (address)",
  "function feeBps() view returns (uint256)",
  "function getPair(address,address) view returns (address)",
  "function quoteOut(address,address,uint256) view returns (uint256)",
  "function previewLiquidity(address,address,uint256,uint256) view returns (uint256)",
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address) returns (uint256)",
  "function addLiquidityNative(address,uint256,uint256,uint256,address) payable returns (uint256)",
  "function swapExactTokensForTokens(address,address,uint256,uint256,uint256,address) returns (uint256)",
  "function swapExactQMSForTokens(address,uint256,uint256,address) payable returns (uint256)",
  "function swapExactTokensForQMS(address,uint256,uint256,uint256,address) returns (uint256)"
];

let factoryRead;
let routerRead;
let qwapRouterRead;

function asset(key) {
  return CFG?.tokens?.[key] || QWAP_TOKEN_ASSETS[key];
}

function assetKeys(page = getPage()) {
  const local = ["QMS","USDT","USDC","ETH","BTC","BNB"]
    .filter(key => CFG?.tokens?.[key]);

  return page === "swap"
    ? [...local, ...Object.keys(QWAP_TOKEN_ASSETS)]
    : local;
}
function tokenDecimals(key) {
  return Number(asset(key).decimals ?? 18);
}

function shortAddress(value) {
  return value ? `${value.slice(0,6)}…${value.slice(-4)}` : "";
}

function fmt(value, decimals=18, maxFraction=8) {
  let result = ethers.formatUnits(value,decimals);
  const parts = result.split(".");
  if (parts.length === 1) return result;
  const frac = parts[1].slice(0,maxFraction).replace(/0+$/,"");
  return frac ? `${parts[0]}.${frac}` : parts[0];
}

function parseAmount(value,key) {
  if (!value || !String(value).trim()) return 0n;
  return ethers.parseUnits(String(value).trim(),tokenDecimals(key));
}

function errorText(err) {
  const values = [
    err?.info?.error?.message,
    err?.info?.error?.data?.message,
    err?.error?.message,
    err?.error?.data?.message,
    err?.reason,
    err?.shortMessage,
    err?.message
  ].filter(x => typeof x === "string" && x.trim());

  const unique = [...new Set(values)];
  return unique.join(" | ").slice(0,1000) || "Unable to retrieve error details from RPC.";
}

function setStatus(message,type="") {
  const el = $("status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function makeOptions(selected) {
  return assetKeys().map(key =>
    `<option value="${key}" ${key===selected ? "selected" : ""}>${asset(key).displayName}</option>`
  ).join("");
}

function shell(page,content) {
  $("app").innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="/">
          <span class="brand-mark">Q</span>
          <span>QMSwap</span>
        </a>
        <nav class="main-nav">
          <a href="/" data-page="swap" class="${page==="swap"?"active":""}">Swap</a>
          <a href="/liquidity.html" data-page="liquidity" class="${page==="liquidity"?"active":""}">Add Liquidity</a>
          <a href="/faucet.html" data-page="faucet" class="${page==="faucet"?"active":""}">Faucet</a>
          <a href="/portfolio.html" data-page="portfolio" class="${page==="portfolio"?"active":""}">Portfolio</a>
          <a href="/history.html" data-page="history" class="${page==="history"?"active":""}">History</a>
        </nav>
        <div class="top-actions">
          <span class="network-pill"><span class="dot"></span> QMS Testnet</span>
          <button class="wallet-btn" id="connectBtn">Connect Wallet</button>
        </div>
      </header>
      <main class="main">${content}</main>
      <footer class="footer">QMSwap · 0.30% swap fee</footer>
    </div>`;

  $("connectBtn").addEventListener("click",() => connectWallet(true));
}

function renderSwap() {
  shell("swap",`
    <section class="intro">
      <div class="eyebrow">SWAP</div>
      <h1>Swap tokens instantly.</h1>
      <p>Choose any asset to swap directly for another asset.</p>
    </section>
    <section class="card swap-card">
      <div class="section-title">
        <div><h2>Swap</h2><p>Trade directly between two assets.</p></div>
        <button class="icon-btn" id="refreshBtn" title="Refresh">↻</button>
      </div>
      <div class="amount-box">
        <div class="amount-label"><span>From</span><span id="fromBalance">Balance: —</span></div>
        <div class="amount-row">
          <input id="amountIn" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0">
          <select id="fromSelect" class="token-select">${makeOptions("QMS")}</select>
        </div>
      </div>
      <div class="flip-row"><button id="flipBtn" class="flip-btn" title="Reverse direction">↓↑</button></div>
      <div class="amount-box">
        <div class="amount-label"><span>To (estimated)</span><span id="toBalance">Balance: —</span></div>
        <div class="amount-row">
          <input id="amountOut" type="text" placeholder="0.0" readonly>
          <select id="toSelect" class="token-select">${makeOptions("USDT")}</select>
        </div>
      </div>
      <div class="quote-box">
        <div class="quote-line"><span>Pool</span><strong id="poolInfo">Select a trading pair</strong></div>
        <div class="quote-line"><span>Minimum received</span><strong id="minReceived">—</strong></div>
        <div class="quote-line"><span>Slippage</span>
          <select id="slippage" class="small-select">
            <option value="50" selected>0.5%</option>
            <option value="100">1%</option>
            <option value="300">3%</option>
          </select>
        </div>
      </div>
      <button id="swapBtn" class="primary-btn">Swap</button>
      <div id="status" class="status" role="status">Enter an amount to get a quote.</div>
      <a id="txLink" class="tx-link" target="_blank" rel="noopener noreferrer" hidden></a>
    </section>`);
  bindSwap();
}

function renderLiquidity() {
  shell("liquidity",`
    <section class="intro">
      <div class="eyebrow">LIQUIDITY</div>
      <h1>Provide liquidity.</h1>
      <p>Choose any two assets. Each pair has its own pool and exchange rate.</p>
    </section>
    <section class="card liquidity-card">
      <div class="section-title">
        <div><h2>Add Liquidity</h2><p>Add two assets to the same pool.</p></div>
        <button class="icon-btn" id="refreshBtn" title="Refresh">↻</button>
      </div>
      <div class="amount-box">
        <div class="amount-label"><span>Token A</span><span id="balanceA">Balance: —</span></div>
        <div class="amount-row">
          <input id="amountA" type="text" inputmode="decimal" placeholder="0.0">
          <select id="tokenA" class="token-select">${makeOptions("QMS")}</select>
        </div>
      </div>
      <div class="liquidity-link"><span>+</span></div>
      <div class="amount-box">
        <div class="amount-label"><span>Token B</span><span id="balanceB">Balance: —</span></div>
        <div class="amount-row">
          <input id="amountB" type="text" inputmode="decimal" placeholder="0.0">
          <select id="tokenB" class="token-select">${makeOptions("USDT")}</select>
        </div>
      </div>
      <div class="quote-box">
        <div class="quote-line"><span>Pool address</span><strong id="poolInfo">Loading…</strong></div>
        <div class="quote-line"><span>Current reserves</span><strong id="reservesInfo">—</strong></div>
      <div class="quote-line"><span>Price source</span><strong id="priceSource">Checking pool...</strong></div>
        <div class="quote-line"><span>Estimated LP shares</span><strong id="sharesInfo">Enter one amount; the other token amount is calculated automatically</strong></div>
        <div class="quote-line"><span>Slippage</span>
          <select id="slippage" class="small-select">
            <option value="50" selected>0.5%</option>
            <option value="100">1%</option>
            <option value="300">3%</option>
          </select>
        </div>
      </div>
      <button id="addBtn" class="primary-btn">Add Liquidity</button>
      <div id="status" class="status" role="status">Choose two different assets.</div>
      <a id="txLink" class="tx-link" target="_blank" rel="noopener noreferrer" hidden></a>
    </section>`);
  bindLiquidity();
}

function renderFaucet() {
  shell("faucet",`
    <section class="intro">
      <div class="eyebrow">FAUCET</div>
      <h1>Get tokens.</h1>
      <p>Receive tokens in your wallet to use on QMSwap. Native QMS is obtained from the network faucet.</p>
    </section>
    <div class="faucet-toolbar">
      <div><h2>Token Faucet</h2><p>Limits and cooldown periods are enforced per wallet by the contract.</p></div>
      <button class="secondary-btn" id="refreshBtn">Refresh</button>
    </div>
    <section id="faucetGrid" class="faucet-grid"></section>
    <div id="status" class="status" role="status"></div>
  `);
  bindFaucet();
}

function showTx(hash) {
  const link = $("txLink");
  if (!link) return;
  link.href = `${EXPLORER}/tx/${hash}`;
  link.textContent = "View transaction on QMSScan ↗";
  link.hidden = false;
}

async function loadConfig() {
  const response = await fetch("/deployments/qmswap-multipair-v6.json?ts=" + Date.now(), {
    cache: "no-store"
  });
  if (!response.ok) throw new Error("V3 configuration not found. The interface has not switched to the new version.");

  CFG = await response.json();

  if (Number(CFG.chainId) !== 19480 ||
      !CFG.factory || !CFG.router || !CFG.wqms || !CFG.tokens) {
    throw new Error("Deployment config is invalid.");
  }

  factoryRead = new ethers.Contract(CFG.factory,factoryAbi,rpc);
  routerRead = new ethers.Contract(CFG.router,routerAbi,rpc);
  qwapRouterRead = new ethers.Contract(QWAP_ROUTER_ADDRESS,qwapRouterAbi,rpc);
}

function getPage() {
  const path = location.pathname.toLowerCase();
  if (path.endsWith("/faucet.html")) return "faucet";
  if (path.endsWith("/liquidity.html")) return "liquidity";
  return "swap";
}

function getInjectedWalletProvider() {
  if (
    window.okxwallet &&
    typeof window.okxwallet.request === "function"
  ) {
    return window.okxwallet;
  }

  const ethereum = window.ethereum;

  if (ethereum && Array.isArray(ethereum.providers)) {
    const okxProvider = ethereum.providers.find(
      (item) => item && item.isOKXWallet &&
        typeof item.request === "function"
    );

    if (okxProvider) return okxProvider;
  }

  return ethereum && typeof ethereum.request === "function"
    ? ethereum
    : null;
}
async function connectWallet(requestAccounts=true) {
  if (!getInjectedWalletProvider()) throw new Error("No compatible EVM wallet was found. Enable OKX Wallet and reload the page.");

  const accounts = await getInjectedWalletProvider().request({
    method: requestAccounts ? "eth_requestAccounts" : "eth_accounts"
  });

  if (!accounts || !accounts.length) {
    if (requestAccounts) throw new Error("No account is selected in MetaMask.");
    return;
  }

  walletProvider = new ethers.BrowserProvider(getInjectedWalletProvider());
  let network = await walletProvider.getNetwork();

  if (network.chainId !== CHAIN_ID) {
    if (!requestAccounts) throw new Error("Please switch MetaMask to QMS Testnet.");
    await getInjectedWalletProvider().request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }]
    });
    walletProvider = new ethers.BrowserProvider(getInjectedWalletProvider());
    network = await walletProvider.getNetwork();
  }

  if (network.chainId !== CHAIN_ID) {
    throw new Error("MetaMask is not connected to chain ID 19480.");
  }

  account = ethers.getAddress(accounts[0]);
  signer = await walletProvider.getSigner(account);

  const btn = $("connectBtn");
  if (btn) btn.textContent = shortAddress(account);

  await refreshBalances();

  if (getPage() === "faucet") await refreshFaucetInfo();
  setStatus("Wallet connected: " + shortAddress(account), "success");
}

async function refreshBalances() {
  if (!account || !CFG) return;

  for (const key of assetKeys()) {
    try {
      if (key === "QMS") {
        balances.QMS = await rpc.getBalance(account);
      } else {
        const token = new ethers.Contract(asset(key).address,tokenAbi,rpc);
        balances[key] = await token.balanceOf(account);
      }
    } catch (err) {
      console.warn("Balance read failed:",key,err);
    }
  }

  updateBalanceLabels();

  if (getPage() === "faucet") {
    await refreshFaucetInfo();
  }
}

function updateBalanceLabels() {
  if (getPage() === "swap") {
    const from = $("fromSelect")?.value;
    const to = $("toSelect")?.value;

    if ($("fromBalance")) {
      $("fromBalance").textContent = account
        ? `Balance: ${fmt(balances[from] ?? 0n,tokenDecimals(from))}`
        : "Balance: Connect wallet";
    }

    if ($("toBalance")) {
      $("toBalance").textContent = account
        ? `Balance: ${fmt(balances[to] ?? 0n,tokenDecimals(to))}`
        : "Balance: Connect wallet";
    }
  } else if (getPage() === "liquidity") {
    const a = $("tokenA")?.value;
    const b = $("tokenB")?.value;

    if ($("balanceA")) {
      $("balanceA").textContent = account
        ? `Balance: ${fmt(balances[a] ?? 0n,tokenDecimals(a))}`
        : "Balance: Connect wallet";
    }

    if ($("balanceB")) {
      $("balanceB").textContent = account
        ? `Balance: ${fmt(balances[b] ?? 0n,tokenDecimals(b))}`
        : "Balance: Connect wallet";
    }
  }
}

async function ensureWallet() {
  if (!account || !signer) await connectWallet(true);
  if (!account || !signer) throw new Error("Please connect your wallet first.");

  const network = await signer.provider.getNetwork();
  if (network.chainId !== CHAIN_ID) throw new Error("Please switch MetaMask to QMS Testnet.");
}

async function ensureAllowance(tokenAddress, amount, spender = CFG.router) {
  const token = new ethers.Contract(tokenAddress,tokenAbi,signer);
  const allowance = BigInt(await token.allowance(account,spender));

  if (allowance >= amount) return;

  setStatus("Confirm the token approval in MetaMask...");
  const tx = await token.approve(spender,amount);
  setStatus("Waiting for approval: " + tx.hash);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Token approval failed.");
  }
}
function getSlippage() {
  return BigInt($("slippage")?.value || "50");
}

function minWithSlippage(amount) {
  return amount * (10000n - getSlippage()) / 10000n;
}

async function bindSwap() {
  $("connectBtn").addEventListener("click",() => connectWallet(true).catch(e => setStatus(errorText(e),"error")));
  $("fromSelect").addEventListener("change",async() => {
    if ($("fromSelect").value === $("toSelect").value) {
      $("toSelect").value = assetKeys().find(k => k !== $("fromSelect").value);
    }
    updateBalanceLabels();
    await updateSwapQuote();
  });
  $("toSelect").addEventListener("change",async() => {
    if ($("toSelect").value === $("fromSelect").value) {
      $("fromSelect").value = assetKeys().find(k => k !== $("toSelect").value);
    }
    updateBalanceLabels();
    await updateSwapQuote();
  });
  $("amountIn").addEventListener("input",updateSwapQuote);
  $("slippage").addEventListener("change",updateSwapQuote);
  $("flipBtn").addEventListener("click",async() => {
    const oldFrom = $("fromSelect").value;
    $("fromSelect").value = $("toSelect").value;
    $("toSelect").value = oldFrom;
    updateBalanceLabels();
    await updateSwapQuote();
  });
  $("refreshBtn").addEventListener("click",async() => {
    await refreshBalances();
    await updateSwapQuote();
  });
  $("swapBtn").addEventListener("click",runSwap);

  updateBalanceLabels();
  await updateSwapQuote();
}

function isQwapAssetKey(key) {
  return Object.prototype.hasOwnProperty.call(QWAP_TOKEN_ASSETS,key);
}

function qwapRouteAddress(key) {
  if (key === "QMS") return QWAP_WRAPPED_NATIVE_ADDRESS;
  return isQwapAssetKey(key) ? QWAP_TOKEN_ASSETS[key].address : null;
}

async function findBestSwapRoute(fromKey,toKey,amountIn) {
  if (
    (fromKey === "QMS" && toKey === "QWAP_WQMS") ||
    (fromKey === "QWAP_WQMS" && toKey === "QMS")
  ) {
    return {
      venue: "QWAP-WRAP",
      routerAddress: QWAP_WRAPPED_NATIVE_ADDRESS,
      path: null,
      amountOut: amountIn
    };
  }

  const candidates = [];
  const isLocalPair =
    !isQwapAssetKey(fromKey) &&
    !isQwapAssetKey(toKey) &&
    CFG?.tokens?.[fromKey] &&
    CFG?.tokens?.[toKey];

  if (isLocalPair) {
    try {
      const amountOut = BigInt(await routerRead.quoteOut(
        asset(fromKey).address,
        asset(toKey).address,
        amountIn
      ));

      if (amountOut > 0n) {
        candidates.push({
          venue: "QMSwap",
          routerAddress: CFG.router,
          path: null,
          amountOut
        });
      }
    } catch {
      // The local QMSwap pool may not have a valid quote.
    }
  }

  const compatibleWithQwap =
    (fromKey === "QMS" || isQwapAssetKey(fromKey)) &&
    (toKey === "QMS" || isQwapAssetKey(toKey));

  if (compatibleWithQwap) {
    const fromAddress = qwapRouteAddress(fromKey);
    const toAddress = qwapRouteAddress(toKey);
    const wrapped = QWAP_WRAPPED_NATIVE_ADDRESS.toLowerCase();

    if (
      fromAddress &&
      toAddress &&
      fromAddress.toLowerCase() !== toAddress.toLowerCase()
    ) {
      const paths = [[fromAddress,toAddress]];

      if (
        fromAddress.toLowerCase() !== wrapped &&
        toAddress.toLowerCase() !== wrapped
      ) {
        paths.push([
          fromAddress,
          QWAP_WRAPPED_NATIVE_ADDRESS,
          toAddress
        ]);
      }

      for (const path of paths) {
        try {
          const amounts = await qwapRouterRead.getAmountsOut(amountIn,path);
          const amountOut = BigInt(amounts[amounts.length - 1]);

          if (amountOut > 0n) {
            candidates.push({
              venue: "QWAP",
              routerAddress: QWAP_ROUTER_ADDRESS,
              path,
              amountOut
            });
          }
        } catch {
          // This QWAP path may not have enough liquidity.
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error("No route with available liquidity was found.");
  }

  candidates.sort((a,b) => {
    if (a.amountOut === b.amountOut) return 0;
    return a.amountOut > b.amountOut ? -1 : 1;
  });

  return candidates[0];
}
async function updateSwapQuote() {
  quoteOutRaw = 0n;
  if (!$("amountIn")) return;

  const fromKey = $("fromSelect").value;
  const toKey = $("toSelect").value;
  const input = $("amountIn").value.trim();

  $("amountOut").value = "";
  $("minReceived").textContent = "—";

  if (fromKey === toKey) {
    $("poolInfo").textContent = "Choose two different tokens.";
    return;
  }

  if (!input) {
    $("poolInfo").textContent = "Enter an amount";
    return;
  }

  try {
    const amountIn = parseAmount(input,fromKey);
    if (amountIn <= 0n) return;

    const route = await findBestSwapRoute(fromKey,toKey,amountIn);
    quoteOutRaw = route.amountOut;

    $("amountOut").value = fmt(quoteOutRaw,tokenDecimals(toKey),10);
    $("minReceived").textContent =
      fmt(minWithSlippage(quoteOutRaw),tokenDecimals(toKey),10) +
      " " + (asset(toKey).symbol || toKey);

    const hopInfo = route.path && route.path.length > 2
      ? " via WQMS"
      : "";

    $("poolInfo").textContent = `Route: ${route.venue}${hopInfo}`;
  } catch (err) {
    quoteOutRaw = 0n;
    $("amountOut").value = "";
    $("minReceived").textContent = "—";
    $("poolInfo").textContent = "No liquidity available or invalid pair.";
  }
}

async function runSwap() {
  if (busy) return;

  busy = true;
  $("swapBtn").disabled = true;
  $("txLink").hidden = true;

  try {
    await ensureWallet();

    const fromKey = $("fromSelect").value;
    const toKey = $("toSelect").value;
    const amountIn = parseAmount($("amountIn").value.trim(),fromKey);

    if (fromKey === toKey || amountIn <= 0n) throw new Error("Invalid amount or trading pair.");

    const bestRoute = await findBestSwapRoute(fromKey,toKey,amountIn);
    const amountOut = bestRoute.amountOut;
    const minOut = minWithSlippage(amountOut);
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);
    quoteOutRaw = amountOut;

    let tx;

    if (bestRoute.venue === "QWAP-WRAP") {
      const wrapped = new ethers.Contract(
        QWAP_WRAPPED_NATIVE_ADDRESS,
        [
          "function deposit() payable",
          "function withdraw(uint256 amount)"
        ],
        signer
      );

      if (fromKey === "QMS" && toKey === "QWAP_WQMS") {
        await wrapped.deposit.staticCall({ value: amountIn });
        setStatus("Confirm wrapping QMS into WQMS in your wallet...");
        tx = await wrapped.deposit({ value: amountIn });
      } else if (fromKey === "QWAP_WQMS" && toKey === "QMS") {
        await wrapped.withdraw.staticCall(amountIn);
        setStatus("Confirm unwrapping WQMS into QMS in your wallet...");
        tx = await wrapped.withdraw(amountIn);
      } else {
        throw new Error("Invalid QMS/WQMS wrapping route.");
      }
    } else if (bestRoute.venue === "QWAP") {
      const qwapRouter = new ethers.Contract(
        QWAP_ROUTER_ADDRESS,
        qwapRouterAbi,
        signer
      );
      const routePath = bestRoute.path;

      if (fromKey === "QMS") {
        await qwapRouter.swapExactETHForTokens.staticCall(
          minOut,routePath,account,deadline,{ value:amountIn }
        );
        setStatus("Confirm the QWAP swap in your wallet...");
        tx = await qwapRouter.swapExactETHForTokens(
          minOut,routePath,account,deadline,{ value:amountIn }
        );
      } else if (toKey === "QMS") {
        await ensureAllowance(
          asset(fromKey).address,
          amountIn,
          QWAP_ROUTER_ADDRESS
        );
        await qwapRouter.swapExactTokensForETH.staticCall(
          amountIn,minOut,routePath,account,deadline
        );
        setStatus("Confirm the QWAP swap in your wallet...");
        tx = await qwapRouter.swapExactTokensForETH(
          amountIn,minOut,routePath,account,deadline
        );
      } else {
        await ensureAllowance(
          asset(fromKey).address,
          amountIn,
          QWAP_ROUTER_ADDRESS
        );
        await qwapRouter.swapExactTokensForTokens.staticCall(
          amountIn,minOut,routePath,account,deadline
        );
        setStatus("Confirm the QWAP swap in your wallet...");
        tx = await qwapRouter.swapExactTokensForTokens(
          amountIn,minOut,routePath,account,deadline
        );
      }
    } else {
      const router = new ethers.Contract(CFG.router,routerAbi,signer);

      if (fromKey === "QMS") {
        await router.swapExactQMSForTokens.staticCall(
          asset(toKey).address,minOut,deadline,account,{ value:amountIn }
        );
        setStatus("Please confirm the swap in your wallet...");
        tx = await router.swapExactQMSForTokens(
          asset(toKey).address,minOut,deadline,account,{ value:amountIn }
        );
      } else if (toKey === "QMS") {
        await ensureAllowance(asset(fromKey).address,amountIn);
        await router.swapExactTokensForQMS.staticCall(
          asset(fromKey).address,amountIn,minOut,deadline,account
        );
        setStatus("Please confirm the swap in your wallet...");
        tx = await router.swapExactTokensForQMS(
          asset(fromKey).address,amountIn,minOut,deadline,account
        );
      } else {
        await ensureAllowance(asset(fromKey).address,amountIn);
        await router.swapExactTokensForTokens.staticCall(
          asset(fromKey).address,asset(toKey).address,amountIn,minOut,deadline,account
        );
        setStatus("Please confirm the swap in your wallet...");
        tx = await router.swapExactTokensForTokens(
          asset(fromKey).address,asset(toKey).address,amountIn,minOut,deadline,account
        );
      }
    }
    setStatus("Transaction submitted: " + tx.hash + ". Waiting for confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Swap failed.");

    showTx(tx.hash);
    setStatus(`Swap successful at block ${receipt.blockNumber}.`, "success");

    $("amountIn").value = "";
    $("amountOut").value = "";
    await refreshBalances();
    await updateSwapQuote();
  } catch (err) {
    setStatus("Swap failed: " + errorText(err),"error");
  } finally {
    busy = false;
    $("swapBtn").disabled = false;
  }
}

async function bindLiquidity() {
  $("connectBtn").addEventListener("click",() => connectWallet(true).catch(e => setStatus(errorText(e),"error")));
  $("tokenA").addEventListener("change",async() => {
    if ($("tokenA").value === $("tokenB").value) {
      $("tokenB").value = assetKeys().find(k => k !== $("tokenA").value);
    }
    $("amountA").value = "";
    $("amountB").value = "";
    updateBalanceLabels();
    await updateLiquidityQuote("");
  });
  $("tokenB").addEventListener("change",async() => {
    if ($("tokenB").value === $("tokenA").value) {
      $("tokenA").value = assetKeys().find(k => k !== $("tokenB").value);
    }
    $("amountA").value = "";
    $("amountB").value = "";
    updateBalanceLabels();
    await updateLiquidityQuote("");
  });
  $("amountA").addEventListener("input",() => { lastLiquidityInputSide = "A"; updateLiquidityQuote("A"); });
  $("amountB").addEventListener("input",() => { lastLiquidityInputSide = "B"; updateLiquidityQuote("B"); });
  $("slippage").addEventListener("change",() => updateLiquidityQuote(""));
  $("refreshBtn").addEventListener("click",async() => {
    await refreshBalances();
    await updateLiquidityQuote("");
  });
  $("addBtn").addEventListener("click",runAddLiquidity);

  updateBalanceLabels();
  await updateLiquidityQuote("");
}

async function readPairState(keyA,keyB) {
  const a = asset(keyA);
  const b = asset(keyB);
  const address = await factoryRead.getPair(a.address,b.address);

  if (!address || address.toLowerCase() === ZERO.toLowerCase()) {
    throw new Error("Pool not found: " + keyA + "/" + keyB);
  }

  const pair = new ethers.Contract(address,pairAbi,rpc);
  const [token0,reserves] = await Promise.all([
    pair.token0(),
    pair.getReserves()
  ]);

  const reserve0 = BigInt(reserves[0]);
  const reserve1 = BigInt(reserves[1]);
  const aIs0 = String(token0).toLowerCase() === a.address.toLowerCase();

  return {
    address,
    pair,
    reserveA: aIs0 ? reserve0 : reserve1,
    reserveB: aIs0 ? reserve1 : reserve0
  };
}

let referenceUsdPriceCache = null;
let referenceUsdPriceFetchedAt = 0;
let lastLiquidityInputSide = "A";

function priceToScale8(raw) {
  const match = String(raw).match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("Reference price is invalid.");
  const fraction = ((match[2] || "") + "00000000").slice(0, 8);
  return BigInt(match[1]) * 100000000n + BigInt(fraction);
}

async function getReferenceUsdPrices() {
  if (referenceUsdPriceCache && Date.now() - referenceUsdPriceFetchedAt < 30000) {
    return referenceUsdPriceCache;
  }

  const symbols = encodeURIComponent(JSON.stringify(["ETHUSDT", "BTCUSDT", "BNBUSDT"]));
  const urls = [
    `https://data-api.binance.vision/api/v3/ticker/price?symbols=${symbols}`,
    `https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`
  ];

  let rows = null;
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Price data has an invalid format.");
      rows = data;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!rows) {
    if ($("priceSource")) $("priceSource").textContent = "Unable to retrieve reference prices";
    throw new Error("Unable to retrieve Binance Spot prices. A safe ratio cannot be calculated for an empty pool. " +
      (lastError?.message || ""));
  }

  const tickers = new Map(rows.map(row => [row.symbol, row.price]));
  const prices = {
    QMS: 100000000n,
    USDT: 100000000n,
    USDC: 100000000n,
    ETH: priceToScale8(tickers.get("ETHUSDT")),
    BTC: priceToScale8(tickers.get("BTCUSDT")),
    BNB: priceToScale8(tickers.get("BNBUSDT"))
  };

  for (const key of ["ETH", "BTC", "BNB"]) {
    if (prices[key] <= 0n) throw new Error(`Price of ${key} is invalid.`);
  }

  referenceUsdPriceCache = prices;
  referenceUsdPriceFetchedAt = Date.now();
  return prices;
}

function quoteRawByReference(amountRaw, fromKey, toKey, prices) {
  const fromDecimals = BigInt(tokenDecimals(fromKey));
  const toDecimals = BigInt(tokenDecimals(toKey));
  const result =
    amountRaw * prices[fromKey] * (10n ** toDecimals) /
    (prices[toKey] * (10n ** fromDecimals));

  if (result <= 0n) {
    throw new Error("The amount is too small to calculate the corresponding token amount.");
  }
  return result;
}

function rawToInputAmount(raw, key) {
  let value = ethers.formatUnits(raw, tokenDecimals(key));
  if (value.includes(".")) value = value.replace(/0+$/, "").replace(/\.$/, "");
  return value || "0";
}
async function updateLiquidityQuote(changedSide) {
  liquiditySharesRaw = 0n;

  const keyA = $("tokenA").value;
  const keyB = $("tokenB").value;

  if (keyA === keyB) {
    $("poolInfo").textContent = "Choose two different tokens.";
    return;
  }

  try {
    const state = await readPairState(keyA,keyB);
    $("poolInfo").textContent = shortAddress(state.address);

    $("reservesInfo").textContent =
      `${fmt(state.reserveA,tokenDecimals(keyA),8)} ${keyA} / ` +
      `${fmt(state.reserveB,tokenDecimals(keyB),8)} ${keyB}`;

    const poolHasRatio = state.reserveA > 0n && state.reserveB > 0n;
    $("priceSource").textContent = poolHasRatio
      ? "Current pool reserve ratio"
      : "Binance reference price; QMS is assumed to equal 1 USD";

    if (changedSide === "A") {
      const inputA = parseAmount($("amountA").value, keyA);
      $("amountB").value = "";
      if (inputA > 0n) {
        let derivedB;
        if (poolHasRatio) {
          derivedB = inputA * state.reserveB / state.reserveA;
        } else {
          const prices = await getReferenceUsdPrices();
          derivedB = quoteRawByReference(inputA, keyA, keyB, prices);
        }
        if (derivedB <= 0n) throw new Error("The calculated corresponding token amount is zero.");
        $("amountB").value = rawToInputAmount(derivedB, keyB);
      }
    } else if (changedSide === "B") {
      const inputB = parseAmount($("amountB").value, keyB);
      $("amountA").value = "";
      if (inputB > 0n) {
        let derivedA;
        if (poolHasRatio) {
          derivedA = inputB * state.reserveA / state.reserveB;
        } else {
          const prices = await getReferenceUsdPrices();
          derivedA = quoteRawByReference(inputB, keyB, keyA, prices);
        }
        if (derivedA <= 0n) throw new Error("The calculated corresponding token amount is zero.");
        $("amountA").value = rawToInputAmount(derivedA, keyA);
      }
    }
    const valueA = parseAmount($("amountA").value,keyA);
    const valueB = parseAmount($("amountB").value,keyB);

    if (valueA > 0n && valueB > 0n) {
      liquiditySharesRaw = BigInt(await routerRead.previewLiquidity(
        asset(keyA).address,
        asset(keyB).address,
        valueA,
        valueB
      ));

      $("sharesInfo").textContent = liquiditySharesRaw > 0n
        ? fmt(liquiditySharesRaw,18,8) + " LP (estimated)"
        : "The amount is too small or the pool is invalid.";
    } else {
      $("sharesInfo").textContent = "Enter one amount; the other token amount is calculated automatically";
    }
  } catch (err) {
    $("poolInfo").textContent = "Unable to read the pool.";
    $("reservesInfo").textContent = "—";
    $("sharesInfo").textContent = "—";
  }
}

async function runAddLiquidity() {
  if (busy) return;

  busy = true;
  $("addBtn").disabled = true;
  $("txLink").hidden = true;

  try {
    await ensureWallet();

    const keyA = $("tokenA").value;
    const keyB = $("tokenB").value;

    if (keyA === keyB) throw new Error("Please select two different assets.");
    await updateLiquidityQuote(lastLiquidityInputSide);

    const amountA = parseAmount($("amountA").value.trim(),keyA);
    const amountB = parseAmount($("amountB").value.trim(),keyB);

    if (amountA <= 0n || amountB <= 0n) {
      throw new Error("Enter an amount greater than zero for both assets.");
    }

    const shares = BigInt(await routerRead.previewLiquidity(
      asset(keyA).address,asset(keyB).address,amountA,amountB
    ));

    if (shares <= 0n) throw new Error("The amount is too small to receive LP shares.");

    const minShares = shares * (10000n - getSlippage()) / 10000n;
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);
    const router = new ethers.Contract(CFG.router,routerAbi,signer);

    let tx;

    if (keyA === "QMS") {
      await ensureAllowance(asset(keyB).address,amountB);
      await router.addLiquidityNative.staticCall(
        asset(keyB).address,amountB,minShares,deadline,account,{ value:amountA }
      );
      setStatus("Confirm Add Liquidity in MetaMask...");
      tx = await router.addLiquidityNative(
        asset(keyB).address,amountB,minShares,deadline,account,{ value:amountA }
      );
    } else if (keyB === "QMS") {
      await ensureAllowance(asset(keyA).address,amountA);
      await router.addLiquidityNative.staticCall(
        asset(keyA).address,amountA,minShares,deadline,account,{ value:amountB }
      );
      setStatus("Confirm Add Liquidity in MetaMask...");
      tx = await router.addLiquidityNative(
        asset(keyA).address,amountA,minShares,deadline,account,{ value:amountB }
      );
    } else {
      await ensureAllowance(asset(keyA).address,amountA);
      await ensureAllowance(asset(keyB).address,amountB);
      await router.addLiquidity.staticCall(
        asset(keyA).address,asset(keyB).address,
        amountA,amountB,minShares,deadline,account
      );
      setStatus("Confirm Add Liquidity in MetaMask...");
      tx = await router.addLiquidity(
        asset(keyA).address,asset(keyB).address,
        amountA,amountB,minShares,deadline,account
      );
    }

    setStatus("Transaction submitted: " + tx.hash + ". Waiting for confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Add Liquidity failed.");

    showTx(tx.hash);
    setStatus(`Liquidity added to ${keyA}/${keyB} at block ${receipt.blockNumber}.`,"success");

    await refreshBalances();
    await updateLiquidityQuote("");
  } catch (err) {
    setStatus("Failed to add liquidity: " + errorText(err),"error");
  } finally {
    busy = false;
    $("addBtn").disabled = false;
  }
}

function bindFaucet() {
  $("connectBtn").addEventListener("click",() => connectWallet(true).catch(e => setStatus(errorText(e),"error")));
  $("refreshBtn").addEventListener("click",async() => {
    await refreshBalances();
    await refreshFaucetInfo();
  });

  const keys = assetKeys().filter(key => key !== "QMS");

  $("faucetGrid").innerHTML = keys.map(key => `
    <article class="faucet-card" data-faucet-key="${key}">
      <div class="token-icon">${key.slice(0,1)}</div>
      <h3>${asset(key).displayName}</h3>
      <div class="faucet-amount">Amount: —</div>
      <div class="faucet-balance">Balance: —</div>
      <div class="faucet-cooldown">Claim available</div>
      <button class="primary-btn claim-btn" data-claim="${key}">Faucet ${asset(key).displayName}</button>
      <div class="claim-status" role="status"></div>
    </article>
  `).join("");

  document.querySelectorAll("[data-claim]").forEach(button => {
    button.addEventListener("click",() => claimFaucet(button.dataset.claim,button));
  });

  refreshFaucetInfo();
}

async function refreshFaucetInfo() {
  if (!CFG || getPage() !== "faucet") return;

  const keys = assetKeys().filter(key => key !== "QMS");
  let blockTime = BigInt(Math.floor(Date.now()/1000));

  try {
    const block = await rpc.getBlock("latest");
    if (block) blockTime = BigInt(block.timestamp);
  } catch {}

  for (const key of keys) {
    const card = document.querySelector(`[data-faucet-key="${key}"]`);
    if (!card) continue;

    const amountEl = card.querySelector(".faucet-amount");
    const balanceEl = card.querySelector(".faucet-balance");
    const cooldownEl = card.querySelector(".faucet-cooldown");
    const button = card.querySelector(".claim-btn");

    try {
      const token = new ethers.Contract(asset(key).address,tokenAbi,rpc);
      const regularAmount = BigInt(await token.faucetAmount());
      const ownerAddress = await token.owner().catch(() => "");
      const adminAmount = await token.adminFaucetAmount().catch(() => null);
      const isAdmin = Boolean(account && adminAmount !== null && ownerAddress &&
        account.toLowerCase() === ownerAddress.toLowerCase());
      const amount = isAdmin ? BigInt(adminAmount) : regularAmount;
      const nextAt = BigInt(account ? await token.nextClaimAt(account) : 0n);

      amountEl.textContent = "Amount per claim: " + fmt(amount,tokenDecimals(key),8) + " " + key;
      balanceEl.textContent = account
        ? "Balance: " + fmt(balances[key] ?? await token.balanceOf(account),tokenDecimals(key),8) + " " + key
        : "Balance: Connect wallet";

      if (!account) {
        cooldownEl.textContent = "Connect your wallet to receive tokens.";
        button.disabled = false;
      } else if (nextAt > blockTime) {
        const minutes = Math.ceil(Number(nextAt - blockTime)/60);
        cooldownEl.textContent = `You can claim again in approximately ${minutes} minutes.`;
        button.disabled = true;
      } else {
        cooldownEl.textContent = "Available to claim now.";
        button.disabled = false;
      }
    } catch (err) {
      amountEl.textContent = "Unable to load faucet configuration.";
      cooldownEl.textContent = errorText(err);
      button.disabled = true;
    }
  }
}

async function claimFaucet(key,button) {
  const card = document.querySelector(`[data-faucet-key="${key}"]`);
  const status = card?.querySelector(".claim-status");

  button.disabled = true;

  try {
    await ensureWallet();

    const token = new ethers.Contract(asset(key).address,tokenAbi,signer);
    const ownerAddress = await token.owner().catch(() => "");
    const adminAmount = await token.adminFaucetAmount().catch(() => null);
    const isAdmin = Boolean(adminAmount !== null && ownerAddress && account &&
      account.toLowerCase() === ownerAddress.toLowerCase());
    const nextAt = BigInt(isAdmin ? 0n : await token.nextClaimAt(account));
    const block = await rpc.getBlock("latest");
    const now = BigInt(block?.timestamp ?? Math.floor(Date.now()/1000));

    if (nextAt > now) {
      throw new Error("The next claim is not available yet.");
    }

    status.textContent = "Confirm the transaction in MetaMask...";
    const tx = await token.faucet();
    status.textContent = "Transaction submitted: " + tx.hash + ". Waiting for confirmation...";

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Faucet transaction failed.");

    status.textContent = "Tokens claimed successfully.";
    await refreshBalances();
    await refreshFaucetInfo();
  } catch (err) {
    status.textContent = "Faucet failed: " + errorText(err);
  } finally {
    button.disabled = false;
    await refreshFaucetInfo();
  }
}

async function init() {
  const page = getPage();

  try {
    await loadConfig();

    if (page === "swap") renderSwap();
    else if (page === "liquidity") renderLiquidity();
    else renderFaucet();

    if (getInjectedWalletProvider()?.on) {
      getInjectedWalletProvider().on("accountsChanged",() => location.reload());
      getInjectedWalletProvider().on("chainChanged",() => location.reload());
    }

    if (getInjectedWalletProvider()) {
      const accounts = await getInjectedWalletProvider().request({method:"eth_accounts"});
      if (accounts?.length) {
        try {
          await connectWallet(false);
        } catch (err) {
          setStatus(errorText(err),"error");
        }
      }
    }
  } catch (err) {
    $("app").innerHTML = `
      <main class="load-error">
        <h1>QMSwap is not ready</h1>
        <p>${String(errorText(err)).replace(/</g,"&lt;")}</p>
        <p>Check the V3 deployment configuration before opening the interface.</p>
      </main>`;
  }
}

init();