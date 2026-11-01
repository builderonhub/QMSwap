import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.qms.finance";
const CHAIN_ID = 19480;
const EXPLORER = "https://testnet.qmsscan.io";
const DEPLOYMENT_URL = "/deployments/qmswap-multipair-v6.json";
const ORDERBOOK_URL = "/deployments/qmswap-limit-order-v2.json";

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event Swap(address indexed trader,address indexed tokenIn,uint256 amountIn,uint256 amountOut,address indexed to)"
];

const ROUTER_ABI = [
  "function getPair(address tokenA,address tokenB) view returns (address)",
  "function quoteOut(address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256)"
];

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)"
];

const ORDERBOOK_ABI = [
  "function createLimitOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry) payable returns (uint256 orderId)",
  "function executeOrder(uint256 orderId) returns (uint256 amountOut)",
  "function cancelOrder(uint256 orderId)",
  "function expireOrder(uint256 orderId)",
  "function getOrder(uint256 orderId) view returns (tuple(uint256 id,address owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry,uint8 status))",
  "event OrderCreated(uint256 indexed orderId,address indexed owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry)"
];

const PAIR_INTERFACE = new ethers.Interface(PAIR_ABI);
const SWAP_TOPIC = PAIR_INTERFACE.getEvent("Swap").topicHash;
const rpc = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const $ = (id) => document.getElementById(id);

let appConfig = null;
let tokenMap = {};
let addressToSymbol = new Map();
let pairConfig = [];
let pairSnapshots = [];
let routerRead = null;
let selectedQuote = "USDT";
let currentPrices = {};
let lastPriceChanges = {};
let poolVolumes = {};

const TOKEN_PAGE_SIZE = 5;
let tokenPricePage = 0;
let selectedChartToken = "BTC";
let marketHistoryWindow = null;
let chartHistoryPoints = [];
let chartResizeBound = false;
let orderBookAddress = null;
let orderBookConfig = null;
let walletProvider = null;
let walletSigner = null;
let walletAccount = null;
let marketContext = null;
async function ensureSharedWallet() {
  // Always refresh the module references from the main QMSwap application.
  if (marketContext?.getAccount) {
    walletAccount = marketContext.getAccount() || "";
  }

  if (marketContext?.getSigner) {
    walletSigner = marketContext.getSigner() || null;
  }

  if (!walletAccount || !walletSigner) {
    if (typeof marketContext?.ensureWallet !== "function") {
      throw new Error("Connect your wallet using the QMSwap header.");
    }

    await marketContext.ensureWallet();

    walletAccount = marketContext.getAccount() || "";
    walletSigner = marketContext.getSigner() || null;
  }

  if (!walletAccount || !walletSigner) {
    throw new Error("Connect your wallet using the QMSwap header.");
  }
}

let currentSide = "buy";
let refreshing = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function setStatus(message, tone = "") {
  const el = $("marketStatus");
  if (!el) return;

  el.textContent = message;
  el.dataset.tone = tone;

  // Hide routine success messages; keep loading, warnings and errors visible.
  el.hidden = tone === "success";
}

function setOrderStatus(message, tone = "") {
  $("orderStatus").textContent = message;
  $("orderStatus").dataset.tone = tone;
}

function setWalletLabel() { /* Wallet connects on order actions. */ }

function numberFormat(value, digits = 2) {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

function priceFormat(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8
  }).format(value);
}

function amountFormat(raw, decimals, maxDigits = 6) {
  try {
    const value = Number(ethers.formatUnits(raw, decimals));
    return numberFormat(value, maxDigits);
  } catch {
    return "Unavailable";
  }
}

function compactAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function token(symbol) {
  return tokenMap[symbol] || null;
}

function symbolForAddress(address) {
  return addressToSymbol.get(String(address).toLowerCase()) || "Unknown";
}

function findPairKey(a, b) {
  const direct = `${a}/${b}`;
  const reverse = `${b}/${a}`;
  if (appConfig?.pairs?.[direct]) return direct;
  if (appConfig?.pairs?.[reverse]) return reverse;
  return null;
}

