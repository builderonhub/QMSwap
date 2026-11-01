import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.qms.finance";
const CHAIN_ID = 19480n;
const CHAIN_HEX = "0x4c18";

let qmsNetworkSetupPromise = null;

async function ensureQmsNetworkConfigured() {
  if (qmsNetworkSetupPromise) {
    return qmsNetworkSetupPromise;
  }

  qmsNetworkSetupPromise = (async () => {
    const wallet = getInjectedWalletProvider();
    const expectedChain = CHAIN_HEX.toLowerCase();

    const currentChain = String(
      await wallet.request({ method: "eth_chainId" })
    ).toLowerCase();

    if (currentChain === expectedChain) return;

    try {
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_HEX }]
      });
    } catch (error) {
      if (error?.code !== 4902) throw error;

      await wallet.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_HEX,
          chainName: "QMS Testnet",
          nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER]
        }]
      });

      const chainAfterAdd = String(
        await wallet.request({ method: "eth_chainId" })
      ).toLowerCase();

      if (chainAfterAdd !== expectedChain) {
        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_HEX }]
        });
      }
    }

    const finalChain = String(
      await wallet.request({ method: "eth_chainId" })
    ).toLowerCase();

    if (finalChain !== expectedChain) {
      throw new Error("Please connect your wallet to QMS Testnet.");
    }
  })();

  try {
    await qmsNetworkSetupPromise;
  } finally {
    qmsNetworkSetupPromise = null;
  }
}
const ZERO = "0x0000000000000000000000000000000000000000";
const EXPLORER = "https://testnet.qmsscan.io";

const $ = (id) => document.getElementById(id);
const rpc = new ethers.JsonRpcProvider(RPC_URL, 19480);

const QWAP_ROUTER_ADDRESS = "0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619";
const QWAP_FACTORY_ADDRESS = "0x93AFD9aC50822F82c7C4f2Ec8Ec2463b086Fb878";
const QWAP_WRAPPED_NATIVE_ADDRESS = "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34";
const QPAD_FACTORY_ADDRESS = "0xe5DCc73c9a2A06DA4E6FA0F259a6024bf3b1e4F0";

const QPAD_DISCOVERY_ABI = [
  "function totalTokens() view returns (uint256)",
  "function allTokens(uint256) view returns (address token,address creator,string name,string symbol,string description,string imageURI,string twitter,string telegram,address treasury,uint256 createdAt)"
];

const QWAP_DISCOVERY_FACTORY_ABI = [
  "function getPair(address,address) view returns (address)"
];

const QWAP_DISCOVERY_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const QWAP_DISCOVERY_TOKEN_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const QWAP_DISCOVERY_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

let qpadDiscoveryPromise = null;
let qpadDiscoveryState = null;

const QPAD_DISCOVERY_BATCH_SIZE = 50;
const QPAD_DISCOVERY_CONCURRENCY = 10;

let qpadDiscoveryTimer = null;
const QWAP_AUTO_FACTORY_ABI = [
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "function getPair(address,address) view returns (address)"
];

const QWAP_AUTO_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)"
];

const QWAP_AUTO_TOKEN_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

const QWAP_AUTO_STORAGE_KEY = "qmswap.qpadDiscovery.v2";

const customQwapAssets = Object.create(null);
const IMPORTED_ASSETS_STORAGE_KEY = "qmswap.importedAssets.v1";
const MAX_IMPORTED_ASSETS = 50;
let tokenImportBusy = false;

let qwapAutoDiscoveryPromise = null;

let qwapAutoListingTimer = null;

