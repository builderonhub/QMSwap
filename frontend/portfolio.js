import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.qms.finance";
const CHAIN_ID = 19480n;
const CHAIN_HEX = "0x4c18";
const EXPLORER = "https://testnet.qmsscan.io";

const QWAP_ROUTER = "0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619";
const QWAP_FACTORY = "0x93AFD9aC50822F82c7C4f2Ec8Ec2463b086Fb878";
const WQMS = "0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34";
const USDC_QWAP = "0xDd4D61DF875cc613E1372c78827a5F4C2741bf11";

const $ = id => document.getElementById(id);
const rpc = new ethers.JsonRpcProvider(RPC_URL, Number(CHAIN_ID));

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const QMSWAP_ROUTER_ABI = [
  "function quoteOut(address,address,uint256) view returns (uint256)"
];

const QWAP_ROUTER_ABI = [
  "function getAmountsOut(uint256,address[]) view returns (uint256[])"
];

const QWAP_FACTORY_ABI = [
  "function getPair(address,address) view returns (address)"
];

const LP_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const QWAP_ASSETS = [
  {
    key: "QWAP_USDC",
    address: USDC_QWAP,
    symbol: "USDC",
    decimals: 6,
    displayName: "USDC (QWAP)",
    source: "QWAP"
  },
  {
    key: "QWAP_WETH",
    address: "0x43D7c8434A5290a32C8725224870ad6f85132a31",
    symbol: "WETH",
    decimals: 18,
    displayName: "WETH (QWAP)",
    source: "QWAP"
  },
  {
    key: "QWAP_USDT",
    address: "0x5D1386fC130143F92511bC2D18124D3E414ed429",
    symbol: "USDT",
    decimals: 6,
    displayName: "USDT (QWAP)",
    source: "QWAP"
  },
  {
    key: "QWAP_WBTC",
    address: "0x5eBfE302200a5b22E182a5C0D10444Fe44b2A678",
    symbol: "WBTC",
    decimals: 8,
    displayName: "WBTC (QWAP)",
    source: "QWAP"
  },
  {
    key: "QWAP_WQMS",
    address: WQMS,
    symbol: "WQMS",
    decimals: 18,
    displayName: "WQMS (QWAP)",
    source: "QWAP"
  }
];

let config = null;
let assets = [];
let account = "";
let walletProvider = null;
let injectedWallet = null;
let qmswapRouterRead = null;
let qwapRouterRead = null;
let portfolioRows = [];
let lpRows = [];
let lpDiscoveryError = "";
let lpPriceCache = new Map();
let qwapFactoryRead = null;
let loading = false;
let walletEventsBound = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatUnits(value, decimals, maxFraction = 6) {
  if (value === null || value === undefined) return "—";

  const parts = ethers.formatUnits(value, decimals).split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (parts[1] || "").slice(0, maxFraction).replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Not connected";
}

function setStatus(message, type = "") {
  $("status").textContent = message;
  $("status").dataset.tone = type;
}

function getInjectedWallet() {
  if (window.okxwallet && typeof window.okxwallet.request === "function") {
    return window.okxwallet;
  }
  if (window.ethereum && typeof window.ethereum.request === "function") {
    return window.ethereum;
  }
  return null;
}

function normalizeLocalAsset(key, raw) {
  if (!raw || typeof raw !== "object") return null;

  const isNative = key === "QMS";
  const address = String(raw.address || "");
  const decimals = Number(raw.decimals ?? 18);

  if (!isNative && !ethers.isAddress(address)) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;

  return {
    key,
    address,
    symbol: String(raw.symbol || key),
    decimals,
    displayName: String(raw.displayName || raw.name || key),
    source: "QMSwap",
    isNative
  };
}

function buildAssets(cfg) {
  const tokenMap = cfg.tokens || {};
  const entries = Array.isArray(tokenMap)
    ? tokenMap.map((token, index) => [token.key || token.symbol || `TOKEN_${index}`, token])
    : Object.entries(tokenMap);

  const localAssets = entries
    .map(([key, raw]) => normalizeLocalAsset(key, raw))
    .filter(Boolean);

  const combined = [
    ...localAssets,
    ...QWAP_ASSETS.map(asset => ({ ...asset, isNative: false }))
  ];

  const seen = new Set();

  return combined.filter(asset => {
    if (seen.has(asset.key)) return false;
    seen.add(asset.key);
    return true;
  });
}