async function loadDeployment() {
  const response = await fetch(`${DEPLOYMENT_URL}?ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Cannot load QMSwap V6 deployment configuration.");

  appConfig = await response.json();

  if (Number(appConfig.chainId) !== CHAIN_ID) {
    throw new Error(`Unexpected deployment chain ID: ${appConfig.chainId}`);
  }

  tokenMap = {};
  addressToSymbol = new Map();

  for (const [key, value] of Object.entries(appConfig.tokens || {})) {
    if (!value?.address) continue;
    const symbol = key.toUpperCase();
    tokenMap[symbol] = {
      symbol,
      address: value.address,
      decimals: Number(value.decimals),
      native: Boolean(value.native) || symbol === "QMS",
      displayName: value.displayName || symbol
    };
  }

  if (!tokenMap.QMS && appConfig.wqms) {
    tokenMap.QMS = {
      symbol: "QMS",
      address: appConfig.wqms,
      decimals: 18,
      native: true,
      displayName: "QMS"
    };
  }

  for (const [symbol, meta] of Object.entries(tokenMap)) {
    addressToSymbol.set(meta.address.toLowerCase(), symbol);
  }

  if (!tokenMap.QMS || !tokenMap.USDT || !tokenMap.USDC) {
    throw new Error("Deployment token configuration is missing QMS, USDT or USDC.");
  }

  pairConfig = Object.entries(appConfig.pairs || {}).map(([key, address]) => ({
    key,
    address
  }));

  if (pairConfig.length !== 15) {
    console.warn(`Expected 15 V6 pools, found ${pairConfig.length}.`);
  }

  routerRead = new ethers.Contract(appConfig.router, ROUTER_ABI, rpc);
}

async function readCurrentPools() {
  return Promise.all(pairConfig.map(async (item) => {
    const contract = new ethers.Contract(item.address, PAIR_ABI, rpc);
    try {
      const [token0, token1, reserve0, reserve1] = await Promise.all([
        contract.token0(),
        contract.token1(),
        contract.reserve0(),
        contract.reserve1()
      ]);

      return {
        ...item,
        token0,
        token1,
        reserve0,
        reserve1,
        error: null
      };
    } catch (error) {
      return {
        ...item,
        token0: ethers.ZeroAddress,
        token1: ethers.ZeroAddress,
        reserve0: 0n,
        reserve1: 0n,
        error: error?.shortMessage || error?.message || "Pool read failed"
      };
    }
  }));
}

function reserveFor(snapshot, address) {
  const target = address.toLowerCase();
  if (snapshot.token0.toLowerCase() === target) return snapshot.reserve0;
  if (snapshot.token1.toLowerCase() === target) return snapshot.reserve1;
  return null;
}

function priceFromSnapshots(assetSymbol, quoteSymbol, snapshots) {
  if (assetSymbol === quoteSymbol) return 1;

  const asset = token(assetSymbol);
  const quote = token(quoteSymbol);
  if (!asset || !quote) return null;

  const pairKey = findPairKey(assetSymbol, quoteSymbol);
  if (!pairKey) return null;

  const snapshot = snapshots.find((p) => p.key === pairKey);
  if (!snapshot || snapshot.error) return null;

  const assetReserve = reserveFor(snapshot, asset.address);
  const quoteReserve = reserveFor(snapshot, quote.address);

  if (assetReserve === null || quoteReserve === null) return null;
  if (assetReserve <= 0n || quoteReserve <= 0n) return null;

  const assetAmount = Number(ethers.formatUnits(assetReserve, asset.decimals));
  const quoteAmount = Number(ethers.formatUnits(quoteReserve, quote.decimals));

  if (!Number.isFinite(assetAmount) || assetAmount <= 0) return null;
  const result = quoteAmount / assetAmount;

  return Number.isFinite(result) && result > 0 ? result : null;
}

function buildPriceMap(snapshots) {
  const result = {};
  for (const symbol of Object.keys(tokenMap)) {
    result[symbol] = priceFromSnapshots(symbol, selectedQuote, snapshots);
  }
  result[selectedQuote] = 1;
  return result;
}

function pairTvl(snapshot, prices) {
  if (snapshot.error) return null;

  const symbol0 = symbolForAddress(snapshot.token0);
  const symbol1 = symbolForAddress(snapshot.token1);
  const meta0 = token(symbol0);
  const meta1 = token(symbol1);

  if (!meta0 || !meta1) return null;
  const price0 = prices[symbol0];
  const price1 = prices[symbol1];

  if (price0 === null || price0 === undefined ||
      price1 === null || price1 === undefined) return null;

  const amount0 = Number(ethers.formatUnits(snapshot.reserve0, meta0.decimals));
  const amount1 = Number(ethers.formatUnits(snapshot.reserve1, meta1.decimals));

  if (!Number.isFinite(amount0) || !Number.isFinite(amount1)) return null;
  return amount0 * price0 + amount1 * price1;
}

function renderTokenRows(prices, changes) {
  // Every configured V6 token is listed; no hard-coded token omission.
  const preferredOrder = ["QMS", "BTC", "ETH", "BNB", "USDT", "USDC"];

  const symbols = [
    ...preferredOrder.filter((symbol) => token(symbol)),
    ...Object.keys(tokenMap)
      .filter((symbol) => !preferredOrder.includes(symbol))
      .sort()
  ];

  const totalPages = Math.max(
    1,
    Math.ceil(symbols.length / TOKEN_PAGE_SIZE)
  );

  tokenPricePage = Math.max(
    0,
    Math.min(tokenPricePage, totalPages - 1)
  );

  const start = tokenPricePage * TOKEN_PAGE_SIZE;
  const visibleSymbols = symbols.slice(
    start,
    start + TOKEN_PAGE_SIZE
  );

  $("priceHeader").textContent = `Price (${selectedQuote})`;

  const rows = visibleSymbols.map((symbol) => {
    const value = prices[symbol];
    const change = changes[symbol];

    let changeText = "Unavailable";
    let changeClass = "muted";

    if (change !== null && change !== undefined && Number.isFinite(change)) {
      changeText = `${change > 0 ? "+" : ""}${numberFormat(change, 2)}%`;
      changeClass = change > 0 ? "positive" : change < 0 ? "negative" : "muted";
    }

    return `
      <tr
        data-token-symbol="${esc(symbol)}"
        class="${symbol === selectedChartToken ? "selected-price-row" : ""}"
        aria-selected="${symbol === selectedChartToken ? "true" : "false"}"
      >
        <td><div class="asset-name">${esc(symbol)}</div></td>
        <td class="price-cell">
          ${value === null || value === undefined
            ? "Unavailable"
            : `${priceFormat(value)} ${esc(selectedQuote)}`}
        </td>
        <td class="${changeClass}">${changeText}</td>
      </tr>
    `;
  });

  // Keep the table body at exactly five rows on every page.
  while (rows.length < TOKEN_PAGE_SIZE) {
    rows.push(`
      <tr class="price-empty-row" aria-hidden="true">
        <td></td><td></td><td></td>
      </tr>
    `);
  }

  $("tokenRows").innerHTML = rows.join("");

  const pagination = $("tokenPagination");

  if (pagination) {
    $("tokenPageLabel").textContent =
      `Showing ${symbols.length ? start + 1 : 0}-${Math.min(start + TOKEN_PAGE_SIZE, symbols.length)} of ${symbols.length}`;

    pagination.querySelector('[data-page-action="previous"]').disabled =
      tokenPricePage <= 0;

    pagination.querySelector('[data-page-action="next"]').disabled =
      tokenPricePage >= totalPages - 1;
  }
}

function renderPoolSummary(snapshots, prices) {
  let totalTvl = 0;
  let knownTvlCount = 0;
  let activeCount = 0;

  for (const snapshot of snapshots) {
    const active = !snapshot.error &&
      snapshot.reserve0 > 0n &&
      snapshot.reserve1 > 0n;

    if (active) activeCount++;

    const tvl = pairTvl(snapshot, prices);

    if (tvl !== null) {
      totalTvl += tvl;
      knownTvlCount++;
    }
  }

  $("activePools").textContent = `${activeCount} / ${snapshots.length}`;

  $("totalTvl").textContent = knownTvlCount
    ? `${numberFormat(totalTvl, 2)} ${selectedQuote}`
    : "Unavailable";

  $("tvlMeta").textContent =
    `${knownTvlCount} pools with calculable TVL`;
}
async function findBlockAtTimestamp(targetTimestamp, latestNumber) {
  let low = 0;
  let high = latestNumber;
  let answer = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await rpc.getBlock(mid);
    if (!block) throw new Error(`Cannot read block ${mid}.`);

    if (Number(block.timestamp) <= targetTimestamp) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

async function readHistoricalPools(blockNumber) {
  return Promise.all(pairSnapshots.map(async (snapshot) => {
    const contract = new ethers.Contract(snapshot.address, PAIR_ABI, rpc);
    const [reserve0, reserve1] = await Promise.all([
      contract.reserve0({ blockTag: blockNumber }),
      contract.reserve1({ blockTag: blockNumber })
    ]);

    return { ...snapshot, reserve0, reserve1, error: null };
  }));
}

async function readTokenPriceHistory(
  tokenSymbol,
  quoteSymbol,
  startBlock,
  latestBlock
) {
  const asset = token(tokenSymbol);
  const quote = token(quoteSymbol);

  if (!asset || !quote || tokenSymbol === quoteSymbol) {
    return [];
  }

  const pairAddress =
    appConfig.pairs?.[`${tokenSymbol}/${quoteSymbol}`] ||
    appConfig.pairs?.[`${quoteSymbol}/${tokenSymbol}`];

  if (!pairAddress) {
    throw new Error(`No ${tokenSymbol}/${quoteSymbol} pool is configured.`);
  }

  const snapshot = pairSnapshots.find(
    (item) => item.address.toLowerCase() === pairAddress.toLowerCase()
  );

  if (!snapshot || snapshot.error) {
    throw new Error(`Cannot read ${tokenSymbol}/${quoteSymbol} pool.`);
  }

  const logs = await rpc.getLogs({
    address: pairAddress,
    topics: [SWAP_TOPIC],
    fromBlock: startBlock,
    toBlock: latestBlock
  });

  const assetAddress = asset.address.toLowerCase();
  const quoteAddress = quote.address.toLowerCase();

  const rawPoints = [];

  for (const log of logs) {
    const parsed = PAIR_INTERFACE.parseLog({
      topics: log.topics,
      data: log.data
    });

    if (!parsed) continue;

    const tokenIn = String(parsed.args.tokenIn).toLowerCase();
    const amountIn = parsed.args.amountIn;
    const amountOut = parsed.args.amountOut;

    let assetRaw;
    let quoteRaw;

    if (tokenIn === quoteAddress) {
      quoteRaw = amountIn;
      assetRaw = amountOut;
    } else if (tokenIn === assetAddress) {
      assetRaw = amountIn;
      quoteRaw = amountOut;
    } else {
      continue;
    }

    const assetAmount = Number(
      ethers.formatUnits(assetRaw, asset.decimals)
    );

    const quoteAmount = Number(
      ethers.formatUnits(quoteRaw, quote.decimals)
    );

    if (
      !Number.isFinite(assetAmount) ||
      !Number.isFinite(quoteAmount) ||
      assetAmount <= 0 ||
      quoteAmount <= 0
    ) {
      continue;
    }

    rawPoints.push({
      blockNumber: log.blockNumber,
      logIndex: log.index ?? log.logIndex ?? 0,
      price: quoteAmount / assetAmount
    });
  }

  if (!rawPoints.length) return [];

  const blockNumbers = [
    ...new Set(rawPoints.map((point) => point.blockNumber))
  ];

  const timestampEntries = await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await rpc.getBlock(blockNumber);
      return [
        blockNumber,
        block ? Number(block.timestamp) : null
      ];
    })
  );

  const timestamps = new Map(timestampEntries);

  return rawPoints
    .map((point) => ({
      timestamp: timestamps.get(point.blockNumber),
      price: point.price,
      logIndex: point.logIndex
    }))
    .filter((point) =>
      Number.isFinite(point.timestamp) &&
      Number.isFinite(point.price) &&
      point.price > 0
    )
    .sort((a, b) =>
      a.timestamp - b.timestamp || a.logIndex - b.logIndex
    );
}

function chartPriceFormat(value) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) return numberFormat(value, 2);
  if (value >= 1) return numberFormat(value, 4);
  return numberFormat(value, 8);
}

function drawTokenPriceChart() {
  const canvas = $("tokenPriceChart");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const width = rect.width;
  const height = rect.height;

  const left = 67;
  const right = 16;
  const top = 15;
  const bottom = 30;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  if (plotWidth <= 10 || plotHeight <= 10) return;

  const points = chartHistoryPoints.filter((point) =>
    Number.isFinite(point.price) &&
    Number.isFinite(point.timestamp) &&
    point.price > 0
  );

  ctx.font = "10px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(130, 150, 180, 0.17)";
  ctx.lineWidth = 1;

  if (points.length < 2) {
    for (let i = 0; i <= 4; i++) {
      const y = top + (plotHeight * i / 4);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
    }
    return;
  }

  const values = points.map((point) => point.price);
  let minPrice = Math.min(...values);
  let maxPrice = Math.max(...values);

  if (maxPrice === minPrice) {
    const padding = Math.max(Math.abs(maxPrice) * 0.005, 0.00000001);
    minPrice -= padding;
    maxPrice += padding;
  } else {
    const padding = (maxPrice - minPrice) * 0.12;
    minPrice -= padding;
    maxPrice += padding;
  }

  const minTime = points[0].timestamp;
  const maxTime = points[points.length - 1].timestamp;
  const timeRange = Math.max(1, maxTime - minTime);

  const xFor = (timestamp) =>
    left + ((timestamp - minTime) / timeRange) * plotWidth;

  const yFor = (price) =>
    top + ((maxPrice - price) / (maxPrice - minPrice)) * plotHeight;

  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = top + ratio * plotHeight;
    const price = maxPrice - ratio * (maxPrice - minPrice);

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.fillStyle = "#93a5bf";
    ctx.fillText(chartPriceFormat(price), left - 8, y);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#93a5bf";

  const firstTime = new Date(minTime * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const lastTime = new Date(maxTime * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  ctx.fillText(firstTime, left, height - bottom + 8);
  ctx.textAlign = "right";
  ctx.fillText(lastTime, width - right, height - bottom + 8);

  const gradient = ctx.createLinearGradient(0, top, 0, top + plotHeight);
  gradient.addColorStop(0, "rgba(139, 108, 246, 0.24)");
  gradient.addColorStop(1, "rgba(139, 108, 246, 0.01)");

  ctx.beginPath();

  points.forEach((point, index) => {
    const x = xFor(point.timestamp);
    const y = yFor(point.price);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  const last = points[points.length - 1];
  const first = points[0];

  ctx.lineTo(xFor(last.timestamp), top + plotHeight);
  ctx.lineTo(xFor(first.timestamp), top + plotHeight);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();

  points.forEach((point, index) => {
    const x = xFor(point.timestamp);
    const y = yFor(point.price);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#9878ff";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  const lastX = xFor(last.timestamp);
  const lastY = yFor(last.price);

  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#c5b5ff";
  ctx.fill();
}

function renderTokenChart(points, message) {
  chartHistoryPoints = Array.isArray(points) ? points : [];

  $("chartTokenLabel").textContent =
    `${selectedChartToken} / ${selectedQuote}`;

  const currentPrice = currentPrices[selectedChartToken];

  $("chartCurrentPrice").textContent =
    currentPrice === null || currentPrice === undefined
      ? "Price unavailable"
      : `${chartPriceFormat(currentPrice)} ${selectedQuote}`;

  const hasEnoughData = chartHistoryPoints.length >= 2;

  $("chartEmptyState").hidden = hasEnoughData;

  $("chartEmptyState").textContent = hasEnoughData
    ? ""
    : message || "Not enough on-chain price history is available.";

  $("chartFootnote").textContent =
    message || "Price history from QMSwap V6 on-chain swaps.";

  requestAnimationFrame(drawTokenPriceChart);
}

async function loadSelectedTokenChart() {
  const asset = token(selectedChartToken);

  if (!asset) {
    renderTokenChart([], "Selected token is not configured.");
    return;
  }

  if (selectedChartToken === selectedQuote) {
    renderTokenChart(
      [],
      "This is the selected quote asset. Choose another token to view its price chart."
    );
    return;
  }

  const points = [];
  const historyWindow = marketHistoryWindow;

  if (historyWindow) {
    const historicalPrice =
      historyWindow.historicalPrices?.[selectedChartToken];

    if (
      historicalPrice !== null &&
      historicalPrice !== undefined &&
      Number.isFinite(historicalPrice) &&
      historicalPrice > 0
    ) {
      points.push({
        timestamp: historyWindow.targetTimestamp,
        price: historicalPrice
      });
    }

    let tradePoints = [];

    try {
      tradePoints = await readTokenPriceHistory(
        selectedChartToken,
        selectedQuote,
        historyWindow.startBlock,
        historyWindow.latestBlock
      );
    } catch (error) {
      console.warn("Selected token 24H chart history unavailable:", error);
    }

    points.push(...tradePoints);

    const currentPrice = currentPrices[selectedChartToken];

    if (
      currentPrice !== null &&
      currentPrice !== undefined &&
      Number.isFinite(currentPrice) &&
      currentPrice > 0
    ) {
      points.push({
        timestamp: historyWindow.latestTimestamp,
        price: currentPrice
      });
    }

    const message = tradePoints.length
      ? `${tradePoints.length} on-chain swaps observed in the last 24 hours.`
      : "No swap events found in this 24H window. The chart uses available historical and current pool reserve snapshots.";

    renderTokenChart(points, message);
    return;
  }

  renderTokenChart(
    points,
    "The RPC did not provide a usable 24-hour historical block range."
  );
}

async function read24HourEvents(startBlock, latestBlock, prices) {
  const perPool = {};
  const recent = [];
  let totalVolume = 0;
  let complete = true;
  let successfulPools = 0;

  const results = await Promise.all(pairSnapshots.map(async (snapshot) => {
    try {
      const logs = await rpc.getLogs({
        address: snapshot.address,
        topics: [SWAP_TOPIC],
        fromBlock: startBlock,
        toBlock: latestBlock
      });
      return { snapshot, logs, error: null };
    } catch (error) {
      return { snapshot, logs: [], error };
    }
  }));

  for (const result of results) {
    const { snapshot, logs, error } = result;
    const poolKey = snapshot.address.toLowerCase();

    if (error) {
      complete = false;
      perPool[poolKey] = null;
      continue;
    }

    successfulPools++;
    let poolVolume = 0;

    for (const log of logs) {
      try {
        const parsed = PAIR_INTERFACE.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (!parsed) continue;

        const tokenInAddress = parsed.args.tokenIn;
        const amountIn = parsed.args.amountIn;
        const amountOut = parsed.args.amountOut;

        const tokenInSymbol = symbolForAddress(tokenInAddress);
        const tokenInMeta = token(tokenInSymbol);
        const tokenOutAddress =
          snapshot.token0.toLowerCase() === tokenInAddress.toLowerCase()
            ? snapshot.token1
            : snapshot.token0;
        const tokenOutSymbol = symbolForAddress(tokenOutAddress);
        const tokenOutMeta = token(tokenOutSymbol);

        if (tokenInMeta && prices[tokenInSymbol] !== null &&
            prices[tokenInSymbol] !== undefined) {
          const inputAmount = Number(
            ethers.formatUnits(amountIn, tokenInMeta.decimals)
          );
          const volume = inputAmount * prices[tokenInSymbol];
          if (Number.isFinite(volume)) poolVolume += volume;
        }

        recent.push({
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          pool: snapshot.key,
          amountIn: tokenInMeta
            ? `${amountFormat(amountIn, tokenInMeta.decimals)} ${tokenInSymbol}`
            : "Unknown",
          amountOut: tokenOutMeta
            ? `${amountFormat(amountOut, tokenOutMeta.decimals)} ${tokenOutSymbol}`
            : "Unknown"
        });
      } catch (error) {
        console.warn("Could not parse a Swap event:", error);
      }
    }

    perPool[poolKey] = poolVolume;
    totalVolume += poolVolume;
  }

  recent.sort((a, b) => b.blockNumber - a.blockNumber);

  return {
    perPool,
    recent: recent.slice(0, 20),
    totalVolume,
    complete,
    successfulPools
  };
}

function renderChanges(current, historical) {
  const changes = {};

  for (const symbol of Object.keys(tokenMap)) {
    const now = current[symbol];
    const before = historical?.[symbol];

    changes[symbol] = now !== null && now !== undefined &&
      before !== null && before !== undefined &&
      before > 0
        ? ((now / before) - 1) * 100
        : null;
  }

  changes[selectedQuote] = 0;
  return changes;
}

async function refreshMarket() {
  if (refreshing) return;
  refreshing = true;
  $("refreshBtn").disabled = true;

  try {
    setStatus("Reading QMSwap V6 pool reserves and recent Swap events...");

    const [network, latestBlock] = await Promise.all([
      rpc.getNetwork(),
      rpc.getBlockNumber()
    ]);

    if (Number(network.chainId) !== CHAIN_ID) {
      throw new Error(`RPC returned chain ${network.chainId}, expected ${CHAIN_ID}.`);
    }

    pairSnapshots = await readCurrentPools();
    currentPrices = buildPriceMap(pairSnapshots);

    let historicalPrices = null;
    let eventData = null;
    let historicalMessage = "24H historical price unavailable";

    try {
      const latest = await rpc.getBlock(latestBlock);
      if (!latest) throw new Error("Cannot read latest block timestamp.");

      const targetTimestamp = Number(latest.timestamp) - 86400;
      const startBlock = await findBlockAtTimestamp(targetTimestamp, latestBlock);

      marketHistoryWindow = startBlock !== null
        ? {
            startBlock,
            latestBlock,
            targetTimestamp,
            latestTimestamp: Number(latest.timestamp),
            historicalPrices: null
          }
        : null;

      if (startBlock !== null) {
        const results = await Promise.allSettled([
          readHistoricalPools(startBlock),
          read24HourEvents(startBlock, latestBlock, currentPrices)
        ]);

        if (results[0].status === "fulfilled") {
          historicalPrices = buildPriceMap(results[0].value);
          historicalMessage = `Historical snapshot: block ${startBlock.toLocaleString("en-US")}`;
        } else {
          historicalMessage = "Historical reserves unavailable from this RPC";
        }

        if (results[1].status === "fulfilled") {
          eventData = results[1].value;
          poolVolumes = eventData.perPool;
        } else {
          eventData = null;
          poolVolumes = {};
        }

        if (marketHistoryWindow) {
          marketHistoryWindow.historicalPrices = historicalPrices;
        }
      }
    } catch (error) {
      console.warn("24-hour data unavailable:", error);
      eventData = null;
      historicalPrices = null;
      marketHistoryWindow = null;
      historicalMessage = "24H historical data unavailable";
    }

    const changes = renderChanges(currentPrices, historicalPrices);

    lastPriceChanges = changes;

    renderTokenRows(currentPrices, changes);
    renderPoolSummary(pairSnapshots, currentPrices);

    await loadSelectedTokenChart();


    $("currentBlock").textContent = latestBlock.toLocaleString("en-US");
    $("historyMeta").textContent = historicalMessage;

    $("totalVolume").textContent = eventData
      ? `${numberFormat(eventData.totalVolume, 2)} ${selectedQuote}`
      : "Unavailable";

    $("updatedAt").textContent = `Updated ${new Date().toLocaleTimeString()}`;

    const failedPools = pairSnapshots.filter((p) => p.error).length;
    const notes = [];

    if (failedPools) notes.push(`${failedPools} pool reads failed`);
    if (!eventData) notes.push("24H event data unavailable");
    else if (!eventData.complete) {
      notes.push(`volume data partial (${eventData.successfulPools}/${pairSnapshots.length} pools)`);
    }
    if (!historicalPrices) notes.push("24H price change unavailable");

    if (notes.length) {
      setStatus(
        `QMSwap V6 data loaded at block ${latestBlock}. ${notes.join("; ")}.`,
        "warn"
      );
    } else {
      setStatus(
        `All ${pairSnapshots.length} V6 pools loaded. Prices, liquidity and 24H data refreshed.`,
        "success"
      );
    }
  } catch (error) {
    console.error(error);
    setStatus(
      `Market refresh failed: ${error?.shortMessage || error?.message || "Unknown RPC error"}`,
      "error"
    );
  } finally {
    refreshing = false;
    $("refreshBtn").disabled = false;
  }
}

function selectQuote(symbol) {
  if (!["USDT", "USDC"].includes(symbol) || selectedQuote === symbol) return;

  selectedQuote = symbol;

  document.querySelectorAll("[data-quote]").forEach((button) => {
    const active = button.dataset.quote === symbol;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  refreshMarket();
}

// ============================================================
// LIMIT ORDER USER INTERFACE
// ============================================================

function ceilDiv(numerator, denominator) {
  if (denominator <= 0n) throw new Error("Invalid price denominator.");
  return (numerator + denominator - 1n) / denominator;
}

function pairAddressExists(tokenIn, tokenOut) {
  const pairKey = findPairKey(tokenIn, tokenOut);
  return pairKey ? appConfig.pairs[pairKey] : null;
}

function populateLimitSelectors() {
  const symbols = Object.keys(tokenMap).filter((s) => tokenMap[s]?.address);
  const order = ["BTC", "ETH", "QMS", "USDT", "USDC", "BNB"];
  symbols.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  $("baseToken").innerHTML = symbols.map((s) =>
    `<option value="${esc(s)}">${esc(s)}</option>`
  ).join("");

  if (symbols.includes("BTC")) $("baseToken").value = "BTC";
  refreshQuoteOptions();
  updateOrderPreview();
}

function refreshQuoteOptions() {
  const base = $("baseToken").value;
  const symbols = Object.keys(tokenMap).filter((s) => s !== base);

  $("quoteToken").innerHTML = symbols.map((s) =>
    `<option value="${esc(s)}">${esc(s)}</option>`
  ).join("");

  if (symbols.includes("USDT")) $("quoteToken").value = "USDT";
  else if (symbols.includes("USDC")) $("quoteToken").value = "USDC";

  updateOrderPreview();
}

function getOrderPreview() {
  const baseSymbol = $("baseToken").value;
  const quoteSymbol = $("quoteToken").value;
  const base = token(baseSymbol);
  const quote = token(quoteSymbol);

  if (!base || !quote || baseSymbol === quoteSymbol) {
    throw new Error("Select two different tokens.");
  }

  const pairAddress = pairAddressExists(baseSymbol, quoteSymbol);
  if (!pairAddress) throw new Error("QMSwap pool does not exist for this pair. Trading is unavailable.");

  const amountText = $("orderAmount").value.trim();
  const priceText = $("limitPrice").value.trim();

  if (!amountText || !priceText) {
    throw new Error("Enter an amount and limit price.");
  }

  const priceScaled = ethers.parseUnits(priceText, 18);
  if (priceScaled <= 0n) throw new Error("Limit price must be greater than zero.");

  const buying = currentSide === "buy";
  const tokenIn = buying ? quote : base;
  const tokenOut = buying ? base : quote;
  const amountIn = ethers.parseUnits(amountText, tokenIn.decimals);

  if (amountIn <= 0n) throw new Error("Amount must be greater than zero.");

  let minAmountOut;

  if (buying) {
    const numerator =
      amountIn *
      (10n ** BigInt(base.decimals)) *
      (10n ** 18n);

    const denominator =
      (10n ** BigInt(quote.decimals)) *
      priceScaled;

    minAmountOut = ceilDiv(numerator, denominator);
  } else {
    const numerator =
      amountIn *
      priceScaled *
      (10n ** BigInt(quote.decimals));

    const denominator =
      (10n ** BigInt(base.decimals)) *
      (10n ** 18n);

    minAmountOut = ceilDiv(numerator, denominator);
  }

  if (minAmountOut <= 0n) {
    throw new Error("Calculated minimum output is zero.");
  }

  return {
    base,
    quote,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    pairAddress,
    priceScaled,
    buying
  };
}

function updateOrderPreview() {
  const baseSymbol = $("baseToken").value;
  const quoteSymbol = $("quoteToken").value;

  $("amountLabel").textContent = currentSide === "buy"
    ? `Amount to spend (${quoteSymbol})`
    : `Amount to sell (${baseSymbol})`;

  $("priceLabel").textContent = `Limit price (${quoteSymbol} per ${baseSymbol})`;
  $("orderDirection").textContent = currentSide === "buy"
    ? `${quoteSymbol} → ${baseSymbol}`
    : `${baseSymbol} → ${quoteSymbol}`;

  try {
    const preview = getOrderPreview();
    const minimum = ethers.formatUnits(
      preview.minAmountOut,
      preview.tokenOut.decimals
    );

    $("minimumOutput").textContent =
      `${numberFormat(Number(minimum), 8)} ${preview.tokenOut.symbol}`;

    $("executionCondition").textContent = currentSide === "buy"
      ? `Buy only at or below ${$("limitPrice").value} ${quoteSymbol}`
      : `Sell only at or above ${$("limitPrice").value} ${quoteSymbol}`;

    $("placeOrderBtn").disabled = !orderBookAddress;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Place Limit Order"
      : "Preview Only · Order Book Not Deployed";
  } catch (error) {
    $("minimumOutput").textContent = "—";
    $("executionCondition").textContent = error.message;
    $("placeOrderBtn").disabled = true;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Enter Valid Order Details"
      : "Preview Only · Order Book Not Deployed";
  }
}

async function loadOrderBookDeployment() {
  try {
    const response = await fetch(`${ORDERBOOK_URL}?ts=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      orderBookAddress = null;
      orderBookConfig = null;
      setOrderStatus(
        "Order Book contract has not been deployed/configured. You can preview limit orders, but placing orders is disabled.",
        "warn"
      );
      updateOrderPreview();
      return;
    }

    const data = await response.json();
    const address = data.address || data.orderBook || data.limitOrderBook;

    if (!address || !ethers.isAddress(address)) {
      throw new Error("The Order Book deployment file has no valid contract address.");
    }

    if (data.chainId && Number(data.chainId) !== CHAIN_ID) {
      throw new Error("Order Book deployment is for a different chain.");
    }

    const code = await rpc.getCode(address);
    if (code === "0x") throw new Error("No contract bytecode found at the configured Order Book address.");

    orderBookAddress = address;
    orderBookConfig = data;

    setOrderStatus(
      `Order Book connected: ${compactAddress(address)}. Orders are escrowed on QMS Testnet.`,
      "success"
    );

    updateOrderPreview();
  } catch (error) {
    orderBookAddress = null;
    orderBookConfig = null;
    setOrderStatus(error.message || "Order Book configuration unavailable.", "warn");
    updateOrderPreview();
  }
}