const QWAP_TOKEN_ASSETS = Object.freeze({
  QWAP_USDC: {
    address: "0xDd4D61DF875cc613E1372c78827a5F4C2741bf11",
    symbol: "USDC",
    decimals: 6,
    displayName: "USDC"
  },
  QWAP_USDT: {
    address: "0x5D1386fC130143F92511bC2D18124D3E414ed429",
    symbol: "USDT",
    decimals: 6,
    displayName: "USDT"
  },
  QWAP_WBTC: {
    address: "0x5eBfE302200a5b22E182a5C0D10444Fe44b2A678",
    symbol: "BTC",
    contractSymbol: "WBTC",
    decimals: 8,
    displayName: "BTC"
  },
  QWAP_WETH: {
    address: "0x43D7c8434A5290a32C8725224870ad6f85132a31",
    symbol: "ETH",
    contractSymbol: "WETH",
    decimals: 18,
    displayName: "ETH"
  },
  QWAP_WQMS: {
    address: "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",
    symbol: "WQMS",
    decimals: 18,
    displayName: "WQMS"
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
let marketModule = null;
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
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
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
  "function removeLiquidity(address,address,uint256,uint256,uint256,uint256,address) returns (uint256,uint256)",
  "function removeLiquidityNative(address,uint256,uint256,uint256,uint256,address) returns (uint256,uint256)",
  "function swapExactTokensForTokens(address,address,uint256,uint256,uint256,address) returns (uint256)",
  "function swapExactQMSForTokens(address,uint256,uint256,address) payable returns (uint256)",
  "function swapExactTokensForQMS(address,uint256,uint256,uint256,address) returns (uint256)"
];

let factoryRead;
let routerRead;
let qwapRouterRead;

const assetRegistryByAddress = new Map();
const assetRegistryByKey = new Map();

function assetIdentity(address, chainId = CHAIN_ID) {
  if (!ethers.isAddress(address)) return null;
  return `${Number(chainId)}:${ethers.getAddress(address).toLowerCase()}`;
}

function rebuildAssetRegistry() {
  assetRegistryByAddress.clear();
  assetRegistryByKey.clear();

  const groups = [
    ["QMSwap", CFG?.tokens || {}],
    ["QWAP", QWAP_TOKEN_ASSETS],
    ["QPad", customQwapAssets]
  ];

  for (const [defaultSource, entries] of groups) {
    for (const [key, item] of Object.entries(entries)) {
      if (!item?.address || !ethers.isAddress(item.address)) continue;

      const address = ethers.getAddress(item.address);
      const identity = assetIdentity(address);
      let record = assetRegistryByAddress.get(identity);

      if (record) {
        if (Number(record.decimals ?? 18) !== Number(item.decimals ?? 18)) {
          throw new Error(`Conflicting decimals for asset ${identity}`);
        }
        if (!record.aliases.includes(key)) record.aliases.push(key);
      } else {
        record = {
          ...item,
          key,
          address,
          chainId: Number(CHAIN_ID),
          identity,
          source: item.source || defaultSource,
          aliases: [key]
        };
        assetRegistryByAddress.set(identity, record);
      }

      assetRegistryByKey.set(key, record);
    }
  }

  return assetRegistryByAddress;
}

function getAssetByAddress(address, chainId = CHAIN_ID) {
  const identity = assetIdentity(address, chainId);
  return identity ? assetRegistryByAddress.get(identity) || null : null;
}

function asset(key) {
  const direct =
    CFG?.tokens?.[key] ||
    QWAP_TOKEN_ASSETS[key] ||
    customQwapAssets[key];

  if (!direct) return null;

  const identity = assetIdentity(direct.address);
  return identity
    ? assetRegistryByKey.get(key) || direct
    : direct;
}

function assetKeys(page = getPage()) {
  const local = ["QMS","USDT","USDC","ETH","BTC","BNB"]
    .filter(key => CFG?.tokens?.[key]);

  const imported = Object.entries(customQwapAssets)
    .filter(([, item]) =>
      item?.source === "Imported" &&
      Array.isArray(item.pools) &&
      item.pools.some(pool => pool?.venue === "QWAP" || pool?.venue === "QMSwap")
    )
    .map(([key]) => key);

  const keys = page === "swap"
    ? [...(CFG?.tokens?.QMS ? ["QMS"] : []), ...Object.keys(QWAP_TOKEN_ASSETS), ...imported]
    : local;

  const seen = new Set();

  return keys.filter(key => {
    const item = asset(key);
    const identity = assetIdentity(item?.address);

    if (!identity || seen.has(identity)) return false;

    seen.add(identity);
    return true;
  });
}

function tokenDecimals(key) {
  return Number(asset(key).decimals ?? 18);
}

function shortAddress(value) {
  return value ? `${value.slice(0,6)}...${value.slice(-4)}` : "";
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function makeOptions(selected) {
  return assetKeys().map(key =>
    `<option value="${escapeHtml(key)}" ${key===selected ? "selected" : ""}>${escapeHtml(asset(key).displayName)}</option>`
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
          <a href="/market.html" data-page="market" class="${page==="market"?"active":""}">Market</a>
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
      <footer class="footer">QMSwap | 0.30% swap fee</footer>
    </div>`;

  $("connectBtn").addEventListener("click",() => connectWallet(true));
}

async function renderMarket() {
  shell("market", `
    <div class="market-page">
      <style>
        .market-page {
          display:flex;
          flex-direction:column;
          gap:16px;
          width:100%;
        }
        .market-page .market-intro {
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:14px;
          flex-wrap:wrap;
        }
        .market-page .market-eyebrow {
          color:var(--accent);
          font-size:10px;
          font-weight:800;
          letter-spacing:1.3px;
          text-transform:uppercase;
        }
        .market-page .market-title {
          margin:6px 0;
          font-size:28px;
          font-weight:850;
        }
        .market-page .market-subtitle,
        .market-page .market-hint {
          color:var(--muted);
          font-size:11px;
          line-height:1.65;
        }
        .market-page .market-grid {
          display:grid;
          grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);
          gap:16px;
          align-items:start;
        }
        .market-page .market-card {
          min-width:0;
          overflow:hidden;
          border:1px solid var(--border);
          border-radius:14px;
          background:var(--surface, #111827);
        }
        .market-page .market-card-head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:10px;
          padding:15px 16px;
          border-bottom:1px solid var(--border);
        }
        .market-page .market-card-head h2 {
          margin:0;
          font-size:15px;
        }
        .market-page .market-table-wrap {
          width:100%;
          overflow-x:auto;
        }
        .market-page table {
          width:100%;
          border-collapse:collapse;
          min-width:440px;
        }
        .market-page th {
          padding:11px 12px;
          color:var(--muted);
          font-size:9px;
          text-align:left;
          white-space:nowrap;
          text-transform:uppercase;
        }
        .market-page td {
          padding:13px 12px;
          border-top:1px solid var(--border);
          font-size:11px;
          vertical-align:middle;
        }
        .market-page .asset-name {
          font-weight:800;
          font-size:12px;
        }
        .market-page .price-cell {
          font-weight:800;
          font-variant-numeric:tabular-nums;
        }
        .market-page .positive { color:#42c994; }
        .market-page .negative { color:#ef777d; }
        .market-page .muted { color:var(--muted); }
        .market-page .empty {
          padding:22px!important;
          color:var(--muted);
          text-align:center;
        }
        .market-page .quote-switch,
        .market-page .side-tabs {
          display:flex;
          align-items:center;
          gap:7px;
        }
        .market-page .market-btn {
          min-height:34px;
          padding:7px 11px;
          border:1px solid var(--border);
          border-radius:8px;
          background:var(--surface-2, #1b2433);
          color:var(--text);
          font-size:10px;
          font-weight:750;
          cursor:pointer;
        }
        .market-page .market-btn.active {
          border-color:var(--accent);
          background:var(--accent-soft, #30274c);
        }
        .market-page .market-btn.primary {
          width:100%;
          min-height:42px;
          background:var(--accent);
          color:white;
          border-color:var(--accent);
        }
        .market-page .market-btn:disabled {
          opacity:.5;
          cursor:not-allowed;
        }
        .market-page .market-form {
          padding:15px;
        }
        .market-page .side-tabs button {
          flex:1;
        }
        .market-page .market-fields {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        }
        .market-page .market-field {
          min-width:0;
          margin-bottom:13px;
        }
        .market-page .market-field label {
          display:block;
          margin-bottom:6px;
          color:var(--muted);
          font-size:10px;
        }
        .market-page .market-field input,
        .market-page .market-field select {
          width:100%;
          min-width:0;
          min-height:40px;
          padding:9px 10px;
          color:var(--text);
          background:var(--input-bg, #171f2d);
          border:1px solid var(--border);
          border-radius:8px;
          font-size:12px;
        }
        .market-page .market-preview {
          padding:11px;
          margin:12px 0;
          border:1px solid var(--border);
          border-radius:9px;
          background:var(--surface-2, #171f2d);
        }
        .market-page .market-preview-row {
          display:flex;
          justify-content:space-between;
          gap:12px;
          padding:5px 0;
          font-size:10px;
        }
        .market-page .market-preview-row span:first-child {
          color:var(--muted);
        }
        .market-page .market-preview-row strong {
          text-align:right;
          overflow-wrap:anywhere;
        }
        .market-page .market-status {
          margin-top:10px;
          padding:10px 12px;
          border:1px solid var(--border);
          border-radius:9px;
          color:var(--muted);
          font-size:10px;
          line-height:1.6;
        }
        .market-page .market-status[data-tone="success"] { color:#42c994; }
        .market-page .market-status[data-tone="warn"] { color:#e8bd69; }
        .market-page .market-status[data-tone="error"] { color:#ef777d; }
        .market-page .market-stats {
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:10px;
        }
        .market-page .market-stat {
          padding:13px;
          min-width:0;
          border:1px solid var(--border);
          border-radius:11px;
          background:var(--surface, #111827);
        }
        .market-page .market-stat-label {
          color:var(--muted);
          font-size:9px;
        }
        .market-page .market-stat-value {
          margin-top:7px;
          font-size:17px;
          font-weight:850;
          overflow-wrap:anywhere;
        }
        .market-page .market-stat-meta {
          margin-top:4px;
          color:var(--muted);
          font-size:9px;
        }
        .market-page #updatedAt { display:none !important; }
        .market-page .market-note {
          color:var(--muted);
          font-size:10px;
          line-height:1.65;
        }
        .market-page #my-orders-panel .market-card-head {
          padding:15px 16px;
        }
        .market-page #my-orders-panel table {
          min-width:650px;
        }
        .market-page .order-explain {
          padding:12px 15px;
          color:var(--muted);
          font-size:10px;
          line-height:1.65;
          border-top:1px solid var(--border);
        }
        @media(max-width:950px) {
          .market-page .market-grid {
            grid-template-columns:minmax(0,1fr);
          }
        }
        @media(max-width:650px) {
          .market-page .market-stats {
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
          .market-page .market-title { font-size:24px; }
          .market-page .market-fields { grid-template-columns:1fr 1fr; }
        }
      
/* =========================================================
   QMSWAP MARKET - CONSISTENT BORDER SYSTEM
   ========================================================= */

.market-page {
  --market-border: #303c51;
  --market-border-strong: #40506a;
  --market-panel: #111925;
  --market-panel-inner: #151f2d;
  --market-input-border: #39475e;
}

/* Main market cards */
.market-page .market-card {
  border: 1px solid var(--market-border) !important;
  border-radius: 14px !important;
  background: var(--market-panel) !important;
  box-shadow: 0 5px 18px rgba(0,0,0,.16);
  overflow: hidden;
}

.market-page .market-card-head {
  border-bottom: 1px solid var(--market-border) !important;
  background: #141e2b;
  padding: 15px 16px;
}

/* Token price table */
.market-page table {
  border-collapse: collapse;
  border-spacing: 0;
  width: 100%;
}

.market-page thead th {
  background: #182333;
  color: #9eacc1;
  border-bottom: 1px solid var(--market-border-strong);
  font-weight: 800;
}

.market-page tbody td {
  border-top: 1px solid #29364a;
  transition: background .15s ease;
}

.market-page tbody tr:hover td {
  background: rgba(133, 151, 185, .055);
}

.market-page tbody tr:first-child td {
  border-top: 0;
}

/* Token and price hierarchy */
.market-page .asset-name {
  color: #edf2fc;
  font-size: 12px;
  font-weight: 850;
}

.market-page .price-cell {
  color: #f0f3ff;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

/* Market statistics */
.market-page .market-stat {
  border: 1px solid var(--market-border) !important;
  border-radius: 12px;
  background: var(--market-panel);
  box-shadow: 0 3px 12px rgba(0,0,0,.12);
}

.market-page .market-stat + .market-stat {
  position: relative;
}

/* Limit order form */
.market-page .market-form {
  background: transparent;
}

.market-page .market-fields {
  gap: 10px;
}

.market-page .market-field input,
.market-page .market-field select {
  border: 1px solid var(--market-input-border) !important;
  border-radius: 9px;
  background: #0e1622;
  color: #edf2fc;
  box-shadow: inset 0 1px 2px rgba(0,0,0,.15);
  transition: border-color .15s ease, box-shadow .15s ease;
}

.market-page .market-field input:hover,
.market-page .market-field select:hover {
  border-color: #586a87 !important;
}

.market-page .market-field input:focus,
.market-page .market-field select:focus {
  outline: none;
  border-color: #9878ff !important;
  box-shadow: 0 0 0 3px rgba(152,120,255,.13);
}

/* Buy / Sell controls */
.market-page .side-tabs {
  padding: 4px;
  margin: 0 0 15px;
  border: 1px solid var(--market-border);
  border-radius: 10px;
  background: #0d1520;
}

.market-page .side-tabs .market-btn {
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  transition: all .15s ease;
}

.market-page .side-tabs .market-btn.active {
  color: #d7caff;
  background: #30264a;
  border-color: #7255bb;
  box-shadow: 0 0 0 1px rgba(152,120,255,.08);
}

.market-page .side-tabs .market-btn:not(.active):hover {
  border-color: #39475e;
  background: #1b2636;
}

/* Order preview */
.market-page .market-preview {
  border: 1px solid var(--market-border-strong) !important;
  border-radius: 10px;
  background: #0e1724;
  padding: 12px;
}

.market-page .market-preview-row {
  border-bottom: 1px solid #29364a;
  padding: 8px 2px;
}

.market-page .market-preview-row:last-child {
  border-bottom: 0;
}

/* Primary action */
.market-page #placeOrderBtn {
  border: 1px solid #9878ff !important;
  border-radius: 9px;
  box-shadow: 0 3px 12px rgba(152,120,255,.13);
  font-weight: 850;
}

.market-page #placeOrderBtn:not(:disabled):hover {
  filter: brightness(1.12);
}

/* My Orders */
.market-page #my-orders-panel {
  border: 1px solid var(--market-border-strong) !important;
}

.market-page #my-orders-panel .market-card-head {
  background: #141e2b;
  border-bottom: 1px solid var(--market-border-strong) !important;
}

.market-page #my-orders-panel tbody td {
  border-top: 1px solid #29364a;
}

/* Status and notices */
.market-page .market-status {
  border: 1px solid var(--market-border) !important;
  border-radius: 9px;
  background: #111b29;
}

.market-page .order-explain {
  border-top: 1px solid var(--market-border);
  background: #141e2b;
}

/* Quote currency selector */
.market-page .quote-switch {
  padding: 3px;
  border: 1px solid var(--market-border);
  border-radius: 9px;
  background: #0e1622;
}

.market-page .quote-switch .market-btn {
  border: 1px solid transparent;
}

.market-page .quote-switch .market-btn.active {
  border-color: #7255bb;
  background: #30264a;
  color: #e0d6ff;
}

/* Responsive borders */
@media (max-width: 650px) {
  .market-page .market-card {
    border-radius: 11px !important;
  }

  .market-page .market-stat {
    border-radius: 10px;
  }
}
      </style>

      <section class="market-intro">
        <div>
          <div class="market-eyebrow">QMSwap V6 · On-chain Markets</div>
          <h1 class="market-title">Market</h1>
          <div class="market-subtitle">
            Current prices and limit trading from QMSwap.
          </div>
        </div>
        <div class="top-actions">
          <span class="muted" id="updatedAt">Not updated</span>
          <button class="market-btn primary" id="refreshBtn" type="button">Refresh</button>
        </div>
      </section>

      <section class="market-stats">
        <div class="market-stat">
          <div class="market-stat-label">QMSwap TVL</div>
          <div class="market-stat-value" id="totalTvl">—</div>
          <div class="market-stat-meta" id="tvlMeta">Selected quote currency</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">24H Trading Volume</div>
          <div class="market-stat-value" id="totalVolume">—</div>
          <div class="market-stat-meta">Estimated at current spot prices</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Active Pools</div>
          <div class="market-stat-value" id="activePools">—</div>
          <div class="market-stat-meta">Configured QMSwap pairs</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">QMS Testnet Block</div>
          <div class="market-stat-value" id="currentBlock">—</div>
          <div class="market-stat-meta" id="historyMeta">24H history checking</div>
        </div>
      </section>

      <style>
        .market-grid.market-dashboard-grid {
          align-items: stretch !important;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr) !important;
        }

        .market-left-stack {
          display: grid;
          grid-template-rows: 350px minmax(280px, 1fr);
          gap: 16px;
          min-width: 0;
          min-height: 0;
          height: 100%;
          align-self: stretch;
        }

        .market-prices-card {
          height: 350px;
          min-height: 350px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .market-prices-card .market-card-head {
          flex: 0 0 auto;
        }

        .market-prices-card .market-table-wrap {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        }

        .market-prices-card .market-table-wrap table {
          width: 100%;
          table-layout: fixed;
        }

        .market-prices-card tbody tr {
          height: 42px;
        }

        .market-prices-card tbody tr[data-token-symbol] {
          cursor: pointer;
        }

        .market-prices-card tbody tr.selected-price-row td {
          background: rgba(124, 92, 220, 0.13);
        }

        .market-prices-card tbody tr.price-empty-row {
          height: 42px;
        }

        .market-prices-card tbody tr.price-empty-row td {
          opacity: 0;
          border-color: transparent;
        }

        .price-pagination {
          flex: 0 0 42px;
          height: 42px;
          padding: 5px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(130, 150, 180, 0.18);
          color: #9baec8;
          font-size: 12px;
        }

        .price-pagination-controls {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .price-page-btn {
          border: 1px solid #35445b;
          background: #111a28;
          color: #dce7f7;
          border-radius: 7px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 11px;
        }

        .price-page-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .market-chart-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .market-chart-card .market-card-head {
          flex: 0 0 auto;
        }

        /* Keep Limit Order aligned with the full left dashboard column. */
        .market-dashboard-grid > #limit-orders {
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }

        .market-dashboard-grid > #limit-orders > .market-form {
          flex: 0 0 auto;
          width: 100%;
        }

        .limit-order-guide {
          margin: auto 15px 15px;
          padding: 15px;
          border: 1px solid rgba(130, 150, 180, 0.22);
          border-radius: 10px;
          background: #0e1724;
        }

        .limit-order-guide-title {
          margin: 0 0 13px;
          color: #e7efff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.4;
        }

        .limit-order-guide-list {
          display: grid;
          gap: 12px;
        }

        .limit-order-guide-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          align-items: start;
          gap: 10px;
        }

        .limit-order-guide-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: 1px solid #514276;
          border-radius: 7px;
          color: #c7b5ff;
          background: #211c32;
          font-size: 11px;
          font-weight: 700;
        }

        .limit-order-guide-item strong {
          display: block;
          margin: 1px 0 3px;
          color: #dce7f7;
          font-family: inherit;
          font-size: 12px;
          font-weight: 650;
        }

        .limit-order-guide-item span:last-child {
          display: block;
          color: #91a3bd;
          font-family: inherit;
          font-size: 11px;
          line-height: 1.55;
        }

        /* Match BTC / USDC to the rest of the Market typography. */
        .chart-token-label {
          display: inline-block;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #dce7f7;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: normal;
          line-height: 1.4;
        }

        .chart-summary strong {
          font-family: inherit;
          font-variant-numeric: tabular-nums;
        }

        .chart-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 0 18px 10px;
          color: #9baec8;
          font-size: 12px;
        }

        .chart-summary strong {
          color: #e7efff;
          font-size: 19px;
          font-weight: 700;
        }

        .chart-range {
          border: 1px solid #35445b;
          border-radius: 6px;
          padding: 4px 9px;
          color: #aebddd;
        }

        .price-chart-wrap {
          flex: 1 1 auto;
          min-height: 190px;
          position: relative;
          margin: 0 12px;
          overflow: hidden;
        }

        #tokenPriceChart {
          display: block;
          width: 100%;
          height: 100%;
        }

        .chart-empty-state {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          color: #91a3bd;
          font-size: 12px;
          pointer-events: none;
        }

        .chart-footnote {
          flex: 0 0 auto;
          padding: 9px 17px 13px;
          color: #879ab6;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 1100px) {
          .market-grid.market-dashboard-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .market-left-stack {
            height: auto;
            grid-template-rows: 350px 300px;
          }
        }
      </style>

      <div class="market-grid market-dashboard-grid">
        <div class="market-left-stack">
        <section class="market-card market-prices-card">
          <div class="market-card-head">
            <div>
              <h2>Token Prices</h2>
              <div class="market-hint">
                Spot prices from QMSwap V6 stablecoin pools.
              </div>
            </div>
            <div class="quote-switch">
              <button class="market-btn active" type="button"
                data-quote="USDT" aria-pressed="true">USDT</button>
              <button class="market-btn" type="button"
                data-quote="USDC" aria-pressed="false">USDC</button>
            </div>
          </div>
          <div class="market-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th id="priceHeader">Price (USDT)</th>
                  <th>24H Change</th>
                </tr>
              </thead>
              <tbody id="tokenRows">
                <tr><td colspan="3" class="empty">Loading token prices...</td></tr>
              </tbody>
            </table>
          </div>

          <div class="price-pagination" id="tokenPagination">
            <span id="tokenPageLabel">Page 1 / 1</span>
            <div class="price-pagination-controls">
              <button type="button" class="price-page-btn"
                data-page-action="previous" disabled>Previous</button>
              <button type="button" class="price-page-btn"
                data-page-action="next" disabled>Next</button>
            </div>
          </div>
        </section>

        <section class="market-card market-chart-card" id="token-chart-panel">
          <div class="market-card-head">
            <div>
              <h2>24H Price Chart</h2>
              <div class="market-hint">Select an asset from Token Prices to view its history.</div>
            </div>
            <span class="chart-token-label" id="chartTokenLabel">BTC / USDT</span>
          </div>

          <div class="chart-summary">
            <strong id="chartCurrentPrice">—</strong>
            <span class="chart-range">24 HOURS</span>
          </div>

          <div class="price-chart-wrap">
            <canvas id="tokenPriceChart"></canvas>
            <div class="chart-empty-state" id="chartEmptyState">
              Loading BTC price history...
            </div>
          </div>

          <div class="chart-footnote" id="chartFootnote">
            Prices are calculated from on-chain QMSwap V6 swaps.
          </div>
        </section>
        </div>

        <section class="market-card" id="limit-orders">
          <div class="market-card-head">
            <div>
              <h2>Place a Limit Order</h2>
              <div class="market-hint">
                Set your Buy or Sell price.
              </div>
            </div>
          </div>

          <div class="market-form">
            <div class="side-tabs">
              <button class="market-btn active" id="buyTab" type="button">Buy</button>
              <button class="market-btn" id="sellTab" type="button">Sell</button>
            </div>

            <div class="market-fields">
              <div class="market-field">
                <label for="baseToken">Base token</label>
                <select id="baseToken"></select>
              </div>
              <div class="market-field">
                <label for="quoteToken">Quote token</label>
                <select id="quoteToken"></select>
              </div>
            </div>

            <div class="market-field">
              <label id="amountLabel" for="orderAmount">Amount to spend</label>
              <input id="orderAmount" type="text" inputmode="decimal"
                placeholder="0.0" autocomplete="off">
            </div>

            <div class="market-field">
              <label id="priceLabel" for="limitPrice">Limit price</label>
              <input id="limitPrice" type="text" inputmode="decimal"
                placeholder="0.0" autocomplete="off">
            </div>

            <div class="market-field">
              <label for="orderExpiry">Order expiry</label>
              <select id="orderExpiry">
                <option value="3600">1 hour</option>
                <option value="21600">6 hours</option>
                <option value="86400" selected>24 hours</option>
                <option value="604800">7 days</option>
              </select>
            </div>

            <div class="market-preview">
              <div class="market-preview-row">
                <span>Order direction</span>
                <strong id="orderDirection">USDT → BTC</strong>
              </div>
              <div class="market-preview-row">
                <span>Minimum output</span>
                <strong id="minimumOutput">—</strong>
              </div>
              <div class="market-preview-row">
                <span>Execution condition</span>
                <strong id="executionCondition">—</strong>
              </div>
            </div>

            <button class="market-btn primary" id="placeOrderBtn"
              type="button" disabled>
              Order Book Not Deployed
            </button>
            <div class="market-status" id="orderStatus" data-tone="warn">
              Checking Limit Order Book...
            </div>
          </div>
          <div class="limit-order-guide">
            <h3 class="limit-order-guide-title">How limit orders execute</h3>

            <div class="limit-order-guide-list">
              <div class="limit-order-guide-item">
                <span class="limit-order-guide-number">01</span>
                <div>
                  <strong>Check the pool price</strong>
                  <span>The Router checks the real output after trading fees and price impact.</span>
                </div>
              </div>

              <div class="limit-order-guide-item">
                <span class="limit-order-guide-number">02</span>
                <div>
                  <strong>Instant completion</strong>
                  <span>If the current output meets your limit, the order swaps immediately when created.</span>
                </div>
              </div>

              <div class="limit-order-guide-item">
                <span class="limit-order-guide-number">03</span>
                <div>
                  <strong>Waiting for your price</strong>
                  <span>If the limit is not reached, funds stay in escrow. A later fill requires an Execute transaction.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="market-card" id="my-orders-panel">
        <div class="market-card-head">
          <div>
            <h2 id="ordersHeading">My Orders</h2>
            <div class="market-hint" id="ordersDescription">
              Orders created by your connected QMSwap wallet.
            </div>
          </div>
          <button class="market-btn" id="refreshOrdersBtn" type="button">
            Refresh My Orders
          </button>
        </div>
        <div class="market-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Amount In</th>
                <th>Entry</th>
                <th>Minimum Out</th>
                <th>Expiry</th>
                <th>Status / Action</th>
              </tr>
            </thead>
            <tbody id="orderRows">
              <tr><td colspan="6" class="empty">
                Waiting for connected wallet...
              </td></tr>
            </tbody>
          </table>
        </div>
        <div class="order-explain">
          Limit orders remain in escrow until executed, cancelled or expired.
          Execution requires a keeper or another wallet to submit the transaction.
        </div>
      </section>

      

      <div class="market-status" id="marketStatus" role="status">
        Connecting to QMS Testnet...
      </div>
      <div class="market-note">
        Prices are indicative spot prices. 24H volume is estimated from on-chain Swap events.
        Historical price change is unavailable when the RPC cannot provide historical reserves.
      </div>
    </div>
  `);

  marketModule = await import("./market.js");

  await marketModule.initMarket({
    getAccount: () => account,
    getSigner: () => signer,
    ensureWallet
  });
}
function renderSwap() {
  shell("swap",`
    <section class="intro">
      <div class="eyebrow">SWAP</div>
      <h1>Swap tokens instantly.</h1>
      <p>Trade supported assets or import a token with an active QWAP or QMSwap V6 pool.</p>
    </section>
    <section class="card swap-card">
      <div class="section-title">
        <div><h2>Swap</h2><p>Trade directly between two assets.</p></div>
        <div class="swap-header-actions">
          <button class="icon-btn"
                  id="openTokenImportModal"
                  type="button"
                  title="Import token"
                  aria-label="Import token"
                  aria-haspopup="dialog"
                  aria-controls="tokenImportModal"
                  aria-expanded="false">&#x2B;</button>
          <button class="icon-btn" id="refreshBtn" title="Refresh">&#x21BB;</button>
        </div>
      </div>
                  <div class="token-import-modal" id="tokenImportModal" hidden>
        <div class="token-import-backdrop" id="tokenImportBackdrop"></div>

        <section class="token-import-dialog"
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby="tokenImportTitle">

          <div class="token-import-modal-header">
            <div>
              <h3 id="tokenImportTitle">Import Token</h3>
              <p>Enter a QMS Testnet token contract address.</p>
            </div>

            <button class="token-import-close"
                    id="closeTokenImportModal"
                    type="button"
                    aria-label="Close">&#x2715;</button>
          </div>

          <div class="token-import-row">
            <input id="tokenAddressInput"
                   type="text"
                   spellcheck="false"
                   autocomplete="off"
                   placeholder="0x token contract address">

            <button id="importTokenBtn"
                    class="secondary-btn"
                    type="button">Find Token</button>
          </div>

          <div id="tokenImportStatus"
               class="status"
               role="status"
               aria-live="polite">
            Only tokens with a verified active QWAP or QMSwap V6 pool can be added.
          </div>
        </section>
      </div>
<div class="amount-box">
        <div class="amount-label"><span>From</span><span id="fromBalance">Balance: --</span></div>
        <div class="amount-row">
          <input id="amountIn" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0">
          <select id="fromSelect" class="token-select">${makeOptions("QWAP_USDT")}</select>
        </div>
      </div>
      <div class="flip-row"><button id="flipBtn" class="flip-btn" title="Reverse direction">&#x2193;&#x2191;</button></div>
      <div class="amount-box">
        <div class="amount-label"><span>To (estimated)</span><span id="toBalance">Balance: --</span></div>
        <div class="amount-row">
          <input id="amountOut" type="text" placeholder="0.0" readonly>
          <select id="toSelect" class="token-select">${makeOptions("QWAP_USDC")}</select>
        </div>
      </div>
      <div class="quote-box">
        <div class="quote-line"><span>Minimum received</span><strong id="minReceived">--</strong></div>
        <div class="quote-line"><span>Estimated swap gas</span><strong id="estimatedNetworkFee">Connect wallet</strong></div>
        <div class="quote-line"><span>Receive after gas</span><strong id="netOutput">--</strong></div>
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
      <div class="quote-box swap-receipt-panel" id="swapReceiptPanel" hidden aria-live="polite">
        <div class="quote-line"><span>Transaction status</span><strong id="receiptStatus">--</strong></div>
        <div class="quote-line"><span>Actual received</span><strong id="actualReceived">--</strong></div>
        <div class="quote-line"><span>Actual network fee</span><strong id="actualGasFee">--</strong></div>
        <div class="quote-line"><span>Gas estimate difference</span><strong id="gasEstimateDifference">--</strong></div>
        <div class="quote-line"><span>Actual output vs quote</span><strong id="actualOutputDeviation">--</strong></div>
        <div class="quote-line"><span>Confirmed block</span><strong id="receiptBlock">--</strong></div>
        <div class="quote-line"><span>Transaction hash</span><strong id="receiptTxHash">--</strong></div>
      </div>
    </section>`);
  bindSwap();
}

function makeRemovePoolOptions() {
  const source = CFG?.pairs || {};
  const entries = Array.isArray(source)
    ? source.map(p => [`${p.tokenA}/${p.tokenB}`, p])
    : Object.entries(source);

  const options = entries.map(([label, value]) => {
    const [tokenA, tokenB] = String(label).split("/");
    const pairAddress = typeof value === "string" ? value : value?.address;

    if (!tokenA || !tokenB || !asset(tokenA)?.address || !asset(tokenB)?.address) return "";
    if (pairAddress && !ethers.isAddress(pairAddress)) return "";

    return `<option value="${tokenA}/${tokenB}">${tokenA} / ${tokenB}</option>`;
  }).filter(Boolean);

  return `<option value="">Choose a pool</option>${options.join("")}`;
}

function renderLiquidity() {
  shell("liquidity",`
    <section class="intro">
      <div class="eyebrow">LIQUIDITY</div>
      <h1>Provide liquidity.</h1>
      <p>Add assets to a pool or review your LP position.</p>
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
        <div class="quote-line"><span>Estimated LP shares</span><strong id="sharesInfo">Enter an amount</strong></div>
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
    </section>

    <section class="card liquidity-card">
      <div class="section-title">
        <div><h2>Remove Liquidity</h2><p>Review your LP position and estimated token returns.</p></div>
        <button class="secondary-btn" id="refreshRemoveBtn" type="button">Refresh</button>
      </div>

      <div class="amount-box">
        <div class="amount-label"><span>Pool</span><span id="removePoolAddress">—</span></div>
        <div class="amount-row">
          <select id="removePool" class="token-select">${makeRemovePoolOptions()}</select>
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">
          <span>LP token amount</span>
          <span id="removeLpBalance">Connect wallet to view balance</span>
        </div>
        <div class="amount-row">
          <input id="removeLpAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0">
          <button id="removeMaxBtn" class="secondary-btn" type="button">MAX</button>
        </div>
      </div>

      <div class="quote-box">
        <div class="quote-line"><span>Estimated token A</span><strong id="removeEstimateA">—</strong></div>
        <div class="quote-line"><span>Estimated token B</span><strong id="removeEstimateB">—</strong></div>
        <div class="quote-line"><span>Minimum token A</span><strong id="removeMinA">—</strong></div>
        <div class="quote-line"><span>Minimum token B</span><strong id="removeMinB">—</strong></div>
        <div class="quote-line"><span>Slippage setting</span><strong>Uses the setting above</strong></div>
      </div>

      <div id="removeFeatureNotice" class="status">
        Removal is disabled until the upgraded Pair and Router contracts, including native QMS withdrawal, are deployed and verified.
      </div>
      <button id="removeBtn" class="primary-btn" type="button" disabled>Remove Liquidity</button>
      <div id="removeStatus" class="status" role="status">Select a pool and enter an LP amount.</div>
      <a id="removeTxLink" class="tx-link" target="_blank" rel="noopener noreferrer" hidden></a>
    </section>
  `);

  const enabled = CFG?.features?.removeLiquidity === true;
  $("removeFeatureNotice").hidden = enabled;
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
  link.textContent = "View transaction on QMSScan ->";
  link.hidden = false;
}

const SWAP_PENDING_STORAGE_KEY = "qmswap.pendingSwap.v1";

function savePendingSwapMonitor(pending) {
  try {
    if (!pending) {
      sessionStorage.removeItem(SWAP_PENDING_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(
      SWAP_PENDING_STORAGE_KEY,
      JSON.stringify({
        hash: pending.hash,
        submittedAt: pending.submittedAt,
        chainId: String(CHAIN_ID),
        fromKey: pending.fromKey,
        toKey: pending.toKey,
        amountIn: String(pending.amountIn),
        expectedAmountOut: String(pending.expectedAmountOut),
        minimumReceived: String(pending.minimumReceived),
        estimatedGasWei: String(pending.estimatedGasWei ?? 0n),
        outputAddress: pending.outputAddress,
        recipient: pending.recipient,
        outputDecimals: pending.outputDecimals,
        outputSymbol: pending.outputSymbol,
        venue: pending.venue
      })
    );
  } catch (error) {
    console.warn("Pending transaction storage unavailable:", error);
  }
}

function loadPendingSwapMonitor() {
  try {
    const raw = sessionStorage.getItem(SWAP_PENDING_STORAGE_KEY);

    if (!raw) return null;

    const saved = JSON.parse(raw);

    if (
      saved.chainId !== String(CHAIN_ID) ||
      !ethers.isHexString(saved.hash, 32) ||
      !ethers.isAddress(saved.outputAddress) ||
      !ethers.isAddress(saved.recipient)
    ) {
      sessionStorage.removeItem(SWAP_PENDING_STORAGE_KEY);
      return null;
    }

    return {
      ...saved,
      amountIn: BigInt(saved.amountIn),
      expectedAmountOut: BigInt(saved.expectedAmountOut),
      minimumReceived: BigInt(saved.minimumReceived),
      estimatedGasWei: BigInt(saved.estimatedGasWei || "0"),
      outputDecimals: Number(saved.outputDecimals)
    };
  } catch (error) {
    console.warn("Could not restore pending swap:", error);
    return null;
  }
}

let pendingSwapMonitor = loadPendingSwapMonitor();

function clearPendingSwapMonitor() {
  pendingSwapMonitor = null;
  savePendingSwapMonitor(null);
}

function setSwapReceiptPending(pending) {
  const panel = $("swapReceiptPanel");
  if (!panel) return;

  panel.hidden = false;

  $("receiptStatus").textContent = "Pending confirmation";
  $("actualReceived").textContent = "Waiting for receipt";
  $("actualGasFee").textContent = "--";
  $("gasEstimateDifference").textContent = "--";
  $("actualOutputDeviation").textContent = "--";
  $("receiptBlock").textContent = "Pending";
  $("receiptTxHash").textContent = pending.hash;

  const button = $("swapBtn");
  if (button) button.textContent = "Check transaction";
}

function decodeActualSwapOutput(receipt, pending) {
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];

  if (pending.toKey === "QMS") {
    const withdrawalInterface = new ethers.Interface([
      "event Withdrawal(address indexed src, uint256 wad)"
    ]);

    let totalReceived = 0n;

    for (const log of logs) {
      if (
        String(log.address).toLowerCase() !==
        String(pending.outputAddress).toLowerCase()
      ) {
        continue;
      }

      try {
        const parsed = withdrawalInterface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed && parsed.name === "Withdrawal") {
          totalReceived += BigInt(parsed.args.wad);
        }
      } catch {
        // Ignore unrelated logs from the wrapped-native contract.
      }
    }

    return totalReceived > 0n
      ? { amount: totalReceived, source: "Withdrawal event" }
      : { amount: null, source: "Withdrawal event not found" };
  }

  const transferInterface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ]);

  let totalReceived = 0n;

  for (const log of logs) {
    if (
      String(log.address).toLowerCase() !==
      String(pending.outputAddress).toLowerCase()
    ) {
      continue;
    }

    try {
      const parsed = transferInterface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (
        parsed &&
        parsed.name === "Transfer" &&
        String(parsed.args.to).toLowerCase() ===
          String(pending.recipient).toLowerCase()
      ) {
        totalReceived += BigInt(parsed.args.value);
      }
    } catch {
      // Ignore logs that are not ERC20 Transfer events.
    }
  }

  return totalReceived > 0n
    ? { amount: totalReceived, source: "ERC20 Transfer event" }
    : { amount: null, source: "Output Transfer event not found" };
}

function getActualGasFeeWei(receipt) {
  try {
    if (receipt.fee !== null && receipt.fee !== undefined) {
      return BigInt(receipt.fee);
    }

    const effectiveGasPrice =
      receipt.gasPrice ?? receipt.effectiveGasPrice;

    if (
      receipt.gasUsed !== null &&
      receipt.gasUsed !== undefined &&
      effectiveGasPrice !== null &&
      effectiveGasPrice !== undefined
    ) {
      return BigInt(receipt.gasUsed) *
        BigInt(effectiveGasPrice);
    }
  } catch (error) {
    console.warn("Actual gas fee decoding failed:", error);
  }

  return null;
}

function formatOutputDifference(actual, expected) {
  if (actual === null || expected <= 0n) {
    return "Unavailable";
  }

  const difference = actual - expected;
  const absoluteBps =
    (difference >= 0n ? difference : -difference) *
    10000n / expected;

  const percentage = (Number(absoluteBps) / 100).toFixed(2);
  const sign = difference > 0n ? "+" : difference < 0n ? "-" : "";

  return sign + percentage + "% vs quote";
}

function formatGasEstimateDifference(actualFee, estimatedFee) {
  if (
    actualFee === null ||
    estimatedFee === null ||
    estimatedFee <= 0n
  ) {
    return "Unavailable";
  }

  const difference = actualFee - estimatedFee;
  const absoluteBps =
    (difference >= 0n ? difference : -difference) *
    10000n / estimatedFee;

  const percentage = (Number(absoluteBps) / 100).toFixed(2);
  const sign = difference > 0n ? "+" : difference < 0n ? "-" : "";

  return sign + percentage + "% vs estimate";
}


const TRADE_HISTORY_STORAGE_PREFIX = "qmswap.tradeHistory.v1";
const TRADE_HISTORY_MAX_RECORDS = 500;

async function persistVerifiedSwapHistory(
  receipt,
  pending,
  successful,
  actualOutput,
  actualGasFeeWei
) {
  try {
    const wallet = String(pending.recipient || "").toLowerCase();

    if (!ethers.isAddress(wallet)) {
      console.warn("Trade history record skipped: invalid wallet.");
      return;
    }

    const storageKey =
      `${TRADE_HISTORY_STORAGE_PREFIX}:${String(CHAIN_ID)}:${wallet}`;

    let timestamp = Date.now();
    let timestampSource = "local-confirmation";

    if (receipt.blockNumber !== null && receipt.blockNumber !== undefined) {
      try {
        const block = await rpc.getBlock(receipt.blockNumber);

        if (block && Number(block.timestamp) > 0) {
          timestamp = Number(block.timestamp) * 1000;
          timestampSource = "block";
        }
      } catch (error) {
        console.warn("Could not retrieve confirmation block timestamp:", error);
      }
    }

    let inputSymbol = String(pending.fromKey || "Unknown");
    let inputDecimals = 18;

    try {
      const inputAsset = asset(pending.fromKey);
      inputSymbol = inputAsset.symbol || inputSymbol;
      inputDecimals = tokenDecimals(pending.fromKey);
    } catch (error) {
      console.warn("Input token metadata unavailable for history:", error);
    }

    const actualReceived =
      actualOutput && actualOutput.amount !== null &&
      actualOutput.amount !== undefined
        ? BigInt(actualOutput.amount)
        : null;

    const expectedOutput = BigInt(pending.expectedAmountOut ?? 0n);

    let actualOutputDeviationBps = null;

    if (actualReceived !== null && expectedOutput > 0n) {
      actualOutputDeviationBps = String(
        (actualReceived - expectedOutput) * 10000n / expectedOutput
      );
    }

    const estimatedGasWei = BigInt(pending.estimatedGasWei ?? 0n);

    let gasEstimateDifferenceBps = null;

    if (
      actualGasFeeWei !== null &&
      actualGasFeeWei !== undefined &&
      estimatedGasWei > 0n
    ) {
      gasEstimateDifferenceBps = String(
        (BigInt(actualGasFeeWei) - estimatedGasWei) *
        10000n / estimatedGasWei
      );
    }

    const record = {
      schemaVersion: 1,
      chainId: String(CHAIN_ID),
      wallet,
      hash: String(pending.hash).toLowerCase(),
      status: successful ? "success" : "failed",
      fromKey: String(pending.fromKey || ""),
      toKey: String(pending.toKey || ""),
      fromSymbol: inputSymbol,
      outputSymbol: String(pending.outputSymbol || pending.toKey || "Unknown"),
      inputDecimals,
      outputDecimals: Number(pending.outputDecimals ?? 18),
      amountInRaw: String(pending.amountIn ?? 0n),
      expectedAmountOutRaw: String(expectedOutput),
      minimumReceivedRaw: String(pending.minimumReceived ?? 0n),
      actualReceivedRaw:
        actualReceived !== null ? String(actualReceived) : null,
      actualOutputVerified: actualReceived !== null,
      actualGasFeeWei:
        actualGasFeeWei !== null && actualGasFeeWei !== undefined
          ? String(actualGasFeeWei)
          : null,
      estimatedGasWei: String(estimatedGasWei),
      actualOutputDeviationBps,
      gasEstimateDifferenceBps,
      blockNumber:
        receipt.blockNumber !== null &&
        receipt.blockNumber !== undefined
          ? String(receipt.blockNumber)
          : null,
      timestamp,
      timestampSource,
      venue: String(pending.venue || "QWAP"),
      receiptVerified: true
    };

    let existing = [];

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) existing = saved;
    } catch (error) {
      console.warn("Existing trade history could not be parsed:", error);
    }

    const updated = [
      record,
      ...existing.filter(item =>
        String(item.hash || "").toLowerCase() !== record.hash
      )
    ]
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
      .slice(0, TRADE_HISTORY_MAX_RECORDS);

    localStorage.setItem(storageKey, JSON.stringify(updated));

    console.info("Verified Swap transaction saved to trade history:", record.hash);
  } catch (error) {
    console.warn("Could not save verified Swap transaction to history:", error);
  }
}
async function processSwapReceipt(receipt, pending) {
  const successful = Number(receipt.status) === 1;
  const panel = $("swapReceiptPanel");

  if (panel) panel.hidden = false;

  showTx(pending.hash);

  const actualGasFeeWei = getActualGasFeeWei(receipt);

  $("actualGasFee").textContent =
    actualGasFeeWei !== null
      ? fmt(actualGasFeeWei, 18, 18) + " QMS"
      : "Unavailable";

  $("gasEstimateDifference").textContent =
    formatGasEstimateDifference(
      actualGasFeeWei,
      pending.estimatedGasWei
    );

  $("receiptBlock").textContent =
    receipt.blockNumber !== null &&
    receipt.blockNumber !== undefined
      ? String(receipt.blockNumber)
      : "Unavailable";

  $("receiptTxHash").textContent = pending.hash;

  let actualOutput = {
    amount: null,
    source: "Output transfer not verified"
  };

  if (successful) {
    actualOutput = decodeActualSwapOutput(receipt, pending);

    $("receiptStatus").textContent = "Confirmed";

    $("actualReceived").textContent =
      actualOutput.amount !== null
        ? fmt(
            actualOutput.amount,
            pending.outputDecimals,
            10
          ) + " " + pending.outputSymbol
        : "Unavailable from receipt logs";

    $("actualOutputDeviation").textContent =
      formatOutputDifference(
        actualOutput.amount,
        pending.expectedAmountOut
      );

    const belowMinimum =
      actualOutput.amount !== null &&
      actualOutput.amount < pending.minimumReceived;

    setStatus(
      belowMinimum
        ? "Swap confirmed. Actual recipient transfer is below the displayed minimum. Check the token transfer behavior."
        : actualOutput.amount === null
          ? "Swap confirmed on-chain. The output transfer amount could not be decoded from receipt logs."
          : "Swap confirmed. Actual output and network fee verified from the transaction receipt.",
      belowMinimum ? "error" : "success"
    );
  } else {
    $("receiptStatus").textContent = "Reverted";
    $("actualReceived").textContent = "No successful output";
    $("actualOutputDeviation").textContent = "Not applicable";

    setStatus(
      "Transaction reverted on-chain. The actual network fee is shown in the receipt panel.",
      "error"
    );
  }

  await persistVerifiedSwapHistory(
    receipt,
    pending,
    successful,
    actualOutput,
    actualGasFeeWei
  );

  clearPendingSwapMonitor();

  const button = $("swapBtn");
  if (button) button.textContent = "Swap";

  return successful;
}

async function waitForSwapReceipt(tx, pending) {
  try {
    const receipt = await tx.wait(1, 30000);

    if (receipt) return receipt;
  } catch (error) {
    if (error && error.receipt) {
      return error.receipt;
    }

    console.warn(
      "Transaction wait returned an error; checking QMS Testnet receipt:",
      error
    );
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const receipt = await rpc.getTransactionReceipt(pending.hash);

      if (receipt) return receipt;
    } catch (error) {
      console.warn("Receipt lookup attempt failed:", error);
    }

    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  return null;
}

async function reconcilePendingSwap() {
  const pending = pendingSwapMonitor;

  if (!pending) return;

  showTx(pending.hash);
  setSwapReceiptPending(pending);

  setStatus(
    "Checking the existing transaction on QMS Testnet. No new swap will be submitted..."
  );

  try {
    const receipt = await rpc.getTransactionReceipt(pending.hash);

    if (!receipt) {
      setStatus(
        "Transaction is still pending or not yet visible to the RPC. Its hash has been preserved. Press Check transaction again later."
      );
      return;
    }

    await processSwapReceipt(receipt, pending);

    if (Number(receipt.status) === 1) {
      try {
        await refreshBalances();
        await updateSwapQuote();
        setStatus(
          "Previous swap confirmed. Balances have been refreshed.",
          "success"
        );
      } catch (error) {
        console.warn("Post-confirmation refresh failed:", error);
      }
    }
  } catch (error) {
    console.warn("Pending transaction reconciliation failed:", error);

    setStatus(
      "Could not retrieve the transaction receipt. The transaction hash is preserved; check again later."
    );
  }
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

  rebuildAssetRegistry();

  factoryRead = new ethers.Contract(CFG.factory,factoryAbi,rpc);
  routerRead = new ethers.Contract(CFG.router,routerAbi,rpc);
  qwapRouterRead = new ethers.Contract(QWAP_ROUTER_ADDRESS,qwapRouterAbi,rpc);
}

function getPage() {
  const path = location.pathname.toLowerCase();

  if (path.endsWith("/market.html")) return "market";
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

    await ensureQmsNetworkConfigured();

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

  // Market receives the same account and signer used by the whole QMSwap app.
  if (getPage() === "market" && marketModule?.onWalletChanged) {
    await marketModule.onWalletChanged(account, signer);
  }

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
  $("importTokenBtn").addEventListener("click", importTokenByAddress);
  const importModal = $("tokenImportModal");

  const showImportModal = () => {
    importModal.hidden = false;
    document.body.classList.add("token-import-modal-open");
    $("openTokenImportModal").setAttribute("aria-expanded", "true");
    $("tokenAddressInput").focus();
  };

  const hideImportModal = () => {
    importModal.hidden = true;
    document.body.classList.remove("token-import-modal-open");
    $("openTokenImportModal").setAttribute("aria-expanded", "false");
    $("openTokenImportModal").focus();
  };

  $("openTokenImportModal").addEventListener("click", showImportModal);
  $("closeTokenImportModal").addEventListener("click", hideImportModal);
  $("tokenImportBackdrop").addEventListener("click", hideImportModal);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !importModal.hidden) {
      hideImportModal();
    }
  });
  
  $("tokenAddressInput").addEventListener("keydown", event => {
    if (event.key === "Enter") importTokenByAddress();
  });
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

  refreshSwapTokenOptions();
  updateBalanceLabels();
  await updateSwapQuote();

  if (pendingSwapMonitor) {
    showTx(pendingSwapMonitor.hash);
    setSwapReceiptPending(pendingSwapMonitor);

    setStatus(
      "A previous swap transaction is awaiting confirmation. Press Check transaction to verify it before submitting another swap."
    );
  }
}

function isQwapAssetKey(key) {
  if (Object.prototype.hasOwnProperty.call(QWAP_TOKEN_ASSETS,key)) return true;

  const custom = customQwapAssets[key];
  if (!custom) return false;
  if (custom.source === "QPad") return true;
  return custom.source === "Imported" &&
    Array.isArray(custom.pools) &&
    custom.pools.some(pool => pool.venue === "QWAP");
}

function qwapRouteAddress(key) {
  if (key === "QMS") return QWAP_WRAPPED_NATIVE_ADDRESS;
  return isQwapAssetKey(key) ? asset(key).address : null;
}

function customQwapKey(address) {
  return `QWAP_MEME_${address.toLowerCase()}`;
}

function isConfiguredQmswapToken(address) {
  const normalized = String(address || "").toLowerCase();

  return Object.entries(CFG?.tokens || {}).some(([key, item]) =>
    key !== "QMS" &&
    String(item?.address || "").toLowerCase() === normalized
  );
}

function isQmswapAssetKey(key) {
  const custom = customQwapAssets[key];

  return custom?.source === "Imported" &&
    Array.isArray(custom.pools) &&
    custom.pools.some(pool => pool?.venue === "QMSwap");
}

function refreshSwapTokenOptions() {
  const fromSelect = $("fromSelect");
  const toSelect = $("toSelect");
  if (!fromSelect || !toSelect) return;

  const keys = assetKeys("swap");
  const oldFrom = fromSelect.value;
  const oldTo = toSelect.value;
  const defaultFrom = keys.includes("QWAP_USDT") ? "QWAP_USDT" : (keys[0] || "");
  const defaultTo = keys.includes("QWAP_USDC")
    ? "QWAP_USDC"
    : (keys.find(key => key !== defaultFrom) || "");

  fromSelect.innerHTML = makeOptions(keys.includes(oldFrom) ? oldFrom : defaultFrom);
  toSelect.innerHTML = makeOptions(keys.includes(oldTo) ? oldTo : defaultTo);

  fromSelect.value = keys.includes(oldFrom) ? oldFrom : defaultFrom;
  toSelect.value = keys.includes(oldTo) ? oldTo : defaultTo;

  if (fromSelect.value === toSelect.value) {
    toSelect.value = keys.find(key => key !== fromSelect.value) || "";
  }
}

const ERC20_METADATA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

function importedTokenKey(address) {
  return `IMPORTED_${ethers.getAddress(address).toLowerCase()}`;
}

function cleanTokenName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 48);
}

function cleanTokenSymbol(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._$-]/g, "")
    .slice(0, 16);
}

async function readImportedTokenMetadata(address) {
  const code = await rpc.getCode(address);
  if (!code || code === "0x") {
    throw new Error("The supplied address has no contract bytecode on QMS Testnet.");
  }

  const token = new ethers.Contract(address, ERC20_METADATA_ABI, rpc);
  const [rawName, rawSymbol, rawDecimals] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals()
  ]);

  const name = cleanTokenName(rawName);
  const symbol = cleanTokenSymbol(rawSymbol);
  const decimals = Number(rawDecimals);

  if (!name || !symbol) {
    throw new Error("The contract does not expose valid ERC-20 name and symbol metadata.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("The token decimals value is outside the supported range (0-36).");
  }

  return { name, symbol, decimals };
}

function getPoolDiscoveryBases(venue) {
  const entries = venue === "QWAP" ? Object.entries(QWAP_TOKEN_ASSETS) : Object.entries(CFG?.tokens || {});

  const seen = new Set();
  return entries.map(([key, item]) => ({
    key,
    address: item?.address,
    symbol: item?.symbol || key,
    displayName: item?.displayName || key
  })).filter(item => {
    if (!item.address || !ethers.isAddress(item.address)) return false;
    const identity = assetIdentity(item.address);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

async function inspectImportedPool(venue, factoryAddress, tokenAddress, base) {
  const factory = new ethers.Contract(
    factoryAddress,
    QWAP_DISCOVERY_FACTORY_ABI,
    rpc
  );
  const pairAddress = await factory.getPair(tokenAddress, base.address);
  if (!pairAddress || pairAddress.toLowerCase() === ZERO.toLowerCase()) return null;

  const pairCode = await rpc.getCode(pairAddress);
  if (!pairCode || pairCode === "0x") return null;

  const pairAbi = venue === "QWAP"
    ? [
        "function token0() view returns(address)",
        "function token1() view returns(address)",
        "function getReserves() view returns(uint112,uint112,uint32)"
      ]
    : [
        "function token0() view returns(address)",
        "function token1() view returns(address)",
        "function getReserves() view returns(uint256,uint256)"
      ];

  const pair = new ethers.Contract(pairAddress, pairAbi, rpc);
  const [token0, token1, reserves] = await Promise.all([
    pair.token0(),
    pair.token1(),
    pair.getReserves()
  ]);

  const expectedToken = tokenAddress.toLowerCase();
  const expectedBase = base.address.toLowerCase();
  const actual0 = token0.toLowerCase();
  const actual1 = token1.toLowerCase();
  const validTokens =
    (actual0 === expectedToken && actual1 === expectedBase) ||
    (actual1 === expectedToken && actual0 === expectedBase);

  if (!validTokens) return null;
  if (BigInt(reserves[0]) <= 0n || BigInt(reserves[1]) <= 0n) return null;

  return {
    venue,
    pairAddress: ethers.getAddress(pairAddress),
    baseKey: base.key,
    baseAddress: ethers.getAddress(base.address),
    baseSymbol: cleanTokenSymbol(base.symbol) || base.key
  };
}

async function discoverImportedTokenPools(address) {
  const checks = [];

  for (const base of getPoolDiscoveryBases("QWAP")) {
    if (base.address.toLowerCase() === address.toLowerCase()) continue;
    checks.push(inspectImportedPool("QWAP", QWAP_FACTORY_ADDRESS, address, base));
  }


  for (const base of getPoolDiscoveryBases("QMSwap")) {
    if (base.address.toLowerCase() === address.toLowerCase()) continue;
    checks.push(inspectImportedPool("QMSwap", CFG.factory, address, base));
  }
  const results = await Promise.allSettled(checks);
  return results
    .filter(result => result.status === "fulfilled" && result.value)
    .map(result => result.value);
}

async function validateCachedImportedPools(address, cachedPools) {
  const valid = [];
  for (const cached of (Array.isArray(cachedPools) ? cachedPools : []).slice(0, 20)) {
    const venue = cached?.venue;
    if (venue !== "QWAP" && venue !== "QMSwap") continue;
    if (!ethers.isAddress(cached.baseAddress) || !ethers.isAddress(cached.pairAddress)) continue;

    const factoryAddress = venue === "QWAP" ? QWAP_FACTORY_ADDRESS : CFG.factory;
    const base = getPoolDiscoveryBases(venue).find(item =>
      item.address.toLowerCase() === cached.baseAddress.toLowerCase()
    );
    if (!base) continue;

    try {
      const current = await inspectImportedPool(venue, factoryAddress, address, base);
      if (current && current.pairAddress.toLowerCase() === cached.pairAddress.toLowerCase()) {
        valid.push(current);
      }
    } catch {}
  }
  return valid;
}

function registerImportedToken(address, metadata, pools) {
  const key = importedTokenKey(address);
  customQwapAssets[key] = {
    address: ethers.getAddress(address),
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    displayName: metadata.symbol,
    custom: true,
    source: "Imported",
    pools,
    venues: [...new Set(pools.map(pool => pool.venue))]
  };
  rebuildAssetRegistry();
  return key;
}

function saveImportedTokens() {
  const items = Object.values(customQwapAssets)
    .filter(item => item?.source === "Imported")
    .slice(0, MAX_IMPORTED_ASSETS)
    .map(item => ({
      address: item.address,
      name: item.name,
      symbol: item.symbol,
      decimals: item.decimals,
      pools: item.pools
    }));

  try {
    localStorage.setItem(IMPORTED_ASSETS_STORAGE_KEY, JSON.stringify({
      version: 1,
      chainId: Number(CHAIN_ID),
      items
    }));
  } catch (error) {
    console.warn("Imported token cache could not be saved:", error);
  }
}

async function restoreImportedTokens() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(IMPORTED_ASSETS_STORAGE_KEY) || "null");
  } catch {
    return;
  }

  if (
    !saved || saved.version !== 1 ||
    Number(saved.chainId) !== Number(CHAIN_ID) ||
    !Array.isArray(saved.items)
  ) return;

  const items = saved.items.slice(0, MAX_IMPORTED_ASSETS);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (!ethers.isAddress(item?.address)) continue;
      const address = ethers.getAddress(item.address);
      if (getAssetByAddress(address) && !isConfiguredQmswapToken(address)) continue;

      try {
        const metadata = await readImportedTokenMetadata(address);
        const pools = await validateCachedImportedPools(address, item.pools);
        if (pools.length > 0) registerImportedToken(address, metadata, pools);
      } catch (error) {
        console.debug("Imported token restore skipped:", address, error);
      }
    }
  });

  await Promise.all(workers);
  rebuildAssetRegistry();
}

async function importTokenByAddress() {
  if (tokenImportBusy) return;

  const input = $("tokenAddressInput");
  const status = $("tokenImportStatus");
  const button = $("importTokenBtn");
  const rawAddress = input?.value.trim() || "";

  try {
    tokenImportBusy = true;
    if (button) button.disabled = true;

    if (!ethers.isAddress(rawAddress)) {
      throw new Error("Enter a valid token contract address.");
    }
    const address = ethers.getAddress(rawAddress);
    if (address.toLowerCase() === ZERO.toLowerCase()) {
      throw new Error("The zero address cannot be imported.");
    }

    const network = await rpc.getNetwork();
    if (network.chainId !== CHAIN_ID) {
      throw new Error("The configured RPC is not connected to QMS Testnet.");
    }

    const existing = getAssetByAddress(address);
    const alreadyImported = Object.values(customQwapAssets).some(item =>
      item?.source === "Imported" &&
      String(item.address || "").toLowerCase() === address.toLowerCase()
    );

    if (existing && (!isConfiguredQmswapToken(address) || alreadyImported)) {
      status.textContent = `${existing.symbol} is already available as ${existing.displayName}.`;
      return;
    }

    status.className = "status";
    status.textContent = "Checking contract metadata and searching QWAP and QMSwap pools...";

    const metadata = await readImportedTokenMetadata(address);
    const pools = await discoverImportedTokenPools(address);

    if (pools.length === 0) {
      throw new Error("No active QWAP or QMSwap pool with non-zero reserves was found. The token was not added.");
    }

    const key = registerImportedToken(address, metadata, pools);
    saveImportedTokens();
    refreshSwapTokenOptions();

    const poolSummary = pools.map(pool =>
      `${pool.venue} ${pool.baseSymbol} (${pool.pairAddress.slice(0, 8)}...${pool.pairAddress.slice(-6)})`
    ).join("; ");

    input.value = "";
    status.className = "status success";
    status.textContent = `${metadata.name} (${metadata.symbol}) imported. Active pools: ${poolSummary}. Select ${metadata.symbol} in the swap list to request a quote.`;
    if (account) {
      try {
        const token = new ethers.Contract(address, tokenAbi, rpc);
        balances[key] = BigInt(await token.balanceOf(account));
      } catch (error) {
        console.warn("Imported token balance read failed:", address, error);
      }
    }
    updateBalanceLabels();
    await updateSwapQuote();
  } catch (error) {
    status.className = "status error";
    status.textContent = errorText(error);
  } finally {
    tokenImportBusy = false;
    if (button) button.disabled = false;
  }
}

async function inspectQpadGraduatedToken(factory, qwapFactory, tokenAddress) {
  const address = ethers.getAddress(tokenAddress);
  const key = customQwapKey(address);

  const code = await rpc.getCode(address);
  if (!code || code === "0x") return false;

  const pairAddress = await qwapFactory.getPair(
    address,
    QWAP_WRAPPED_NATIVE_ADDRESS
  );

  if (!pairAddress ||
      pairAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    return false;
  }

  const pair = new ethers.Contract(
    pairAddress,
    QWAP_DISCOVERY_PAIR_ABI,
    rpc
  );

  const [token0, token1, reserves, totalSupply, burnedLp] =
    await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
      pair.totalSupply(),
      pair.balanceOf(QWAP_DISCOVERY_BURN_ADDRESS)
    ]);

  const token0Lower = token0.toLowerCase();
  const token1Lower = token1.toLowerCase();
  const wrappedLower = QWAP_WRAPPED_NATIVE_ADDRESS.toLowerCase();
  const addressLower = address.toLowerCase();

  const isCorrectPair =
    (token0Lower === addressLower && token1Lower === wrappedLower) ||
    (token1Lower === addressLower && token0Lower === wrappedLower);

  if (!isCorrectPair) return false;
  if (BigInt(reserves[0]) <= 0n || BigInt(reserves[1]) <= 0n) return false;
  if (BigInt(totalSupply) <= 0n || BigInt(burnedLp) !== BigInt(totalSupply)) {
    return false;
  }

  const token = new ethers.Contract(
    address,
    QWAP_DISCOVERY_TOKEN_ABI,
    rpc
  );

  let symbol;
  let decimals;

  try {
    [symbol, decimals] = await Promise.all([
      token.symbol(),
      token.decimals()
    ]);
  } catch {
    return false;
  }

  decimals = Number(decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return false;
  }

  symbol = String(symbol)
    .trim()
    .replace(/[^a-zA-Z0-9._$-]/g, "")
    .slice(0, 16) || "MEME";

  if (!customQwapAssets[key] && !getAssetByAddress(address)) {
    customQwapAssets[key] = {
      address,
      symbol,
      decimals,
      displayName: `${symbol} (QWAP)`,
      custom: true,
      source: "QPad"
    };
    rebuildAssetRegistry();
    return true;
  }

  return false;
}

function emptyQpadDiscoveryState() {
  return {
    version: 2,
    chainId: Number(CHAIN_ID),
    factory: QPAD_FACTORY_ADDRESS.toLowerCase(),
    nextIndex: 0,
    scannedTotal: 0,
    discovered: [],
    restored: false
  };
}

function getQpadDiscoveryState(total) {
  if (qpadDiscoveryState) {
    if (
      qpadDiscoveryState.nextIndex > total ||
      qpadDiscoveryState.scannedTotal > total
    ) {
      qpadDiscoveryState = emptyQpadDiscoveryState();
    }
    return qpadDiscoveryState;
  }

  let saved = null;

  try {
    saved = JSON.parse(localStorage.getItem(QWAP_AUTO_STORAGE_KEY) || "null");
  } catch {}

  const valid =
    saved &&
    saved.version === 2 &&
    Number(saved.chainId) === Number(CHAIN_ID) &&
    String(saved.factory || "").toLowerCase() ===
      QPAD_FACTORY_ADDRESS.toLowerCase() &&
    Number.isSafeInteger(Number(saved.nextIndex)) &&
    Number.isSafeInteger(Number(saved.scannedTotal)) &&
    Array.isArray(saved.discovered);

  if (valid) {
    qpadDiscoveryState = {
      ...emptyQpadDiscoveryState(),
      nextIndex: Math.max(0, Number(saved.nextIndex)),
      scannedTotal: Math.max(0, Number(saved.scannedTotal)),
      discovered: saved.discovered
        .filter(item =>
          Number.isSafeInteger(Number(item.index)) &&
          Number(item.index) >= 0 &&
          Number(item.index) < total &&
          ethers.isAddress(item.address)
        )
        .map(item => ({
          index: Number(item.index),
          address: ethers.getAddress(item.address)
        }))
    };
  } else {
    qpadDiscoveryState = emptyQpadDiscoveryState();
  }

  if (
    qpadDiscoveryState.nextIndex > total ||
    qpadDiscoveryState.scannedTotal > total
  ) {
    qpadDiscoveryState = emptyQpadDiscoveryState();
  }

  return qpadDiscoveryState;
}

function saveQpadDiscoveryState(state) {
  try {
    const persisted = { ...state };
    delete persisted.restored;
    localStorage.setItem(QWAP_AUTO_STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    console.debug("QPad discovery cache unavailable:", error);
  }
}

async function restoreQpadDiscoveryCache(factory, qwapFactory, state) {
  if (state.restored) return false;

  const validItems = [];
  const seen = new Set();
  let changed = false;

  for (
    let offset = 0;
    offset < state.discovered.length;
    offset += QPAD_DISCOVERY_CONCURRENCY
  ) {
    const batch = state.discovered.slice(
      offset,
      offset + QPAD_DISCOVERY_CONCURRENCY
    );

    const results = await Promise.all(batch.map(async item => {
      try {
        const record = await factory.allTokens(item.index);
        const listedAddress = ethers.getAddress(record.token || record[0]);

        if (listedAddress.toLowerCase() !== item.address.toLowerCase()) {
          return null;
        }

        const added = await inspectQpadGraduatedToken(
          factory,
          qwapFactory,
          listedAddress
        );

        return { item, added };
      } catch (error) {
        console.debug("QPad cached token revalidation deferred:", error);
        return { item, added: false };
      }
    }));

    for (const result of results) {
      if (!result) continue;

      const addressKey = result.item.address.toLowerCase();
      if (!seen.has(addressKey)) {
        seen.add(addressKey);
        validItems.push(result.item);
      }
      if (result.added) changed = true;
    }
  }

  state.discovered = validItems;
  state.restored = true;
  saveQpadDiscoveryState(state);

  return changed;
}

async function scanQpadRegistryBatch(factory, qwapFactory, state, total) {
  const start = Math.min(state.nextIndex, total);
  const end = Math.min(start + QPAD_DISCOVERY_BATCH_SIZE, total);
  let changed = false;

  if (start >= end) {
    state.scannedTotal = total;
    saveQpadDiscoveryState(state);
    return false;
  }

  for (
    let chunkStart = start;
    chunkStart < end;
    chunkStart += QPAD_DISCOVERY_CONCURRENCY
  ) {
    const chunkEnd = Math.min(
      chunkStart + QPAD_DISCOVERY_CONCURRENCY,
      end
    );

    const indices = Array.from(
      { length: chunkEnd - chunkStart },
      (_, offset) => chunkStart + offset
    );

    const records = await Promise.all(
      indices.map(index => factory.allTokens(index))
    );

    const outcomes = await Promise.all(records.map(async (record, offset) => {
      const index = indices[offset];

      try {
        const tokenAddress = ethers.getAddress(record.token || record[0]);
        const added = await inspectQpadGraduatedToken(
          factory,
          qwapFactory,
          tokenAddress
        );

        return { index, tokenAddress, added, retry: false };
      } catch (error) {
        console.debug("QPad token scan deferred:", index, error);
        return { index, retry: true };
      }
    }));

    for (const outcome of outcomes) {
      if (outcome.retry) continue;

      if (outcome.added) {
        const addressKey = outcome.tokenAddress.toLowerCase();
        const alreadySaved = state.discovered.some(
          item => item.address.toLowerCase() === addressKey
        );

        if (!alreadySaved) {
          state.discovered.push({
            index: outcome.index,
            address: outcome.tokenAddress
          });
        }

        changed = true;
      }
    }

    const retries = outcomes
      .filter(outcome => outcome.retry)
      .map(outcome => outcome.index);

    if (retries.length > 0) {
      state.nextIndex = Math.min(...retries);
      state.scannedTotal = total;
      saveQpadDiscoveryState(state);
      return changed;
    }

    state.nextIndex = chunkEnd;
    state.scannedTotal = total;
    saveQpadDiscoveryState(state);
  }

  return changed;
}

async function autoDiscoverQpadGraduatedTokens() {
  if (qpadDiscoveryPromise) return qpadDiscoveryPromise;

  qpadDiscoveryPromise = (async () => {
    const factory = new ethers.Contract(
      QPAD_FACTORY_ADDRESS,
      QPAD_DISCOVERY_ABI,
      rpc
    );

    const qwapFactory = new ethers.Contract(
      QWAP_FACTORY_ADDRESS,
      QWAP_DISCOVERY_FACTORY_ABI,
      rpc
    );

    const total = Number(await factory.totalTokens());

    if (!Number.isSafeInteger(total) || total < 0 || total > 5000) {
      throw new Error(`Unexpected QPad registry size: ${total}`);
    }

    const state = getQpadDiscoveryState(total);

    const restoredChanged = await restoreQpadDiscoveryCache(
      factory,
      qwapFactory,
      state
    );

    const scannedChanged = await scanQpadRegistryBatch(
      factory,
      qwapFactory,
      state,
      total
    );

    return restoredChanged || scannedChanged;
  })();

  try {
    return await qpadDiscoveryPromise;
  } finally {
    qpadDiscoveryPromise = null;
  }
}


async function inspectVenueRoute(factoryAddress, path, amountIn, amountOut) {
  const factory = new ethers.Contract(
    factoryAddress,
    ["function getPair(address,address) view returns(address)"],
    rpc
  );

  const pairAbi = [
    "function token0() view returns(address)",
    "function token1() view returns(address)",
    "function getReserves() view returns(uint256,uint256)"
  ];

  let spotAmountOut = BigInt(amountIn);
  const pairAddresses = [];

  for (let i = 0; i < path.length - 1; i++) {
    const tokenIn = path[i];
    const tokenOut = path[i + 1];

    const pairAddress = await factory.getPair(tokenIn, tokenOut);

    if (!pairAddress ||
        pairAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
      throw new Error("Route pair not found.");
    }

    const pair = new ethers.Contract(pairAddress, pairAbi, rpc);

    const [token0, token1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves()
    ]);

    const inAddress = tokenIn.toLowerCase();
    const outAddress = tokenOut.toLowerCase();

    let reserveIn;
    let reserveOut;

    if (
      inAddress === token0.toLowerCase() &&
      outAddress === token1.toLowerCase()
    ) {
      reserveIn = BigInt(reserves[0]);
      reserveOut = BigInt(reserves[1]);
    } else if (
      inAddress === token1.toLowerCase() &&
      outAddress === token0.toLowerCase()
    ) {
      reserveIn = BigInt(reserves[1]);
      reserveOut = BigInt(reserves[0]);
    } else {
      throw new Error("Pair token mismatch.");
    }

    if (reserveIn <= 0n || reserveOut <= 0n) {
      throw new Error("Pool reserves are empty.");
    }

    spotAmountOut = spotAmountOut * reserveOut / reserveIn;

    if (spotAmountOut <= 0n) {
      throw new Error("Invalid spot output.");
    }

    pairAddresses.push(pairAddress);
  }

  const actualOut = BigInt(amountOut);
  const shortfallBps = spotAmountOut > actualOut
    ? (spotAmountOut - actualOut) * 10000n / spotAmountOut
    : 0n;

  return {
    pairAddresses,
    executionShortfallBps: shortfallBps,
    depthVerified: true
  };
}

async function makeRouteCandidate(
  venue,
  routerAddress,
  factoryAddress,
  path,
  amountIn,
  amountOut
) {
  const metrics = await inspectVenueRoute(
    factoryAddress,
    path,
    amountIn,
    amountOut
  );

  return {
    venue,
    routerAddress,
    factoryAddress,
    path,
    amountOut: BigInt(amountOut),
    pairAddresses: metrics.pairAddresses,
    executionShortfallBps: metrics.executionShortfallBps,
    depthVerified: metrics.depthVerified
  };
}

let qmsGasPriceCache = null;
let qmsGasPriceFetchedAt = 0;

async function getQmsGasPriceWei() {
  if (
    qmsGasPriceCache !== null &&
    Date.now() - qmsGasPriceFetchedAt < 10000
  ) {
    return qmsGasPriceCache;
  }

  const feeData = await rpc.getFeeData();

  let gasPrice =
    feeData.gasPrice ??
    feeData.maxFeePerGas ??
    null;

  if (gasPrice === null || BigInt(gasPrice) <= 0n) {
    const rawGasPrice = await rpc.send("eth_gasPrice", []);
    gasPrice = BigInt(rawGasPrice);
  }

  gasPrice = BigInt(gasPrice);

  if (gasPrice <= 0n) {
    throw new Error("QMS network gas price is unavailable.");
  }

  qmsGasPriceCache = gasPrice;
  qmsGasPriceFetchedAt = Date.now();

  return gasPrice;
}

async function quoteGasCostInOutputToken(gasCostWei, outputKey, venue = "QWAP") {
  const inputRaw = BigInt(gasCostWei);

  if (inputRaw <= 0n) {
    throw new Error("Estimated QMS gas cost is zero or invalid.");
  }

  const precision = 10n ** 18n;
  const feeDenominator = 10000n;

  const isV6 = venue === "QMSwap";

  if (!isV6 && venue !== "QWAP") {
    throw new Error("Unsupported venue for gas conversion.");
  }

  const wrappedAddress = isV6
    ? CFG?.tokens?.QMS?.address
    : QWAP_WRAPPED_NATIVE_ADDRESS;

  const outputAddress = isV6
    ? (outputKey === "QMS" ? wrappedAddress : asset(outputKey)?.address)
    : qwapRouteAddress(outputKey);

  if (!wrappedAddress || !outputAddress || !ethers.isAddress(outputAddress)) {
    throw new Error("Output token cannot be used for gas conversion.");
  }

  if (wrappedAddress.toLowerCase() === outputAddress.toLowerCase()) {
    return inputRaw;
  }

  const factoryAddress = isV6 ? CFG.factory : QWAP_FACTORY_ADDRESS;
  const factory = new ethers.Contract(
    factoryAddress,
    ["function getPair(address,address) view returns(address)"],
    rpc
  );

  const feeBps = isV6 ? BigInt(CFG.feeBps ?? 30) : 30n;
  const feeNumerator = feeDenominator - feeBps;

  if (feeNumerator <= 0n || feeNumerator >= feeDenominator) {
    throw new Error("Invalid pool fee configuration.");
  }

  const paths = [[wrappedAddress, outputAddress]];

  if (!isV6) {
    const intermediates = [
      ...Object.values(QWAP_TOKEN_ASSETS).map(item => item.address),
      ...Object.values(customQwapAssets)
        .filter(item =>
          item?.source === "QPad" ||
          (item?.source === "Imported" &&
            Array.isArray(item.pools) &&
            item.pools.some(pool => pool?.venue === "QWAP"))
        )
        .map(item => item.address)
    ];

    const seen = new Set([
      `${wrappedAddress.toLowerCase()}>${outputAddress.toLowerCase()}`
    ]);

    for (const intermediate of intermediates) {
      if (!ethers.isAddress(intermediate)) continue;

      const middle = intermediate.toLowerCase();

      if (
        middle === wrappedAddress.toLowerCase() ||
        middle === outputAddress.toLowerCase()
      ) continue;

      const pathKey =
        `${wrappedAddress.toLowerCase()}>${middle}>${outputAddress.toLowerCase()}`;

      if (seen.has(pathKey)) continue;
      seen.add(pathKey);

      paths.push([wrappedAddress, intermediate, outputAddress]);
    }
  }

  async function calculatePath(path) {
    let amountScaled = inputRaw * precision;

    for (let i = 0; i < path.length - 1; i++) {
      const tokenIn = path[i];
      const tokenOut = path[i + 1];

      const pairAddress = await factory.getPair(tokenIn, tokenOut);

      if (!pairAddress || pairAddress.toLowerCase() === ZERO.toLowerCase()) {
        throw new Error("Gas conversion pool not found.");
      }

      const pairAbi = isV6
        ? [
            "function token0() view returns(address)",
            "function token1() view returns(address)",
            "function getReserves() view returns(uint256,uint256)"
          ]
        : [
            "function token0() view returns(address)",
            "function token1() view returns(address)",
            "function getReserves() view returns(uint112,uint112,uint32)"
          ];

      const pair = new ethers.Contract(pairAddress, pairAbi, rpc);

      const [token0, token1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves()
      ]);

      let reserveIn;
      let reserveOut;

      if (
        tokenIn.toLowerCase() === token0.toLowerCase() &&
        tokenOut.toLowerCase() === token1.toLowerCase()
      ) {
        reserveIn = BigInt(reserves[0]);
        reserveOut = BigInt(reserves[1]);
      } else if (
        tokenIn.toLowerCase() === token1.toLowerCase() &&
        tokenOut.toLowerCase() === token0.toLowerCase()
      ) {
        reserveIn = BigInt(reserves[1]);
        reserveOut = BigInt(reserves[0]);
      } else {
        throw new Error("Gas conversion pool token mismatch.");
      }

      if (reserveIn <= 0n || reserveOut <= 0n) {
        throw new Error("Gas conversion pool has empty reserves.");
      }

      // Keep 18 extra decimal places so a tiny gas amount does not round to zero.
      const numerator =
        amountScaled * feeNumerator * reserveOut * precision;

      const denominator =
        reserveIn * feeDenominator * precision +
        amountScaled * feeNumerator;

      amountScaled = numerator / denominator;

      if (amountScaled <= 0n) {
        throw new Error("Gas conversion precision was insufficient.");
      }
    }

    // Round the fee up by one smallest output-token unit when necessary.
    return (amountScaled + precision - 1n) / precision;
  }

  const results = await Promise.allSettled(
    paths.map(path => calculatePath(path))
  );

  let bestOutput = 0n;

  for (const result of results) {
    if (result.status !== "fulfilled") continue;

    if (result.value > bestOutput) {
      bestOutput = result.value;
    }
  }

  if (bestOutput <= 0n) {
    throw new Error(
      `Unable to convert QMS gas into ${outputKey}: no usable ${venue} pool route was found.`
    );
  }

  return bestOutput;
}

async function estimateRouteEconomics(
  candidate,
  fromKey,
  toKey,
  amountIn
) {
  candidate.gasStatus = "wallet-not-connected";
  candidate.gasUnits = null;
  candidate.gasPriceWei = null;
  candidate.gasCostWei = null;
  candidate.gasCostOutputRaw = null;
  candidate.netOutput = null;

  if (!account || !signer) {
    return candidate;
  }

  try {
    const network = await signer.provider.getNetwork();

    if (network.chainId !== BigInt(CHAIN_ID)) {
      candidate.gasStatus = "wrong-wallet-network";
      return candidate;
    }

    // Approval is a separate transaction.
    // Do not estimate a swap that would fail due to insufficient allowance.
    if ((candidate.venue === "QWAP" || candidate.venue === "QMSwap") && fromKey !== "QMS") {
      const inputToken = new ethers.Contract(
        asset(fromKey).address,
        tokenAbi,
        rpc
      );

      const spender = candidate.venue === "QWAP"
        ? QWAP_ROUTER_ADDRESS
        : CFG.router;

      const allowance = BigInt(
        await inputToken.allowance(account, spender)
      );

      if (allowance < BigInt(amountIn)) {
        candidate.gasStatus = "approval-required";
        return candidate;
      }
    }

    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + 1200
    );

    let gasUnits;

    if (candidate.venue === "QWAP-WRAP") {
      const wrapped = new ethers.Contract(
        QWAP_WRAPPED_NATIVE_ADDRESS,
        [
          "function deposit() payable",
          "function withdraw(uint256 amount)"
        ],
        signer
      );

      if (fromKey === "QMS" && toKey === "QWAP_WQMS") {
        gasUnits = await wrapped.deposit.estimateGas({
          value: amountIn
        });
      } else if (
        fromKey === "QWAP_WQMS" &&
        toKey === "QMS"
      ) {
        gasUnits = await wrapped.withdraw.estimateGas(amountIn);
      } else {
        throw new Error("Invalid QMS/WQMS wrapping route.");
      }
    } else if (candidate.venue === "QWAP") {
      const qwapRouter = new ethers.Contract(
        QWAP_ROUTER_ADDRESS,
        qwapRouterAbi,
        signer
      );

      if (fromKey === "QMS") {
        gasUnits = await qwapRouter.swapExactETHForTokens.estimateGas(
          0n,
          candidate.path,
          account,
          deadline,
          { value: amountIn }
        );
      } else if (toKey === "QMS") {
        gasUnits = await qwapRouter.swapExactTokensForETH.estimateGas(
          amountIn,
          0n,
          candidate.path,
          account,
          deadline
        );
      } else {
        gasUnits = await qwapRouter.swapExactTokensForTokens.estimateGas(
          amountIn,
          0n,
          candidate.path,
          account,
          deadline
        );
      }
    } else if (candidate.venue === "QMSwap") {
      const v6Router = new ethers.Contract(CFG.router, routerAbi, signer);

      const tokenInAddress = fromKey === "QMS"
        ? CFG.tokens.QMS.address
        : asset(fromKey).address;

      const tokenOutAddress = toKey === "QMS"
        ? CFG.tokens.QMS.address
        : asset(toKey).address;

      if (fromKey === "QMS") {
        gasUnits = await v6Router.swapExactQMSForTokens.estimateGas(
          tokenOutAddress,
          0n,
          deadline,
          account,
          { value: amountIn }
        );
      } else if (toKey === "QMS") {
        gasUnits = await v6Router.swapExactTokensForQMS.estimateGas(
          tokenInAddress,
          amountIn,
          0n,
          deadline,
          account
        );
      } else {
        gasUnits = await v6Router.swapExactTokensForTokens.estimateGas(
          tokenInAddress,
          tokenOutAddress,
          amountIn,
          0n,
          deadline,
          account
        );
      }
    } else {
      throw new Error("Unsupported venue for gas estimation.");
    }

    gasUnits = BigInt(gasUnits);

    if (gasUnits <= 0n) {
      throw new Error("Gas estimate returned zero.");
    }

    const gasPriceWei = await getQmsGasPriceWei();
    const gasCostWei = gasUnits * gasPriceWei;

    candidate.gasUnits = gasUnits;
    candidate.gasPriceWei = gasPriceWei;
    candidate.gasCostWei = gasCostWei;

    let gasCostOutputRaw;

    try {
      gasCostOutputRaw = await quoteGasCostInOutputToken(
        gasCostWei,
        toKey,
        candidate.venue
      );
    } catch (error) {
      candidate.gasStatus = "gas-conversion-unavailable";
      candidate.gasError = errorText(error);
      return candidate;
    }

    candidate.gasCostOutputRaw = gasCostOutputRaw;

    const minimumOutput = minWithSlippage(candidate.amountOut);
    candidate.minimumOutput = minimumOutput;

    if (gasCostOutputRaw >= minimumOutput) {
      candidate.netOutput = 0n;
      candidate.gasStatus = "gas-exceeds-output";
      return candidate;
    }

    candidate.netOutput = minimumOutput - gasCostOutputRaw;

    candidate.gasStatus = "estimated";
    return candidate;
  } catch (error) {
    candidate.gasStatus = "estimate-failed";
    candidate.gasError = errorText(error);
    return candidate;
  }
}
async function findBestSwapRoute(fromKey,toKey,amountIn) {
  if (
    (fromKey === "QMS" && toKey === "QWAP_WQMS") ||
    (fromKey === "QWAP_WQMS" && toKey === "QMS")
  ) {
    const wrapCandidate = {
      venue: "QWAP-WRAP",
      routerAddress: QWAP_WRAPPED_NATIVE_ADDRESS,
      path: null,
      amountOut: amountIn,
      pairAddresses: [],
      executionShortfallBps: null,
      depthVerified: true
    };

    await estimateRouteEconomics(
      wrapCandidate,
      fromKey,
      toKey,
      amountIn
    );

    return wrapCandidate;
  }

  const candidates = [];
  const compatibleWithQwap =
    (fromKey === "QMS" || isQwapAssetKey(fromKey)) &&
    (toKey === "QMS" || isQwapAssetKey(toKey));

  if (compatibleWithQwap) {
    const fromAddress = qwapRouteAddress(fromKey);
    const toAddress = qwapRouteAddress(toKey);

    if (
      fromAddress &&
      toAddress &&
      fromAddress.toLowerCase() !== toAddress.toLowerCase()
    ) {
      const paths = [[fromAddress, toAddress]];
      const intermediateAddresses = [
        QWAP_WRAPPED_NATIVE_ADDRESS,
        ...Object.values(QWAP_TOKEN_ASSETS).map(item => item.address)
      ];
      const seenPaths = new Set([
        `${fromAddress.toLowerCase()}>${toAddress.toLowerCase()}`
      ]);

      for (const intermediate of intermediateAddresses) {
        const intermediateLower = intermediate.toLowerCase();
        if (
          intermediateLower === fromAddress.toLowerCase() ||
          intermediateLower === toAddress.toLowerCase()
        ) continue;

        const pathKey = `${fromAddress.toLowerCase()}>${intermediateLower}>${toAddress.toLowerCase()}`;
        if (seenPaths.has(pathKey)) continue;
        seenPaths.add(pathKey);
        paths.push([fromAddress, intermediate, toAddress]);
      }

      for (const path of paths) {
        try {
          const amounts = await qwapRouterRead.getAmountsOut(amountIn, path);
          const amountOut = BigInt(amounts[amounts.length - 1]);

          if (amountOut > 0n) {
            const candidate = await makeRouteCandidate(
              "QWAP",
              QWAP_ROUTER_ADDRESS,
              QWAP_FACTORY_ADDRESS,
              path,
              amountIn,
              amountOut
            );

            await estimateRouteEconomics(
              candidate,
              fromKey,
              toKey,
              amountIn
            );

            candidates.push(candidate);
          }
        } catch (error) {
          console.debug("QWAP route unavailable:", error);
        }
      }
    }
  }

  const compatibleWithQmswap =
    (fromKey === "QMS" || isQmswapAssetKey(fromKey)) &&
    (toKey === "QMS" || isQmswapAssetKey(toKey));

  if (compatibleWithQmswap) {
    const fromAddress = fromKey === "QMS"
      ? CFG?.tokens?.QMS?.address
      : asset(fromKey)?.address;

    const toAddress = toKey === "QMS"
      ? CFG?.tokens?.QMS?.address
      : asset(toKey)?.address;

    if (
      fromAddress &&
      toAddress &&
      fromAddress.toLowerCase() !== toAddress.toLowerCase()
    ) {
      try {
        const amountOut = BigInt(
          await routerRead.quoteOut(fromAddress, toAddress, amountIn)
        );

        if (amountOut > 0n) {
          const candidate = await makeRouteCandidate(
            "QMSwap",
            CFG.router,
            CFG.factory,
            [fromAddress, toAddress],
            amountIn,
            amountOut
          );

          await estimateRouteEconomics(
            candidate,
            fromKey,
            toKey,
            amountIn
          );

          candidates.push(candidate);
        }
      } catch (error) {
        console.debug("QMSwap V6 route unavailable:", error);
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error("No verified QWAP or QMSwap route with available liquidity was found.");
  }

  const maxExecutionShortfallBps = 500n;

  const eligibleCandidates = candidates.filter(candidate =>
    candidate.depthVerified === true &&
    candidate.executionShortfallBps !== null &&
    candidate.executionShortfallBps !== undefined &&
    BigInt(candidate.executionShortfallBps) <= maxExecutionShortfallBps
  );

  if (eligibleCandidates.length === 0) {
    const bestAvailable = candidates.reduce(
      (best, candidate) =>
        !best || candidate.amountOut > best.amountOut ? candidate : best,
      null
    );

    if (
      !bestAvailable ||
      bestAvailable.executionShortfallBps === null ||
      bestAvailable.executionShortfallBps === undefined
    ) {
      throw new Error("No route passed liquidity and execution checks.");
    }

    const shortfallPercentage = (
      Number(BigInt(bestAvailable.executionShortfallBps)) / 100
    ).toFixed(2);

    throw new Error(
      "Best available route exceeds the 5.00% execution-impact limit (" +
      shortfallPercentage +
      "%). Try a smaller input amount."
    );
  }

  const gasEstimatedCandidates = eligibleCandidates.filter(
    candidate => candidate.gasStatus === "estimated"
  );

  let rankedCandidates = eligibleCandidates;

  if (gasEstimatedCandidates.length > 0) {
    rankedCandidates = gasEstimatedCandidates.filter(
      candidate => candidate.netOutput > 0n
    );

    if (rankedCandidates.length === 0) {
      throw new Error(
        "Estimated network gas cost is greater than or equal to the output amount."
      );
    }

    rankedCandidates.sort((a, b) => {
      if (a.netOutput === b.netOutput) return 0;
      return a.netOutput > b.netOutput ? -1 : 1;
    });
  } else {
    // No wallet, approval required, or unavailable gas data.
    // Use gross output only and explicitly report that net ranking is unavailable.
    rankedCandidates.sort((a, b) => {
      if (a.amountOut === b.amountOut) return 0;
      return a.amountOut > b.amountOut ? -1 : 1;
    });
  }

  return rankedCandidates[0];
}
let swapQuoteRequestId = 0;
let activeSwapQuoteSnapshot = null;
let swapExecutionControlState = null;
const SWAP_QUOTE_MAX_AGE_MS = 30000;

function setSwapExecutionControlsLocked(locked) {
  const controlIds = [
    "connectBtn",
    "fromSelect",
    "toSelect",
    "amountIn",
    "slippage",
    "flipBtn",
    "refreshBtn"
  ];

  if (locked) {
    if (swapExecutionControlState) return;

    swapExecutionControlState = new Map();

    for (const id of controlIds) {
      const element = $(id);
      if (!element) continue;

      swapExecutionControlState.set(id, element.disabled);
      element.disabled = true;
    }

    return;
  }

  if (!swapExecutionControlState) return;

  for (const [id, wasDisabled] of swapExecutionControlState.entries()) {
    const element = $(id);
    if (element) element.disabled = wasDisabled;
  }

  swapExecutionControlState = null;
}

function assertSwapQuoteSnapshot(
  snapshot,
  expectedFromKey,
  expectedToKey,
  expectedAmountIn
) {
  if (!snapshot) {
    throw new Error("No valid swap quote is available. Refresh the quote and try again.");
  }

  if (snapshot.requestId !== swapQuoteRequestId) {
    throw new Error("Swap quote changed. Please review the latest quote.");
  }

  if (Date.now() - snapshot.createdAt > SWAP_QUOTE_MAX_AGE_MS) {
    throw new Error("Swap quote expired. Refresh the quote before submitting.");
  }

  if (
    snapshot.fromKey !== expectedFromKey ||
    snapshot.toKey !== expectedToKey ||
    snapshot.amountIn !== BigInt(expectedAmountIn)
  ) {
    throw new Error("Swap details changed after quoting. Please review the quote again.");
  }

  if (snapshot.slippageBps !== getSlippage()) {
    throw new Error("Slippage changed after quoting. Refresh the quote.");
  }

  if (snapshot.wallet !== String(account || "").toLowerCase()) {
    throw new Error("Connected wallet changed. Please refresh the quote.");
  }

  if (snapshot.chainId !== CHAIN_ID) {
    throw new Error("Invalid quote network. Please use QMS Testnet.");
  }

  const route = snapshot.route;

  if (!route || BigInt(route.amountOut) !== snapshot.amountOut) {
    throw new Error("Invalid route snapshot.");
  }

  if (snapshot.amountOut <= 0n || snapshot.minOut <= 0n) {
    throw new Error("Invalid output amount. Refresh the quote.");
  }

  if (snapshot.minOut !== minWithSlippage(snapshot.amountOut)) {
    throw new Error("Minimum received changed after quoting.");
  }

  if (route.venue === "QWAP") {
    if (
      !route.routerAddress ||
      route.routerAddress.toLowerCase() !== QWAP_ROUTER_ADDRESS.toLowerCase()
    ) {
      throw new Error("Quote router does not match the QWAP execution router.");
    }

    if (
      route.depthVerified !== true ||
      route.executionShortfallBps === null ||
      route.executionShortfallBps === undefined ||
      BigInt(route.executionShortfallBps) > 500n
    ) {
      throw new Error("Route did not pass the liquidity safety check.");
    }

    const expectedStart = qwapRouteAddress(expectedFromKey);
    const expectedEnd = qwapRouteAddress(expectedToKey);

    if (
      !Array.isArray(route.path) ||
      route.path.length < 2 ||
      !expectedStart ||
      !expectedEnd ||
      route.path[0].toLowerCase() !== expectedStart.toLowerCase() ||
      route.path[route.path.length - 1].toLowerCase() !== expectedEnd.toLowerCase()
    ) {
      throw new Error("Route path does not match the selected trading pair.");
    }
  } else if (route.venue === "QMSwap") {
    if (
      !route.routerAddress ||
      route.routerAddress.toLowerCase() !== CFG.router.toLowerCase() ||
      !route.factoryAddress ||
      route.factoryAddress.toLowerCase() !== CFG.factory.toLowerCase()
    ) {
      throw new Error("Quote router or factory does not match QMSwap V6.");
    }

    if (
      route.depthVerified !== true ||
      route.executionShortfallBps === null ||
      route.executionShortfallBps === undefined ||
      BigInt(route.executionShortfallBps) > 500n
    ) {
      throw new Error("QMSwap V6 route did not pass the liquidity safety check.");
    }

    const expectedStart = expectedFromKey === "QMS"
      ? CFG.tokens.QMS.address
      : (isQmswapAssetKey(expectedFromKey) ? asset(expectedFromKey)?.address : null);

    const expectedEnd = expectedToKey === "QMS"
      ? CFG.tokens.QMS.address
      : (isQmswapAssetKey(expectedToKey) ? asset(expectedToKey)?.address : null);

    if (
      !Array.isArray(route.path) ||
      route.path.length !== 2 ||
      !expectedStart ||
      !expectedEnd ||
      route.path[0].toLowerCase() !== expectedStart.toLowerCase() ||
      route.path[1].toLowerCase() !== expectedEnd.toLowerCase() ||
      !Array.isArray(route.pairAddresses) ||
      route.pairAddresses.length !== 1
    ) {
      throw new Error("QMSwap V6 direct route does not match the selected token contracts.");
    }  } else if (route.venue === "QWAP-WRAP") {
    if (
      !route.routerAddress ||
      route.routerAddress.toLowerCase() !== QWAP_WRAPPED_NATIVE_ADDRESS.toLowerCase()
    ) {
      throw new Error("Invalid QMS/WQMS wrapping contract.");
    }

    const validWrap =
      (expectedFromKey === "QMS" && expectedToKey === "QWAP_WQMS") ||
      (expectedFromKey === "QWAP_WQMS" && expectedToKey === "QMS");

    if (!validWrap || route.amountOut !== snapshot.amountIn) {
      throw new Error("Invalid QMS/WQMS wrapping quote.");
    }
  } else {
    throw new Error("Unsupported execution venue.");
  }
}

async function updateSwapQuote() {
  const requestId = ++swapQuoteRequestId;

  quoteOutRaw = 0n;
  activeSwapQuoteSnapshot = null;

  if (!$("amountIn")) return null;

  const fromKey = $("fromSelect").value;
  const toKey = $("toSelect").value;
  const input = $("amountIn").value.trim();

  $("amountOut").value = "";
  $("minReceived").textContent = "--";
  $("estimatedNetworkFee").textContent = account
    ? "Estimating..."
    : "Connect wallet";
  $("netOutput").textContent = "--";

  if (fromKey === toKey) {
    $("estimatedNetworkFee").textContent = "Unavailable";
    $("status").textContent = "Choose two different tokens.";
    return null;
  }

  if (!input) {
    $("estimatedNetworkFee").textContent = account
      ? "--"
      : "Connect wallet";
    $("status").textContent = "Enter an amount to get a quote.";
    return null;
  }

  try {
    const amountIn = parseAmount(input, fromKey);

    if (amountIn <= 0n) {
      $("status").textContent = "Enter an amount greater than zero.";
      return null;
    }

    const route = await findBestSwapRoute(fromKey, toKey, amountIn);

    if (requestId !== swapQuoteRequestId) return null;

    const amountOut = BigInt(route.amountOut);

    if (amountOut <= 0n) {
      throw new Error("The route returned an invalid output amount.");
    }

    quoteOutRaw = amountOut;

    $("amountOut").value = fmt(
      amountOut,
      tokenDecimals(toKey),
      10
    );

    const minOut = minWithSlippage(amountOut);

    $("minReceived").textContent =
      fmt(minOut, tokenDecimals(toKey), 10) +
      " " + (asset(toKey).symbol || toKey);

    const routeSnapshot = {
      ...route,
      path: Array.isArray(route.path) ? [...route.path] : null,
      pairAddresses: Array.isArray(route.pairAddresses)
        ? [...route.pairAddresses]
        : []
    };

    if (routeSnapshot.path) {
      Object.freeze(routeSnapshot.path);
    }

    Object.freeze(routeSnapshot.pairAddresses);
    Object.freeze(routeSnapshot);

    activeSwapQuoteSnapshot = Object.freeze({
      requestId,
      createdAt: Date.now(),
      wallet: String(account || "").toLowerCase(),
      chainId: CHAIN_ID,
      fromKey,
      toKey,
      amountIn,
      amountOut,
      minOut,
      slippageBps: getSlippage(),
      route: routeSnapshot
    });

    if (route.gasStatus === "estimated") {
      $("estimatedNetworkFee").textContent =
        fmt(route.gasCostWei, 18, 18) + " QMS";

      $("netOutput").textContent =
        fmt(route.netOutput, tokenDecimals(toKey), 10) +
        " " + (asset(toKey).symbol || toKey);

      $("status").textContent =
        "Quote ready. Route selected by estimated net output. Approval fees are separate.";
    } else if (route.gasStatus === "approval-required") {
      $("estimatedNetworkFee").textContent = "Approval required";
      $("netOutput").textContent = "Available after approval";
      $("status").textContent =
        "Quote ready. Approve the input token to estimate swap gas.";
    } else if (route.gasStatus === "wallet-not-connected") {
      $("estimatedNetworkFee").textContent = "Connect wallet";
      $("netOutput").textContent = "Connect wallet";
      $("status").textContent =
        "Quote ready. Connect your wallet to estimate network gas.";
    } else if (route.gasStatus === "gas-conversion-unavailable") {
      $("estimatedNetworkFee").textContent =
        fmt(route.gasCostWei, 18, 18) + " QMS";
      $("netOutput").textContent = "Unavailable";
      $("status").textContent =
        "Swap gas is estimated in QMS, but conversion to the output token is unavailable.";
    } else if (route.gasStatus === "wrong-wallet-network") {
      $("estimatedNetworkFee").textContent = "Wrong network";
      $("netOutput").textContent = "Unavailable";
      $("status").textContent = "Switch your wallet to QMS Testnet.";
    } else if (route.gasStatus === "gas-exceeds-output") {
      $("estimatedNetworkFee").textContent =
        fmt(route.gasCostWei, 18, 18) + " QMS";
      $("netOutput").textContent = "Gas exceeds output";
      $("status").textContent =
        "The estimated network fee exceeds the output amount.";
    } else {
      $("estimatedNetworkFee").textContent = "Unavailable";
      $("netOutput").textContent = "Not estimated";
      $("status").textContent =
        "Gas estimation failed. Swap execution will remain disabled until gas can be verified.";
    }

    return activeSwapQuoteSnapshot;
  } catch (err) {
    if (requestId !== swapQuoteRequestId) return null;

    quoteOutRaw = 0n;
    activeSwapQuoteSnapshot = null;

    $("amountOut").value = "";
    $("minReceived").textContent = "--";
    $("estimatedNetworkFee").textContent = "Unavailable";
    $("netOutput").textContent = "Not estimated";
    $("status").textContent = errorText(err);

    return null;
  }
}
async function runSwap() {
  if (busy) return;

  if (pendingSwapMonitor) {
    busy = true;

    const pendingButton = $("swapBtn");
    if (pendingButton) pendingButton.disabled = true;

    try {
      await reconcilePendingSwap();
    } finally {
      busy = false;

      if (pendingButton) {
        pendingButton.disabled = false;
        pendingButton.textContent = pendingSwapMonitor
          ? "Check transaction"
          : "Swap";
      }
    }

    return;
  }

  busy = true;

  const swapButton = $("swapBtn");
  if (swapButton) swapButton.disabled = true;

  if ($("txLink")) $("txLink").hidden = true;

  setSwapExecutionControlsLocked(true);

  activeSwapQuoteSnapshot = null;
  ++swapQuoteRequestId;

  try {
    await ensureWallet();

    const fromKey = $("fromSelect").value;
    const toKey = $("toSelect").value;
    const inputText = $("amountIn").value.trim();

    if (!inputText) {
      throw new Error("Enter an amount before swapping.");
    }

    const amountIn = parseAmount(inputText, fromKey);

    if (fromKey === toKey || amountIn <= 0n) {
      throw new Error("Invalid amount or trading pair.");
    }

    setStatus("Checking the best available route...");

    // First route lookup identifies the venue and validates liquidity.
    let initialRoute = await findBestSwapRoute(
      fromKey,
      toKey,
      amountIn
    );

    if (
      initialRoute.venue !== "QWAP" &&
      initialRoute.venue !== "QMSwap" &&
      initialRoute.venue !== "QWAP-WRAP"
    ) {
      throw new Error("Unsupported swap venue. Legacy routing is disabled.");
    }

    // Approval is a separate transaction and is completed before the final quote.
    if (initialRoute.venue === "QWAP" && fromKey !== "QMS") {
      await ensureAllowance(
        asset(fromKey).address,
        amountIn,
        QWAP_ROUTER_ADDRESS
      );
    } else if (initialRoute.venue === "QMSwap" && fromKey !== "QMS") {
      await ensureAllowance(
        asset(fromKey).address,
        amountIn,
        CFG.router
      );
    }

    await ensureWallet();

    const injectedProvider = getInjectedWalletProvider();

    if (!injectedProvider) {
      throw new Error("Wallet provider is no longer available.");
    }

    const activeAccounts = await injectedProvider.request({
      method: "eth_accounts"
    });

    if (!activeAccounts || !activeAccounts.length) {
      throw new Error("No wallet account is currently connected.");
    }

    const activeWalletAddress = ethers.getAddress(activeAccounts[0]);

    if (activeWalletAddress.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Wallet account changed. Reconnect and refresh the quote.");
    }

    // Rebuild the displayed quote after approval and capture its exact route.
    setStatus("Refreshing quote and estimating swap gas...");

    const snapshot = await updateSwapQuote();

    assertSwapQuoteSnapshot(
      snapshot,
      fromKey,
      toKey,
      amountIn
    );

    const bestRoute = snapshot.route;
    const amountOut = snapshot.amountOut;
    const minOut = snapshot.minOut;

    if (
      bestRoute.gasStatus !== "estimated" &&
      bestRoute.gasStatus !== "gas-conversion-unavailable"
    ) {
      throw new Error(
        "Swap gas could not be verified. Refresh the quote or check your wallet before submitting."
      );
    }

    const gasUnits = BigInt(bestRoute.gasUnits ?? 0n);
    const quotedGasPriceWei = BigInt(bestRoute.gasPriceWei ?? 0n);

    if (gasUnits <= 0n || quotedGasPriceWei <= 0n) {
      throw new Error("A valid swap gas estimate is required before execution.");
    }

    if (BigInt(bestRoute.gasCostWei ?? 0n) <= 0n) {
      throw new Error("Estimated network fee is invalid.");
    }

    setStatus("Checking token balance, allowance and QMS gas balance...");

    let inputToken = null;
    let inputBalance;

    if (fromKey === "QMS") {
      inputBalance = BigInt(await rpc.getBalance(account));
    } else {
      inputToken = new ethers.Contract(
        asset(fromKey).address,
        tokenAbi,
        rpc
      );

      inputBalance = BigInt(
        await inputToken.balanceOf(account)
      );
    }

    if (inputBalance < amountIn) {
      throw new Error(
        "Insufficient " + (asset(fromKey).symbol || fromKey) +
        " balance for this swap."
      );
    }

    if (
      (bestRoute.venue === "QWAP" || bestRoute.venue === "QMSwap") &&
      fromKey !== "QMS"
    ) {
      const spender = bestRoute.venue === "QWAP"
        ? QWAP_ROUTER_ADDRESS
        : CFG.router;

      const allowance = BigInt(
        await inputToken.allowance(account, spender)
      );

      if (allowance < amountIn) {
        throw new Error(
          bestRoute.venue + " Router allowance is insufficient. Approve the input token and retry."
        );
      }
    }

    // Reserve 20% above the quoted gas cost to reduce insufficient-gas failures.
    const latestGasPriceWei = BigInt(await getQmsGasPriceWei());

    const conservativeGasPriceWei =
      latestGasPriceWei > quotedGasPriceWei
        ? latestGasPriceWei
        : quotedGasPriceWei;

    const gasReserveWei =
      (gasUnits * conservativeGasPriceWei * 120n + 99n) / 100n;

    const nativeBalance = BigInt(await rpc.getBalance(account));

    const requiredQmsBalance =
      gasReserveWei + (fromKey === "QMS" ? amountIn : 0n);

    if (nativeBalance < requiredQmsBalance) {
      throw new Error(
        "Insufficient QMS for the input amount and estimated network gas. " +
        "Required approximately " +
        fmt(requiredQmsBalance, 18, 8) +
        " QMS, including a 20% gas buffer."
      );
    }

    // Ensure that the quote still describes the exact controls and wallet.
    const currentFromKey = $("fromSelect").value;
    const currentToKey = $("toSelect").value;
    const currentInput = parseAmount(
      $("amountIn").value.trim(),
      currentFromKey
    );

    assertSwapQuoteSnapshot(
      snapshot,
      currentFromKey,
      currentToKey,
      currentInput
    );

    await ensureWallet();

    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + 1200
    );

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
        await wrapped.deposit.staticCall({
          value: amountIn
        });

        setStatus("Preflight passed. Confirm wrapping QMS into WQMS in your wallet...");

        tx = await wrapped.deposit({
          value: amountIn
        });
      } else if (
        fromKey === "QWAP_WQMS" &&
        toKey === "QMS"
      ) {
        await wrapped.withdraw.staticCall(amountIn);

        setStatus("Preflight passed. Confirm unwrapping WQMS into QMS in your wallet...");

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

      const routePath = [...bestRoute.path];

      if (fromKey === "QMS") {
        await qwapRouter.swapExactETHForTokens.staticCall(
          minOut,
          routePath,
          account,
          deadline,
          { value: amountIn }
        );

        setStatus("Preflight passed. Confirm the QWAP swap in your wallet...");

        tx = await qwapRouter.swapExactETHForTokens(
          minOut,
          routePath,
          account,
          deadline,
          { value: amountIn }
        );
      } else if (toKey === "QMS") {
        await qwapRouter.swapExactTokensForETH.staticCall(
          amountIn,
          minOut,
          routePath,
          account,
          deadline
        );

        setStatus("Preflight passed. Confirm the QWAP swap in your wallet...");

        tx = await qwapRouter.swapExactTokensForETH(
          amountIn,
          minOut,
          routePath,
          account,
          deadline
        );
      } else {
        await qwapRouter.swapExactTokensForTokens.staticCall(
          amountIn,
          minOut,
          routePath,
          account,
          deadline
        );

        setStatus("Preflight passed. Confirm the QWAP swap in your wallet...");

        tx = await qwapRouter.swapExactTokensForTokens(
          amountIn,
          minOut,
          routePath,
          account,
          deadline
        );
      }
    } else if (bestRoute.venue === "QMSwap") {
      const v6Router = new ethers.Contract(CFG.router, routerAbi, signer);

      const tokenInAddress = asset(fromKey).address;
      const tokenOutAddress = asset(toKey).address;

      if (fromKey === "QMS") {
        await v6Router.swapExactQMSForTokens.staticCall(
          tokenOutAddress,
          minOut,
          deadline,
          account,
          { value: amountIn }
        );

        setStatus("Preflight passed. Confirm the QMSwap V6 swap in your wallet...");

        tx = await v6Router.swapExactQMSForTokens(
          tokenOutAddress,
          minOut,
          deadline,
          account,
          { value: amountIn }
        );
      } else if (toKey === "QMS") {
        await v6Router.swapExactTokensForQMS.staticCall(
          tokenInAddress,
          amountIn,
          minOut,
          deadline,
          account
        );

        setStatus("Preflight passed. Confirm the QMSwap V6 swap in your wallet...");

        tx = await v6Router.swapExactTokensForQMS(
          tokenInAddress,
          amountIn,
          minOut,
          deadline,
          account
        );
      } else {
        await v6Router.swapExactTokensForTokens.staticCall(
          tokenInAddress,
          tokenOutAddress,
          amountIn,
          minOut,
          deadline,
          account
        );

        setStatus("Preflight passed. Confirm the QMSwap V6 swap in your wallet...");

        tx = await v6Router.swapExactTokensForTokens(
          tokenInAddress,
          tokenOutAddress,
          amountIn,
          minOut,
          deadline,
          account
        );
      }
    } else {
      throw new Error("Unsupported swap venue.");
    }

    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return a valid transaction.");
    }

    setStatus(
      "Transaction submitted: " +
      tx.hash +
      ". Waiting for confirmation..."
    );

    pendingSwapMonitor = {
      hash: tx.hash,
      submittedAt: Date.now(),
      fromKey,
      toKey,
      amountIn,
      expectedAmountOut: amountOut,
      minimumReceived: minOut,
      estimatedGasWei: BigInt(bestRoute.gasCostWei),
      outputAddress: asset(toKey).address,
      recipient: account,
      outputDecimals: tokenDecimals(toKey),
      outputSymbol: asset(toKey).symbol || toKey,
      venue: bestRoute.venue
    };

    savePendingSwapMonitor(pendingSwapMonitor);

    // Display the explorer link as soon as the wallet returns a transaction hash.
    showTx(tx.hash);
    setSwapReceiptPending(pendingSwapMonitor);

    const receipt = await waitForSwapReceipt(
      tx,
      pendingSwapMonitor
    );

    if (!receipt) {
      setStatus(
        "Transaction submitted but still pending. The hash is preserved. Press Check transaction to query the receipt; no duplicate swap will be sent."
      );
      return;
    }

    await processSwapReceipt(receipt, pendingSwapMonitor);

    if (!receipt || Number(receipt.status) !== 1) {
      throw new Error("Swap transaction failed on-chain.");
    }

    showTx(tx.hash);

    setStatus(
      "Swap successful at block " + receipt.blockNumber + ".",
      "success"
    );

    $("amountIn").value = "";
    $("amountOut").value = "";

    activeSwapQuoteSnapshot = null;

    try {
      await refreshBalances();
      await updateSwapQuote();
    } catch (refreshError) {
      console.warn("Post-swap refresh failed:", refreshError);
      setStatus(
        "Swap confirmed, but the balance refresh failed. Use Refresh to update balances.",
        "success"
      );
    }
  } catch (err) {
    activeSwapQuoteSnapshot = null;
    setStatus("Swap failed: " + errorText(err), "error");
  } finally {
    busy = false;

    setSwapExecutionControlsLocked(false);

    if (swapButton) {
      swapButton.disabled = false;
      swapButton.textContent = pendingSwapMonitor
        ? "Check transaction"
        : "Swap";
    }
  }
}
async function bindLiquidity() {
  $("connectBtn").addEventListener("click", async () => {
    try {
      await connectWallet(true);
      await updateRemoveLiquidityQuote();
    } catch (e) {
      setStatus(errorText(e), "error");
    }
  });

  $("tokenA").addEventListener("change", async () => {
    if ($("tokenA").value === $("tokenB").value) {
      $("tokenB").value = assetKeys().find(k => k !== $("tokenA").value);
    }
    $("amountA").value = "";
    $("amountB").value = "";
    updateBalanceLabels();
    await updateLiquidityQuote("");
  });

  $("tokenB").addEventListener("change", async () => {
    if ($("tokenB").value === $("tokenA").value) {
      $("tokenA").value = assetKeys().find(k => k !== $("tokenB").value);
    }
    $("amountA").value = "";
    $("amountB").value = "";
    updateBalanceLabels();
    await updateLiquidityQuote("");
  });

  $("amountA").addEventListener("input", () => {
    lastLiquidityInputSide = "A";
    updateLiquidityQuote("A");
  });
  $("amountB").addEventListener("input", () => {
    lastLiquidityInputSide = "B";
    updateLiquidityQuote("B");
  });

  $("slippage").addEventListener("change", async () => {
    await updateLiquidityQuote("");
    await updateRemoveLiquidityQuote();
  });

  $("refreshBtn").addEventListener("click", async () => {
    await refreshBalances();
    await updateLiquidityQuote("");
    await updateRemoveLiquidityQuote();
  });

  $("refreshRemoveBtn").addEventListener("click", updateRemoveLiquidityQuote);
  $("addBtn").addEventListener("click", runAddLiquidity);

  $("removePool").addEventListener("change", async () => {
    $("removeLpAmount").value = "";
    await updateRemoveLiquidityQuote();
  });
  $("removeLpAmount").addEventListener("input", updateRemoveLiquidityQuote);

  $("removeMaxBtn").addEventListener("click", async () => {
    if (!account) {
      setRemoveStatus("Connect your wallet to view your LP balance.", "error");
      return;
    }
    if (!removeLiquidityState) await updateRemoveLiquidityQuote();

    const balance = removeLiquidityState?.lpBalance || 0n;
    $("removeLpAmount").value = ethers.formatUnits(balance, 18)
      .replace(/\.?0+$/, "");
    await updateRemoveLiquidityQuote();
  });

  $("removeBtn").addEventListener("click", runRemoveLiquidity);

  updateBalanceLabels();
  await updateLiquidityQuote("");
  await updateRemoveLiquidityQuote();
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
let removeLiquidityState = null;

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
    $("reservesInfo").textContent = "--";
    $("sharesInfo").textContent = "--";
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

function setRemoveStatus(message, kind = "") {
  const el = $("removeStatus");
  if (!el) return;
  el.textContent = message;
  el.className = ("status " + kind).trim();
}

async function updateRemoveLiquidityQuote() {
  const enabled = CFG?.features?.removeLiquidity === true;
  const button = $("removeBtn");
  if (!button) return;

  $("removeFeatureNotice").hidden = enabled;
  button.disabled = true;

  const selection = $("removePool").value;
  if (!selection) {
    removeLiquidityState = null;
    $("removePoolAddress").textContent = "—";
    $("removeLpBalance").textContent = account ? "No pool selected" : "Connect wallet to view balance";
    $("removeEstimateA").textContent = "—";
    $("removeEstimateB").textContent = "—";
    $("removeMinA").textContent = "—";
    $("removeMinB").textContent = "—";
    setRemoveStatus("Choose a pool and enter an LP amount.");
    return;
  }

  try {
    const [keyA, keyB] = selection.split("/");
    const state = await readPairState(keyA, keyB);
    const [supply, lpBalance] = await Promise.all([
      state.pair.totalSupply(),
      account ? state.pair.balanceOf(account) : Promise.resolve(0n)
    ]);

    removeLiquidityState = {
      ...state,
      keyA,
      keyB,
      supply: BigInt(supply),
      lpBalance: BigInt(lpBalance)
    };

    $("removePoolAddress").textContent = shortAddress(state.address);
    $("removeLpBalance").textContent = account
      ? fmt(BigInt(lpBalance), 18, 8) + " LP available"
      : "Connect wallet to view balance";

    let liquidity = 0n;
    const raw = $("removeLpAmount").value.trim();

    if (raw) {
      try {
        liquidity = ethers.parseUnits(raw, 18);
      } catch {
        throw new Error("Enter a valid LP amount with up to 18 decimal places.");
      }
    }

    let amountA = 0n;
    let amountB = 0n;

    if (liquidity > 0n && BigInt(supply) > 0n) {
      amountA = liquidity * state.reserveA / BigInt(supply);
      amountB = liquidity * state.reserveB / BigInt(supply);
    }

    const minA = amountA * (10000n - getSlippage()) / 10000n;
    const minB = amountB * (10000n - getSlippage()) / 10000n;

    $("removeEstimateA").textContent =
      fmt(amountA, tokenDecimals(keyA), 8) + " " + keyA;
    $("removeEstimateB").textContent =
      fmt(amountB, tokenDecimals(keyB), 8) + " " + keyB;
    $("removeMinA").textContent =
      fmt(minA, tokenDecimals(keyA), 8) + " " + keyA;
    $("removeMinB").textContent =
      fmt(minB, tokenDecimals(keyB), 8) + " " + keyB;

    if (!enabled) {
      setRemoveStatus("Read-only preview. Transactions are disabled until compatible contracts are deployed.");
    } else if (!account) {
      setRemoveStatus("Connect your wallet to remove liquidity.");
    } else if (liquidity <= 0n) {
      setRemoveStatus("Enter the LP amount you want to remove.");
    } else if (liquidity > BigInt(lpBalance)) {
      setRemoveStatus("The entered amount exceeds your LP balance.", "error");
    } else if (amountA <= 0n || amountB <= 0n) {
      setRemoveStatus("The entered amount is too small to return both assets.", "error");
    } else {
      setRemoveStatus("Review the estimates and minimum received amounts.");
    }

    button.disabled = !enabled || !account || liquidity <= 0n ||
      liquidity > BigInt(lpBalance) || amountA <= 0n || amountB <= 0n;
  } catch (err) {
    removeLiquidityState = null;
    $("removeEstimateA").textContent = "—";
    $("removeEstimateB").textContent = "—";
    $("removeMinA").textContent = "—";
    $("removeMinB").textContent = "—";
    setRemoveStatus(errorText(err), "error");
  }
}

async function runRemoveLiquidity() {
  if (busy) return;

  if (CFG?.features?.removeLiquidity !== true) {
    setRemoveStatus("Remove Liquidity is disabled until the updated contracts are deployed.", "error");
    return;
  }

  busy = true;
  $("removeBtn").disabled = true;
  $("removeTxLink").hidden = true;

  try {
    await ensureWallet();

    const [keyA, keyB] = $("removePool").value.split("/");
    if (!keyA || !keyB) throw new Error("Choose a pool first.");

    const liquidity = ethers.parseUnits($("removeLpAmount").value.trim(), 18);
    if (liquidity <= 0n) throw new Error("Enter an LP amount greater than zero.");

    const state = await readPairState(keyA, keyB);
    const [lpBalance, supply] = await Promise.all([
      state.pair.balanceOf(account),
      state.pair.totalSupply()
    ]);

    if (liquidity > BigInt(lpBalance)) {
      throw new Error("The LP amount exceeds your wallet balance.");
    }
    if (BigInt(supply) <= 0n) throw new Error("The pool has no LP supply.");

    const estimateA = liquidity * state.reserveA / BigInt(supply);
    const estimateB = liquidity * state.reserveB / BigInt(supply);
    if (estimateA <= 0n || estimateB <= 0n) {
      throw new Error("The LP amount is too small to return both assets.");
    }

    const tolerance = getSlippage();
    const minA = estimateA * (10000n - tolerance) / 10000n;
    const minB = estimateB * (10000n - tolerance) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    const pair = new ethers.Contract(state.address, pairAbi, signer);
    const allowance = BigInt(await pair.allowance(account, CFG.router));

    if (allowance < liquidity) {
      setRemoveStatus("Confirm LP token approval in your wallet...");
      const approveTx = await pair.approve(CFG.router, liquidity);
      await approveTx.wait();
    }

    const router = new ethers.Contract(CFG.router, routerAbi, signer);
    let tx;

    if (keyA === "QMS" || keyB === "QMS") {
      const tokenKey = keyA === "QMS" ? keyB : keyA;
      const amountTokenMin = keyA === "QMS" ? minB : minA;
      const amountQMSMin = keyA === "QMS" ? minA : minB;

      await router.removeLiquidityNative.staticCall(
        asset(tokenKey).address,
        liquidity,
        amountTokenMin,
        amountQMSMin,
        deadline,
        account
      );

      setRemoveStatus("Confirm Remove Liquidity in your wallet...");
      tx = await router.removeLiquidityNative(
        asset(tokenKey).address,
        liquidity,
        amountTokenMin,
        amountQMSMin,
        deadline,
        account
      );
    } else {
      await router.removeLiquidity.staticCall(
        asset(keyA).address,
        asset(keyB).address,
        liquidity,
        minA,
        minB,
        deadline,
        account
      );

      setRemoveStatus("Confirm Remove Liquidity in your wallet...");
      tx = await router.removeLiquidity(
        asset(keyA).address,
        asset(keyB).address,
        liquidity,
        minA,
        minB,
        deadline,
        account
      );
    }

    setRemoveStatus("Transaction submitted: " + tx.hash + ". Waiting for confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Remove Liquidity failed.");

    const link = $("removeTxLink");
    link.href = `${EXPLORER}/tx/${tx.hash}`;
    link.textContent = "View transaction on QMSScan";
    link.hidden = false;

    $("removeLpAmount").value = "";
    setRemoveStatus(`Liquidity removed from ${keyA}/${keyB} at block ${receipt.blockNumber}.`, "success");

    await refreshBalances();
    await updateLiquidityQuote("");
  } catch (err) {
    setRemoveStatus("Failed to remove liquidity: " + errorText(err), "error");
  } finally {
    busy = false;
    await updateRemoveLiquidityQuote();
  }
}
async function copyFaucetContract(key, button) {
  const token = asset(key);
  const address = token?.address;
  const card = document.querySelector(`[data-faucet-key="${key}"]`);
  const status = card?.querySelector(".contract-copy-status");

  if (!address) {
    if (status) status.textContent = "Contract address is unavailable.";
    return;
  }

  try {
    let copied = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(address);
        copied = true;
      } catch {}
    }

    if (!copied) {
      const field = document.createElement("textarea");
      field.value = address;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      copied = document.execCommand("copy");
      field.remove();
    }

    if (!copied) throw new Error("Clipboard access was denied.");

    button.classList.add("copied");
    button.title = "Copied";
    button.setAttribute("aria-label", "Contract address copied");

    if (status) {
      status.textContent = "Contract address copied. Paste it into Swap > Import Token.";
    }

    setTimeout(() => {
      if (button.isConnected) {
        button.classList.remove("copied");
        button.title = "Copy contract address";
        button.setAttribute("aria-label", "Copy contract address");
      }
    }, 1800);
  } catch (error) {
    if (status) {
      status.textContent = "Copy failed. Select and copy the contract address manually.";
    }
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
      <div class="faucet-contract">
        <div class="faucet-contract-header">
          <div class="faucet-contract-label">Token contract</div>
          <button class="secondary-btn faucet-copy-btn"
                  type="button"
                  title="Copy contract address"
                  aria-label="Copy contract address"
                  data-copy-contract="${key}">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="8" y="8" width="12" height="13" rx="2"></rect>
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
        </div>
        <div class="faucet-contract-row">
          <code class="faucet-contract-address">${asset(key).address}</code>
        </div>
        <div class="contract-copy-status" aria-live="polite"></div>
      </div>
      <div class="faucet-amount">Amount: --</div>
      <div class="faucet-balance">Balance: --</div>
      <div class="faucet-cooldown">Claim available</div>
      <button class="primary-btn claim-btn" data-claim="${key}">Faucet ${asset(key).displayName}</button>
      <div class="claim-status" role="status"></div>
    </article>
  `).join("");

  document.querySelectorAll("[data-claim]").forEach(button => {
    button.addEventListener("click",() => claimFaucet(button.dataset.claim,button));
  });

  document.querySelectorAll("[data-copy-contract]").forEach(button => {
    button.addEventListener("click", () =>
      copyFaucetContract(button.dataset.copyContract, button)
    );
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

    if (page === "swap") await restoreImportedTokens();

    if (page === "swap") renderSwap();
    else if (page === "liquidity") renderLiquidity();
    else if (page === "market") await renderMarket();
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