async function loadConfig() {
  const url = new URL("/deployments/qmswap-multipair-v6.json", location.origin);
  url.searchParams.set("ts", String(Date.now()));

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load QMSwap configuration (${response.status}).`);
  }

  config = await response.json();

  if (
    Number(config.chainId) !== Number(CHAIN_ID) ||
    !config.router ||
    !config.tokens ||
    !config.tokens.QMS
  ) {
    throw new Error("The QMSwap deployment configuration is invalid.");
  }

  assets = buildAssets(config);
  qmswapRouterRead = new ethers.Contract(
    config.router,
    QMSWAP_ROUTER_ABI,
    rpc
  );
  qwapRouterRead = new ethers.Contract(
    QWAP_ROUTER,
    QWAP_ROUTER_ABI,
    rpc
  );
  qwapFactoryRead = new ethers.Contract(
    QWAP_FACTORY,
    QWAP_FACTORY_ABI,
    rpc
  );

  $("assetTotal").textContent = String(assets.length);
  setStatus(`Loaded ${assets.length} assets. Connect your wallet to view balances.`);
}

function updateWalletLabel() {
  $("walletChip").textContent = shortAddress(account);
  $("connectBtn").textContent = account ? shortAddress(account) : "Connect Wallet";
}

async function ensureTestnet() {
  const network = await walletProvider.getNetwork();
  if (network.chainId === CHAIN_ID) return;

  if (!injectedWallet) {
    throw new Error("Connect your wallet first.");
  }

  try {
    await injectedWallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }]
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;

    await injectedWallet.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_HEX,
        chainName: "QMS Testnet",
        nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER]
      }]
    });

    await injectedWallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }]
    });
  }

  walletProvider = new ethers.BrowserProvider(injectedWallet);
  const switchedNetwork = await walletProvider.getNetwork();

  if (switchedNetwork.chainId !== CHAIN_ID) {
    throw new Error("Your wallet is not connected to QMS Testnet.");
  }
}

function bindWalletEvents() {
  if (walletEventsBound || !injectedWallet) return;
  walletEventsBound = true;

  if (typeof injectedWallet.on === "function") {
    injectedWallet.on("accountsChanged", async accounts => {
      account = accounts?.length ? ethers.getAddress(accounts[0]) : "";
      updateWalletLabel();

      if (account) {
        await refreshPortfolio();
      } else {
        portfolioRows = [];
        lpRows = [];
        renderPortfolio();
        renderLpPositions();
        setStatus("Wallet disconnected.");
      }
    });

    injectedWallet.on("chainChanged", () => location.reload());
  }
}

async function connectWallet() {
  try {
    injectedWallet = getInjectedWallet();

    if (!injectedWallet) {
      throw new Error("No MetaMask or compatible EVM wallet was found.");
    }

    const accounts = await injectedWallet.request({
      method: "eth_requestAccounts"
    });

    if (!accounts?.length) return;

    walletProvider = new ethers.BrowserProvider(injectedWallet);
    await ensureTestnet();

    account = ethers.getAddress(accounts[0]);
    walletProvider = new ethers.BrowserProvider(injectedWallet);

    bindWalletEvents();
    updateWalletLabel();
    await refreshPortfolio();
  } catch (error) {
    setStatus(error?.shortMessage || error?.message || String(error), "error");
  }
}

function sampleAmounts(decimals) {
  const unit = 10n ** BigInt(decimals);
  return [...new Set([
    unit,
    unit / 10n,
    unit / 100n,
    unit / 1000n,
    unit / 10000n,
    1n
  ].filter(amount => amount > 0n).map(String))].map(BigInt);
}

async function quoteQwapToUsdc(tokenAddress, amountIn) {
  const token = tokenAddress.toLowerCase();
  const usdc = USDC_QWAP.toLowerCase();
  const wrapped = WQMS.toLowerCase();

  if (token === usdc) return amountIn;

  const paths = [[tokenAddress, USDC_QWAP]];

  if (token !== wrapped) {
    paths.push([tokenAddress, WQMS, USDC_QWAP]);
  }

  let bestOutput = null;

  for (const path of paths) {
    try {
      const amounts = await qwapRouterRead.getAmountsOut(amountIn, path);
      const output = BigInt(amounts[amounts.length - 1]);

      if (output > 0n && (bestOutput === null || output > bestOutput)) {
        bestOutput = output;
      }
    } catch {
      // The route may not have a pool or sufficient liquidity.
    }
  }

  return bestOutput;
}

function createValuation(balanceRaw, decimals, sampleIn, sampleOut) {
  if (sampleIn <= 0n || sampleOut <= 0n) return null;

  const scale = 10n ** BigInt(decimals);

  return {
    priceRaw: sampleOut * scale / sampleIn,
    valueRaw: balanceRaw * sampleOut / sampleIn
  };
}

async function estimateAsset(asset, balanceRaw) {
  if (asset.key === "QWAP_USDC") {
    return {
      priceRaw: 1000000n,
      valueRaw: balanceRaw
    };
  }

  for (const sampleIn of sampleAmounts(asset.decimals)) {
    try {
      let sampleOut = null;

      if (asset.source === "QWAP") {
        sampleOut = await quoteQwapToUsdc(asset.address, sampleIn);
      } else if (asset.key === "QMS") {
        sampleOut = await quoteQwapToUsdc(WQMS, sampleIn);
      } else {
        const qmsAmount = BigInt(await qmswapRouterRead.quoteOut(
          asset.address,
          config.tokens.QMS.address,
          sampleIn
        ));

        if (qmsAmount > 0n) {
          sampleOut = await quoteQwapToUsdc(WQMS, qmsAmount);
        }
      }

      if (sampleOut !== null && sampleOut > 0n) {
        return createValuation(
          balanceRaw,
          asset.decimals,
          sampleIn,
          sampleOut
        );
      }
    } catch {
      // Try a smaller sample amount or leave the asset unpriced.
    }
  }

  return null;
}

async function readBalance(asset) {
  try {
    const balanceRaw = asset.isNative
      ? BigInt(await rpc.getBalance(account))
      : BigInt(await new ethers.Contract(
          asset.address,
          ERC20_ABI,
          rpc
        ).balanceOf(account));

    return {
      asset,
      balanceRaw,
      priceRaw: null,
      valueRaw: null,
      error: null
    };
  } catch (error) {
    return {
      asset,
      balanceRaw: null,
      priceRaw: null,
      valueRaw: null,
      error: error?.shortMessage || error?.message || "Balance read failed."
    };
  }
}


async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }));

  return results;
}

async function readPairReserves(pairAddress) {
  // Read raw returndata because QMSwap V6 returns two words while V2-style pairs return three.
  const data = await rpc.call({ to: pairAddress, data: "0x0902f1ac" });
  if (!data || data === "0x") throw new Error("Pool reserves are unavailable.");

  const byteLength = (data.length - 2) / 2;
  const wordCount = byteLength / 32;
  if (!Number.isInteger(wordCount) || wordCount < 2 || wordCount > 3) {
    throw new Error(`Unsupported getReserves response (${wordCount} words).`);
  }

  const types = Array.from({ length: wordCount }, () => "uint256");
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(types, data);
  return { reserve0: BigInt(decoded[0]), reserve1: BigInt(decoded[1]) };
}

function assetForAddress(address) {
  const normalized = String(address || "").toLowerCase();
  return assets.find(asset => asset.address.toLowerCase() === normalized) || null;
}

async function getAssetPriceRaw(asset) {
  const cacheKey = asset.address.toLowerCase();
  if (!lpPriceCache.has(cacheKey)) {
    const pricePromise = (async () => {
      try {
        const oneToken = 10n ** BigInt(asset.decimals);
        const valuation = await estimateAsset(asset, oneToken);
        return valuation && valuation.priceRaw > 0n ? valuation.priceRaw : null;
      } catch {
        return null;
      }
    })();
    lpPriceCache.set(cacheKey, pricePromise);
  }
  return lpPriceCache.get(cacheKey);
}

async function readLpPosition(venue, poolName, pairAddress) {
  try {
    const pair = new ethers.Contract(pairAddress, LP_PAIR_ABI, rpc);
    const [balanceResult, supplyResult] = await Promise.all([
      pair.balanceOf(account),
      pair.totalSupply()
    ]);
    const lpBalanceRaw = BigInt(balanceResult);
    const totalSupplyRaw = BigInt(supplyResult);

    if (lpBalanceRaw <= 0n || totalSupplyRaw <= 0n) return null;

    const [token0Result, token1Result, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      readPairReserves(pairAddress)
    ]);

    const token0Address = ethers.getAddress(token0Result);
    const token1Address = ethers.getAddress(token1Result);
    const asset0 = assetForAddress(token0Address);
    const asset1 = assetForAddress(token1Address);
    const amount0Raw = reserves.reserve0 * lpBalanceRaw / totalSupplyRaw;
    const amount1Raw = reserves.reserve1 * lpBalanceRaw / totalSupplyRaw;
    const shareBps = lpBalanceRaw * 10000n / totalSupplyRaw;

    let valueRaw = null;
    let price0Raw = null;
    let price1Raw = null;

    if (asset0 && asset1) {
      [price0Raw, price1Raw] = await Promise.all([
        getAssetPriceRaw(asset0),
        getAssetPriceRaw(asset1)
      ]);

      if (price0Raw !== null && price1Raw !== null) {
        const value0 = amount0Raw * price0Raw / (10n ** BigInt(asset0.decimals));
        const value1 = amount1Raw * price1Raw / (10n ** BigInt(asset1.decimals));
        valueRaw = value0 + value1;
      }
    }

    return {
      venue,
      poolName,
      address: ethers.getAddress(pairAddress),
      token0Address,
      token1Address,
      asset0,
      asset1,
      lpBalanceRaw,
      totalSupplyRaw,
      shareBps,
      amount0Raw,
      amount1Raw,
      price0Raw,
      price1Raw,
      valueRaw,
      error: null
    };
  } catch (error) {
    return {
      venue,
      poolName,
      address: String(pairAddress),
      lpBalanceRaw: null,
      totalSupplyRaw: null,
      shareBps: null,
      amount0Raw: null,
      amount1Raw: null,
      valueRaw: null,
      error: error?.shortMessage || error?.reason || error?.message || "LP position read failed."
    };
  }
}

async function loadLpPositions() {
  lpDiscoveryError = "";
  lpPriceCache = new Map();

  const qmswapEntries = Object.entries(config.pairs || {}).map(([name, address]) => ({
    venue: "QMSwap V6",
    name,
    address
  }));

  const qmswapPositions = await mapWithConcurrency(qmswapEntries, 4, item =>
    readLpPosition(item.venue, item.name, item.address)
  );

  const candidates = [];
  for (let i = 0; i < QWAP_ASSETS.length; i++) {
    for (let j = i + 1; j < QWAP_ASSETS.length; j++) {
      candidates.push([QWAP_ASSETS[i], QWAP_ASSETS[j]]);
    }
  }

  const discovered = await mapWithConcurrency(candidates, 4, async ([assetA, assetB]) => {
    try {
      const pairAddress = await qwapFactoryRead.getPair(assetA.address, assetB.address);
      if (!pairAddress || pairAddress === ethers.ZeroAddress) return null;
      return {
        venue: "QWAP",
        name: `${assetA.symbol}/${assetB.symbol}`,
        address: ethers.getAddress(pairAddress)
      };
    } catch (error) {
      if (!lpDiscoveryError) {
        lpDiscoveryError = error?.shortMessage || error?.message || "QWAP pool discovery failed.";
      }
      return null;
    }
  });

  const uniqueQwapPairs = [...new Map(
    discovered.filter(Boolean).map(item => [item.address.toLowerCase(), item])
  ).values()];

  const qwapPositions = await mapWithConcurrency(uniqueQwapPairs, 4, item =>
    readLpPosition(item.venue, item.name, item.address)
  );

  return [...qmswapPositions, ...qwapPositions].filter(Boolean);
}

function renderLpPositions() {
  const query = $("filterInput").value.trim().toLowerCase();
  const active = lpRows.filter(row => row.lpBalanceRaw !== null && row.lpBalanceRaw > 0n);
  const priced = active.filter(row => row.valueRaw !== null);
  const lpTotalValue = priced.reduce((total, row) => total + row.valueRaw, 0n);

  $("lpPositionCount").textContent = String(active.length);
  $("lpTotalValue").textContent = `${formatUnits(lpTotalValue, 6, 2)} USDC`;

  if (!account) {
    $("lpRows").innerHTML = '<tr><td colspan="5" class="empty">Connect your wallet to view LP positions.</td></tr>';
    return;
  }

  const visible = lpRows.filter(row => {
    if (row.lpBalanceRaw === 0n) return false;
    const searchText = [row.poolName, row.venue, row.address,
      row.asset0?.symbol, row.asset1?.symbol,
      row.asset0?.displayName, row.asset1?.displayName].join(" ").toLowerCase();
    return !query || searchText.includes(query);
  });

  if (!visible.length) {
    const message = lpDiscoveryError
      ? `No LP positions found. QWAP discovery warning: ${esc(lpDiscoveryError)}`
      : "No LP token balances detected in the configured QMSwap V6 pools or discovered QWAP pools.";
    $("lpRows").innerHTML = `<tr><td colspan="5" class="empty">${message}</td></tr>`;
    return;
  }

  $("lpRows").innerHTML = visible.map(row => {
    const link = `<a class="contract" href="${EXPLORER}/address/${encodeURIComponent(row.address)}" target="_blank" rel="noopener noreferrer">${esc(shortAddress(row.address))}</a>`;

    if (row.error) {
      return `<tr>
        <td><div class="asset-name">${esc(row.poolName)}</div><div class="asset-meta">${esc(row.venue)} · ${link}</div></td>
        <td class="number">—</td><td>—</td><td class="number">—</td>
        <td><span class="error-text">${esc(row.error)}</span></td>
      </tr>`;
    }

    const shareText = row.shareBps === 0n
      ? "&lt;0.01%"
      : `${(Number(row.shareBps) / 100).toFixed(2)}%`;
    const token0Label = row.asset0
      ? `${formatUnits(row.amount0Raw, row.asset0.decimals, 6)} ${esc(row.asset0.symbol)}`
      : `${formatUnits(row.amount0Raw, 18, 6)} ${esc(shortAddress(row.token0Address))}`;
    const token1Label = row.asset1
      ? `${formatUnits(row.amount1Raw, row.asset1.decimals, 6)} ${esc(row.asset1.symbol)}`
      : `${formatUnits(row.amount1Raw, 18, 6)} ${esc(shortAddress(row.token1Address))}`;
    const underlying = `${token0Label} + ${token1Label}`;
    const value = row.valueRaw === null
      ? '<span class="muted">Unpriced</span>'
      : `${formatUnits(row.valueRaw, 6, 2)} USDC`;
    const status = row.valueRaw !== null
      ? '<span class="priced">Priced</span>'
      : '<span class="muted">Missing token metadata or valid price route</span>';

    return `<tr>
      <td><div class="asset-name">${esc(row.poolName)}</div><div class="asset-meta">${esc(row.venue)} · ${link}</div></td>
      <td class="number">${formatUnits(row.lpBalanceRaw, 18, 8)} <span class="muted">LP</span><div class="asset-meta">${shareText} of pool</div></td>
      <td>${underlying}</td>
      <td class="number strong">${value}</td>
      <td>${status}</td>
    </tr>`;
  }).join("");
}


async function refreshPortfolio() {
  if (loading) return;

  if (!account) {
    setStatus("Connect your wallet to view your portfolio.", "warn");
    return;
  }

  loading = true;
  $("refreshBtn").disabled = true;
  $("switchBtn").hidden = true;
  setStatus("Reading wallet balances, LP positions and on-chain quotes...");

  try {
    walletProvider = new ethers.BrowserProvider(injectedWallet);
    const network = await walletProvider.getNetwork();

    if (network.chainId !== CHAIN_ID) {
      $("switchBtn").hidden = false;
      setStatus("Your wallet is not connected to QMS Testnet.", "error");
      return;
    }

    const balances = await Promise.all(assets.map(readBalance));
    portfolioRows = await Promise.all(balances.map(async row => {
      if (row.balanceRaw === null) return row;
      try {
        const valuation = await estimateAsset(row.asset, row.balanceRaw);
        return valuation ? { ...row, ...valuation } : row;
      } catch {
        return row;
      }
    }));

    lpRows = await loadLpPositions();
    renderPortfolio();
    renderLpPositions();
    $("updatedAt").textContent = new Date().toLocaleTimeString("en-US");
    $("networkPill").textContent = "QMS Testnet · Chain 19480";

    const held = portfolioRows.filter(row => row.balanceRaw !== null && row.balanceRaw > 0n);
    const priced = held.filter(row => row.valueRaw !== null);
    const unpricedCount = held.length - priced.length;
    const activeLp = lpRows.filter(row => row.lpBalanceRaw !== null && row.lpBalanceRaw > 0n);
    const pricedLp = activeLp.filter(row => row.valueRaw !== null);
    const lpUnpricedCount = activeLp.length - pricedLp.length;

    const summary = `Updated ${held.length} wallet assets (${priced.length} priced, ${unpricedCount} unpriced) and ${activeLp.length} LP positions (${pricedLp.length} priced, ${lpUnpricedCount} unpriced).`;
    setStatus(lpDiscoveryError ? `${summary} QWAP discovery warning: ${lpDiscoveryError}` : summary,
      (unpricedCount || lpUnpricedCount || lpDiscoveryError) ? "warn" : "success");
  } catch (error) {
    setStatus(error?.shortMessage || error?.message || String(error), "error");
  } finally {
    loading = false;
    $("refreshBtn").disabled = false;
  }
}

function renderPortfolio() {
  const query = $("filterInput").value.trim().toLowerCase();
  const held = portfolioRows.filter(row => row.balanceRaw !== null && row.balanceRaw > 0n);
  const priced = held.filter(row => row.valueRaw !== null);
  const walletTotalValue = priced.reduce((total, row) => total + row.valueRaw, 0n);
  const lpTotalValue = lpRows.filter(row => row.valueRaw !== null)
    .reduce((total, row) => total + row.valueRaw, 0n);
  const totalValue = walletTotalValue + lpTotalValue;

  $("totalValue").textContent = `${formatUnits(totalValue, 6, 2)} USDC`;
  $("totalMeta").textContent = `Wallet assets ${formatUnits(walletTotalValue, 6, 2)} + LP positions ${formatUnits(lpTotalValue, 6, 2)} USDC (estimated).`;
  $("heldCount").textContent = String(held.length);
  $("valuedCount").textContent = String(priced.length);
  $("unpricedCount").textContent = String(held.length - priced.length);

  const sorted = [...portfolioRows].sort((a, b) => {
    if (a.valueRaw !== null && b.valueRaw === null) return -1;
    if (a.valueRaw === null && b.valueRaw !== null) return 1;
    if (a.valueRaw !== null && b.valueRaw !== null) {
      if (a.valueRaw === b.valueRaw) return 0;
      return a.valueRaw > b.valueRaw ? -1 : 1;
    }
    return a.asset.displayName.localeCompare(b.asset.displayName);
  });

  const visible = sorted.filter(row => {
    const searchText = [row.asset.key, row.asset.symbol, row.asset.displayName, row.asset.address]
      .join(" ").toLowerCase();
    return !query || searchText.includes(query);
  });

  if (!account) {
    $("assetRows").innerHTML = '<tr><td colspan="6" class="empty">Connect your wallet to view assets.</td></tr>';
    return;
  }
  if (!visible.length) {
    $("assetRows").innerHTML = '<tr><td colspan="6" class="empty">No matching assets found.</td></tr>';
    return;
  }

  $("assetRows").innerHTML = visible.map(row => {
    const asset = row.asset;
    const allocation = row.valueRaw !== null && totalValue > 0n
      ? `${Number(row.valueRaw * 10000n / totalValue) / 100}%`
      : "—";
    const addressLabel = asset.isNative
      ? '<span class="muted">Native coin</span>'
      : `<a class="contract" href="${EXPLORER}/address/${encodeURIComponent(asset.address)}" target="_blank" rel="noopener noreferrer">${esc(shortAddress(asset.address))}</a>`;
    const balance = row.balanceRaw === null
      ? '<span class="error-text">Balance read failed</span>'
      : `${esc(formatUnits(row.balanceRaw, asset.decimals, 6))} <span class="muted">${esc(asset.symbol)}</span>`;
    const price = row.priceRaw === null ? "—" : `${formatUnits(row.priceRaw, 6, 4)} USDC`;
    const value = row.valueRaw === null
      ? '<span class="muted">Unpriced</span>'
      : `${formatUnits(row.valueRaw, 6, 2)} USDC`;
    const status = row.error
      ? `<span class="error-text">${esc(row.error)}</span>`
      : row.priceRaw !== null
        ? '<span class="priced">Priced</span>'
        : '<span class="muted">Unpriced</span>';

    return `<tr>
      <td><div class="asset-name">${esc(asset.displayName)}</div><div class="asset-meta">${esc(asset.source)} · ${addressLabel}</div></td>
      <td class="number">${balance}</td>
      <td class="number">${price}</td>
      <td class="number strong">${value}</td>
      <td class="number">${allocation}</td>
      <td>${status}</td>
    </tr>`;
  }).join("");
}

function exportCsv() {
  if (!portfolioRows.length && !lpRows.length) {
    setStatus("No portfolio data is available to export.", "warn");
    return;
  }

  const headers = [
    "Record Type", "Asset / Pool", "Symbol / Underlying", "Venue / Source",
    "Contract Address", "Balance / LP Shares", "Decimals",
    "Estimated Price USDC", "Estimated Value USDC", "LP Share %", "Underlying Amounts", "Status"
  ];

  const walletRecords = portfolioRows.map(row => [
    "Wallet Asset",
    row.asset.displayName,
    row.asset.symbol,
    row.asset.source,
    row.asset.address,
    row.balanceRaw === null ? "" : ethers.formatUnits(row.balanceRaw, row.asset.decimals),
    row.asset.decimals,
    row.priceRaw === null ? "" : ethers.formatUnits(row.priceRaw, 6),
    row.valueRaw === null ? "" : ethers.formatUnits(row.valueRaw, 6),
    "",
    "",
    row.error || (row.priceRaw !== null ? "Priced" : "Unpriced")
  ]);

  const lpRecords = lpRows.map(row => {
    const underlying = row.error ? "" : [
      `${formatUnits(row.amount0Raw, row.asset0?.decimals ?? 18, 8)} ${row.asset0?.symbol || shortAddress(row.token0Address)}`,
      `${formatUnits(row.amount1Raw, row.asset1?.decimals ?? 18, 8)} ${row.asset1?.symbol || shortAddress(row.token1Address)}`
    ].join(" + ");
    const sharePercent = row.shareBps === null || row.shareBps === undefined
      ? ""
      : (Number(row.shareBps) / 100).toFixed(2);
    return [
      "LP Position", row.poolName, "LP", row.venue, row.address,
      row.lpBalanceRaw === null ? "" : ethers.formatUnits(row.lpBalanceRaw, 18),
      18, "", row.valueRaw === null ? "" : ethers.formatUnits(row.valueRaw, 6),
      sharePercent, underlying,
      row.error || (row.valueRaw !== null ? "Priced" : "Unpriced")
    ];
  });

  const csv = [headers, ...walletRecords, ...lpRecords].map(record =>
    record.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8"
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `qmswap-portfolio-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

$("connectBtn").addEventListener("click", connectWallet);
$("switchBtn").addEventListener("click", async () => {
  try {
    await ensureTestnet();
    await refreshPortfolio();
  } catch (error) {
    setStatus(error?.shortMessage || error?.message || String(error), "error");
  }
});
$("refreshBtn").addEventListener("click", refreshPortfolio);
$("downloadBtn").addEventListener("click", exportCsv);
$("filterInput").addEventListener("input", () => {
  renderPortfolio();
  renderLpPositions();
});

async function boot() {
  try {
    await loadConfig();
    renderPortfolio();
    renderLpPositions();
  } catch (error) {
    setStatus(error?.message || String(error), "error");
    return;
  }

  injectedWallet = getInjectedWallet();

  if (!injectedWallet) {
    setStatus("Connect a compatible wallet to view portfolio balances.");
    return;
  }

  walletProvider = new ethers.BrowserProvider(injectedWallet);
  bindWalletEvents();

  try {
    const accounts = await injectedWallet.request({ method: "eth_accounts" });

    if (accounts?.length) {
      account = ethers.getAddress(accounts[0]);
      updateWalletLabel();
      await refreshPortfolio();
    }
  } catch {
    setStatus("Connect your wallet to view portfolio balances.");
  }
}

updateWalletLabel();
boot();