async function ensureAllowance(tokenMeta, amount) {
  const contract = new ethers.Contract(tokenMeta.address, ERC20_ABI, walletSigner);
  const allowance = await contract.allowance(walletAccount, orderBookAddress);

  if (allowance >= amount) return;

  if (allowance > 0n) {
    const resetTx = await contract.approve(orderBookAddress, 0n);
    setOrderStatus("Waiting for previous token allowance reset...", "warn");
    await resetTx.wait();
  }

  const approveTx = await contract.approve(orderBookAddress, amount);
  setOrderStatus("Approve transaction submitted. Confirm the wallet transaction...", "warn");
  await approveTx.wait();
}

async function placeLimitOrder() {
  if (!orderBookAddress) {
    throw new Error("Order Book has not been deployed.");
  }

  await ensureSharedWallet();

  const preview = getOrderPreview();
  const routerPair = await routerRead.getPair(
    preview.tokenIn.address,
    preview.tokenOut.address
  );

  if (routerPair === ethers.ZeroAddress) {
    throw new Error("QMSwap pool does not exist for this pair. Trading is unavailable.");
  }

  const book = new ethers.Contract(
    orderBookAddress,
    ORDERBOOK_ABI,
    walletSigner
  );

  const expirySeconds = Number($("orderExpiry").value);
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;

  $("placeOrderBtn").disabled = true;

  try {
    if (preview.tokenIn.address.toLowerCase() !==
        String(appConfig.wqms).toLowerCase()) {
      await ensureAllowance(preview.tokenIn, preview.amountIn);
    }

    const options = preview.tokenIn.address.toLowerCase() ===
      String(appConfig.wqms).toLowerCase()
        ? { value: preview.amountIn }
        : { value: 0n };

    setOrderStatus("Submitting limit order. Confirm the transaction in your wallet...", "warn");

    const tx = await book.createLimitOrder(
      preview.tokenIn.address,
      preview.tokenOut.address,
      preview.amountIn,
      preview.minAmountOut,
      walletAccount,
      expiry,
      options
    );

    setOrderStatus(`Order transaction submitted: ${compactAddress(tx.hash)}`, "warn");
    await tx.wait();

    setOrderStatus("Limit order created and escrowed successfully.", "success");
    $("orderAmount").value = "";

    await loadMyOrders();
    await refreshMarket();
  } finally {
    updateOrderPreview();
  }
}

function orderStatusLabel(status) {
  return ({
    0:"Unknown",
    1:"Open",
    2:"Completed",
    3:"Cancelled",
    4:"Expired"
  })[status] || "Unknown";
}

function formatRawTokenRatio(
  numeratorRaw,
  numeratorMeta,
  denominatorRaw,
  denominatorMeta,
  precision = 10
) {
  const numerator = BigInt(numeratorRaw);
  const denominator = BigInt(denominatorRaw);

  if (
    numerator <= 0n ||
    denominator <= 0n ||
    !numeratorMeta ||
    !denominatorMeta
  ) {
    return "—";
  }

  const numeratorScale =
    10n ** BigInt(numeratorMeta.decimals);

  const denominatorScale =
    10n ** BigInt(denominatorMeta.decimals);

  const displayScale = 10n ** BigInt(precision);

  // (numerator / 10^numeratorDecimals)
  // -----------------------------------
  // (denominator / 10^denominatorDecimals)
  const scaled =
    (
      numerator *
      denominatorScale *
      displayScale
    ) /
    (
      denominator *
      numeratorScale
    );

  const whole = scaled / displayScale;

  const fraction = (scaled % displayScale)
    .toString()
    .padStart(precision, "0")
    .replace(/0+$/, "");

  const wholeText = whole.toLocaleString("en-US");

  return fraction
    ? `${wholeText}.${fraction}`
    : wholeText;
}

function formatOrderEntry(
  order,
  tokenInMeta,
  tokenOutMeta,
  tokenInSymbol,
  tokenOutSymbol
) {
  if (!tokenInMeta || !tokenOutMeta) return "—";

  const stableQuotes = new Set(["USDT", "USDC"]);

  // Buy: quote token is spent, base token is received.
  if (
    stableQuotes.has(tokenInSymbol) &&
    !stableQuotes.has(tokenOutSymbol)
  ) {
    const price = formatRawTokenRatio(
      order.amountIn,
      tokenInMeta,
      order.minAmountOut,
      tokenOutMeta
    );

    return `${price} ${tokenInSymbol} / ${tokenOutSymbol}`;
  }

  // Sell: base token is sold, quote token is received.
  if (
    stableQuotes.has(tokenOutSymbol) &&
    !stableQuotes.has(tokenInSymbol)
  ) {
    const price = formatRawTokenRatio(
      order.minAmountOut,
      tokenOutMeta,
      order.amountIn,
      tokenInMeta
    );

    return `${price} ${tokenOutSymbol} / ${tokenInSymbol}`;
  }

  // Other pairs: show the normalized output per input rate.
  const rate = formatRawTokenRatio(
    order.minAmountOut,
    tokenOutMeta,
    order.amountIn,
    tokenInMeta
  );

  return `${rate} ${tokenOutSymbol} / ${tokenInSymbol}`;
}

async function loadMyOrders() {
  const body = $("orderRows");

  if (!orderBookAddress) {
    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Order Book contract is not deployed or configured.
      </td></tr>
    `;
    return;
  }

  // Never load orders belonging to other wallets.
  if (!walletAccount) {
    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Connected QMSwap wallet not detected. Reopen Market after connecting your wallet.
      </td></tr>
    `;
    return;
  }

  body.innerHTML = `
    <tr><td colspan="6" class="empty">
      Loading your orders...
    </td></tr>
  `;

  try {
    const book = new ethers.Contract(orderBookAddress, ORDERBOOK_ABI, rpc);

    // owner is indexed in OrderCreated. RPC returns only this wallet's orders.
    const filter = book.filters.OrderCreated(null, walletAccount);
    const fromBlock = Number(orderBookConfig?.deploymentBlock || 0);

    const events = await book.queryFilter(filter, fromBlock, "latest");
    const latestEvents = events.slice(-100).reverse();

    const heading = $("ordersHeading");
    const description = $("ordersDescription");

    if (heading) heading.textContent = "My Orders";
    if (description) {
      description.textContent = "Orders created by your connected wallet.";
    }

    if (!latestEvents.length) {
      body.innerHTML = `
        <tr><td colspan="6" class="empty">
          You have no limit orders yet.
        </td></tr>
      `;
      return;
    }

    const rows = await Promise.all(latestEvents.map(async (event) => {
      const id = event.args.orderId;
      const order = await book.getOrder(id);

      const tokenInSymbol = symbolForAddress(order.tokenIn);
      const tokenOutSymbol = symbolForAddress(order.tokenOut);
      const tokenInMeta = token(tokenInSymbol);
      const tokenOutMeta = token(tokenOutSymbol);

      const entryText = formatOrderEntry(
        order,
        tokenInMeta,
        tokenOutMeta,
        tokenInSymbol,
        tokenOutSymbol
      );

      const status = Number(order.status);
      const expired = Math.floor(Date.now() / 1000) > Number(order.expiry);

      let action = `<span class="state state-off">${orderStatusLabel(status)}</span>`;

      if (status === 1 && expired) {
        action = `
          <button class="btn" data-order-action="expire"
            data-order-id="${id}">Refund</button>
        `;
      } else if (status === 1) {
        let executable = false;

        try {
          const quote = await routerRead.quoteOut(
            order.tokenIn,
            order.tokenOut,
            order.amountIn
          );
          executable = quote >= order.minAmountOut;
        } catch {
          executable = false;
        }

        action = `
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${executable
              ? `<button class="btn success"
                  data-order-action="execute"
                  data-order-id="${id}">Execute</button>`
              : '<span class="state state-warn">Waiting</span>'}
            <button class="btn danger"
              data-order-action="cancel"
              data-order-id="${id}">Cancel</button>
          </div>
        `;
      }

      return `
        <tr>
          <td><div class="asset-name">#${id.toString()}</div></td>
          <td>
            ${tokenInMeta ? amountFormat(order.amountIn, tokenInMeta.decimals) : "—"}
            ${esc(tokenInSymbol)}
          </td>
          <td>${esc(entryText)}</td>
          <td>
            ${tokenOutMeta ? amountFormat(order.minAmountOut, tokenOutMeta.decimals) : "—"}
            ${esc(tokenOutSymbol)}
          </td>
          <td>${new Date(Number(order.expiry) * 1000).toLocaleString()}</td>
          <td>${action}</td>
        </tr>
      `;
    }));

    body.innerHTML = rows.join("");
  } catch (error) {
    console.error("My Orders loading failed:", error);

    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Could not load your orders:
        ${esc(error?.shortMessage || error?.message || "RPC error")}
      </td></tr>
    `;
  }
}
async function handleOrderAction(action, id) {
  await ensureSharedWallet();
  if (!orderBookAddress) throw new Error("Order Book contract is unavailable.");

  const book = new ethers.Contract(
    orderBookAddress,
    ORDERBOOK_ABI,
    walletSigner
  );

  let tx;

  if (action === "execute") {
    tx = await book.executeOrder(id);
  } else if (action === "cancel") {
    tx = await book.cancelOrder(id);
  } else if (action === "expire") {
    tx = await book.expireOrder(id);
  } else {
    throw new Error("Unknown order action.");
  }

  setOrderStatus(`Transaction submitted: ${compactAddress(tx.hash)}`, "warn");
  await tx.wait();

  setOrderStatus("Order transaction confirmed.", "success");
  await loadMyOrders();
  await refreshMarket();
}

function bindLimitOrderUI() {
  populateLimitSelectors();

  $("baseToken").addEventListener("change", refreshQuoteOptions);
  $("quoteToken").addEventListener("change", updateOrderPreview);
  $("orderAmount").addEventListener("input", updateOrderPreview);
  $("limitPrice").addEventListener("input", updateOrderPreview);

  $("buyTab").addEventListener("click", () => {
    currentSide = "buy";
    $("buyTab").classList.add("active");
    $("sellTab").classList.remove("active");
    updateOrderPreview();
  });

  $("sellTab").addEventListener("click", () => {
    currentSide = "sell";
    $("sellTab").classList.add("active");
    $("buyTab").classList.remove("active");
    updateOrderPreview();
  });

  $("placeOrderBtn").addEventListener("click", async () => {
    try {
      await placeLimitOrder();
    } catch (error) {
      console.error(error);
      setOrderStatus(
        error?.shortMessage || error?.reason || error?.message || "Order failed.",
        "error"
      );
      updateOrderPreview();
    }
  });
$("refreshOrdersBtn").addEventListener("click", async () => {
    const button = $("refreshOrdersBtn");
    button.disabled = true;

    try {
      await loadMyOrders();
    } finally {
      button.disabled = false;
    }
  });

  $("orderRows").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-order-action]");
    if (!button) return;

    const action = button.dataset.orderAction;
    const id = BigInt(button.dataset.orderId);

    button.disabled = true;

    try {
      await handleOrderAction(action, id);
    } catch (error) {
      setOrderStatus(
        error?.shortMessage || error?.reason || error?.message || "Order action failed.",
        "error"
      );
      await loadMyOrders();
    }
  });
}

export async function onWalletChanged(nextAccount, nextSigner) {
  walletAccount = nextAccount || "";
  walletSigner = nextSigner || null;

  // Never query the Order Book without the main QMSwap connected account.
  await loadMyOrders();
}

export async function initMarket(context) {
  marketContext = context;

  walletAccount = context?.getAccount?.() || "";
  walletSigner = context?.getSigner?.() || null;

  await loadDeployment();

  selectedChartToken = tokenMap.BTC
    ? "BTC"
    : (Object.keys(tokenMap)[0] || "");

  tokenPricePage = 0;

  bindLimitOrderUI();
  await loadOrderBookDeployment();

  document.querySelectorAll("[data-quote]").forEach((button) => {
    button.addEventListener("click", () => selectQuote(button.dataset.quote));
  });

  $("tokenRows").addEventListener("click", async (event) => {
    const row = event.target.closest?.("[data-token-symbol]");
    if (!row) return;

    const symbol = row.dataset.tokenSymbol;
    if (!symbol || !token(symbol)) return;

    selectedChartToken = symbol;

    renderTokenRows(currentPrices, lastPriceChanges);

    await loadSelectedTokenChart();
  });

  $("tokenPagination").addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-page-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.pageAction;

    if (action === "previous") {
      tokenPricePage = Math.max(0, tokenPricePage - 1);
    } else if (action === "next") {
      tokenPricePage += 1;
    }

    renderTokenRows(currentPrices, lastPriceChanges);
  });

  if (!chartResizeBound) {
    window.addEventListener("resize", drawTokenPriceChart);
    chartResizeBound = true;
  }

  $("refreshBtn").addEventListener("click", refreshMarket);

  // Read only orders belonging to the wallet already connected by QMSwap.
  await loadMyOrders();
  await refreshMarket();

  // Periodic market-data refresh only. Orders remain wallet-filtered.
  setInterval(refreshMarket, 60000);
}