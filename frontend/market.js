import { ethers } from "ethers";

const RPC_URL = "https://rpc.testnet.qms.finance";
const CHAIN_ID = 19480;
const EXPLORER = "https://testnet.qmsscan.io";

const ORDERBOOK_V2_URL = "/deployments/qmswap-limit-order-v2.json";
const ORDERBOOK_V3_URL = "/deployments/qmswap-limit-order-v3.json";

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
  "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"
];

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)"
];

const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function WQMS() view returns (address)",
  "function getAmountsOut(uint256,address[]) view returns (uint256[])"
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

const V2_ORDERBOOK_ABI = [
  "function router() view returns (address)",
  "function executeOrder(uint256) returns (uint256)",
  "function cancelOrder(uint256)",
  "function expireOrder(uint256)",
  "function getOrder(uint256) view returns (tuple(uint256 id,address owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry,uint8 status))",
  "event OrderCreated(uint256 indexed orderId,address indexed owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry)"
];

const V3_ORDERBOOK_ABI = [
  "function router() view returns (address)",
  "function createLimitOrder(address[],uint256,uint256,address,uint256) payable returns (uint256)",
  "function executeOrder(uint256) returns (uint256)",
  "function cancelOrder(uint256)",
  "function expireOrder(uint256)",
  "function getOrder(uint256) view returns (tuple(uint256 id,address owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry,address[] path,uint8 status))",
  "event OrderCreated(uint256 indexed orderId,address indexed owner,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 expiry)"
];

const LEGACY_ROUTER_ABI = [
  "function quoteOut(address,address,uint256) view returns (uint256)"
];

const PAIR_INTERFACE = new ethers.Interface(PAIR_ABI);
const SWAP_TOPIC = PAIR_INTERFACE.getEvent("Swap").topicHash;

const rpc = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const $ = (id) => document.getElementById(id);


let tokenMap = {};
let addressToSymbol = new Map();

let pairConfig = [];
let pairSnapshots = [];

let routerRead = null;
let factoryRead = null;
let qwapConfig = null;

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

let legacyOrderBookAddress = null;
let legacyOrderBookConfig = null;
let legacyRouterRead = null;

let walletProvider = null;
let walletSigner = null;
let walletAccount = null;
let marketContext = null;

let marketRefreshTimer = null;
let previewRequestId = 0;

const orderTokenMetaCache = new Map();

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

async function loadQwapMarketConfig() {
  const config = marketContext?.getQwapConfig?.();
  const assets = marketContext?.getAssets?.();

  if (!config || !Array.isArray(assets)) {
    throw new Error("Market did not receive the QWAP asset registry from Swap.");
  }

  const routerAddress = config.routerAddress;
  const factoryAddress = config.factoryAddress;
  const wrappedNativeAddress = config.wrappedNativeAddress;

  if (
    !ethers.isAddress(routerAddress) ||
    !ethers.isAddress(factoryAddress) ||
    !ethers.isAddress(wrappedNativeAddress)
  ) {
    throw new Error("Invalid QWAP Router, Factory or WQMS configuration.");
  }

  const network = await rpc.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`Unexpected RPC chain ID: ${network.chainId}`);
  }

  qwapConfig = {
    routerAddress: ethers.getAddress(routerAddress),
    factoryAddress: ethers.getAddress(factoryAddress),
    wrappedNativeAddress: ethers.getAddress(wrappedNativeAddress)
  };

  routerRead = new ethers.Contract(
    qwapConfig.routerAddress,
    ROUTER_ABI,
    rpc
  );

  factoryRead = new ethers.Contract(
    qwapConfig.factoryAddress,
    FACTORY_ABI,
    rpc
  );

  const [actualFactory, actualWqms] = await Promise.all([
    routerRead.factory(),
    routerRead.WQMS()
  ]);

  if (
    actualFactory.toLowerCase() !==
    qwapConfig.factoryAddress.toLowerCase()
  ) {
    throw new Error("QWAP Router and Factory addresses do not match.");
  }

  if (
    actualWqms.toLowerCase() !==
    qwapConfig.wrappedNativeAddress.toLowerCase()
  ) {
    throw new Error("QWAP Router WQMS address does not match Swap configuration.");
  }

  tokenMap = {};
  addressToSymbol = new Map();

  const seenAddresses = new Set();

  for (const item of assets) {
    if (!item?.address || !ethers.isAddress(item.address)) continue;

    const address = ethers.getAddress(item.address);
    const lower = address.toLowerCase();

    if (seenAddresses.has(lower)) continue;
    seenAddresses.add(lower);

    let symbol = String(item.symbol || item.key || "").trim().toUpperCase();
    if (!symbol) continue;

    const decimals = Number(item.decimals ?? 18);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new Error(`Invalid decimals for ${symbol}.`);
    }

    if (tokenMap[symbol] && tokenMap[symbol].address.toLowerCase() !== lower) {
      symbol = `${symbol}_${address.slice(2, 6).toUpperCase()}`;
    }

    const native =
      Boolean(item.native) ||
      symbol === "QMS" ||
      lower === qwapConfig.wrappedNativeAddress.toLowerCase();

    tokenMap[symbol] = {
      symbol,
      address,
      decimals,
      native,
      displayName: item.displayName || symbol,
      source: item.source || "QWAP"
    };

    addressToSymbol.set(lower, symbol);
  }

  // QMS is the native UI alias for QWAP's WQMS token.
  if (!tokenMap.QMS) {
    tokenMap.QMS = {
      symbol: "QMS",
      address: qwapConfig.wrappedNativeAddress,
      decimals: 18,
      native: true,
      displayName: "QMS",
      source: "QWAP"
    };
    addressToSymbol.set(
      qwapConfig.wrappedNativeAddress.toLowerCase(),
      "QMS"
    );
  } else {
    tokenMap.QMS.address = qwapConfig.wrappedNativeAddress;
    tokenMap.QMS.native = true;
    addressToSymbol.set(
      qwapConfig.wrappedNativeAddress.toLowerCase(),
      "QMS"
    );
  }

  if (!tokenMap.USDT || !tokenMap.USDC) {
    throw new Error("Swap registry must contain both QWAP USDT and USDC.");
  }

  if (!tokenMap[selectedQuote]) {
    selectedQuote = "USDT";
  }

  console.log("QWAP Market asset registry loaded:", Object.keys(tokenMap));
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;

        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          results[index] = {
            error: error?.shortMessage || error?.message || "Request failed"
          };
        }
      }
    }
  );

  await Promise.all(workers);
  return results;
}

async function discoverQwapPools() {
  const assets = Object.values(tokenMap);
  const combinations = [];

  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      if (
        assets[i].address.toLowerCase() ===
        assets[j].address.toLowerCase()
      ) {
        continue;
      }

      combinations.push({
        tokenA: assets[i],
        tokenB: assets[j]
      });
    }
  }

  const discovered = await mapLimit(combinations, 12, async (item) => {
    const address = await factoryRead.getPair(
      item.tokenA.address,
      item.tokenB.address
    );

    if (!address || address === ethers.ZeroAddress) return null;

    return {
      key: `${item.tokenA.symbol}/${item.tokenB.symbol}`,
      address: ethers.getAddress(address)
    };
  });

  const unique = new Map();

  for (const item of discovered) {
    if (!item || item.error) continue;
    unique.set(item.address.toLowerCase(), item);
  }

  pairConfig = [...unique.values()];

  console.log(
    `QWAP Market discovered ${pairConfig.length} configured-token pools.`
  );
}

function buildCandidatePaths(
  tokenInAddress,
  tokenOutAddress,
  snapshots = pairSnapshots,
  maxPathLength = 5,
  maxPaths = 128
) {
  const source = String(tokenInAddress).toLowerCase();
  const target = String(tokenOutAddress).toLowerCase();

  if (!source || !target || source === target) return [];

  const graph = new Map();
  const addressByLower = new Map();

  function addEdge(from, to) {
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    if (!graph.has(fromLower)) graph.set(fromLower, []);
    graph.get(fromLower).push(to);

    addressByLower.set(fromLower, from);
    addressByLower.set(toLower, to);
  }

  for (const snapshot of snapshots) {
    if (
      snapshot.error ||
      snapshot.reserve0 <= 0n ||
      snapshot.reserve1 <= 0n
    ) {
      continue;
    }

    addEdge(snapshot.token0, snapshot.token1);
    addEdge(snapshot.token1, snapshot.token0);
  }

  const paths = [];

  function walk(current, path, visited) {
    if (paths.length >= maxPaths) return;
    if (path.length >= maxPathLength) return;

    const neighbors = graph.get(current.toLowerCase()) || [];

    for (const next of neighbors) {
      const nextLower = next.toLowerCase();
      if (visited.has(nextLower)) continue;

      const nextPath = [...path, next];

      if (nextLower === target) {
        paths.push(nextPath);
        if (paths.length >= maxPaths) return;
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(nextLower);
      walk(next, nextPath, nextVisited);

      if (paths.length >= maxPaths) return;
    }
  }

  const start = addressByLower.get(source) || ethers.getAddress(tokenInAddress);
  const destination = addressByLower.get(target) || ethers.getAddress(tokenOutAddress);

  walk(start, [start], new Set([source]));

  return paths
    .filter(path =>
      path[path.length - 1].toLowerCase() === destination.toLowerCase()
    )
    .sort((a, b) => a.length - b.length);
}

async function findBestQwapRoute(
  tokenInAddress,
  tokenOutAddress,
  amountIn,
  snapshots = pairSnapshots,
  blockTag = null
) {
  if (!routerRead || amountIn <= 0n) return null;

  const paths = buildCandidatePaths(
    tokenInAddress,
    tokenOutAddress,
    snapshots,
    5,
    128
  );

  if (!paths.length) return null;

  const quotes = await mapLimit(paths, 4, async (path) => {
    const amounts = blockTag === null
      ? await routerRead.getAmountsOut(amountIn, path)
      : await routerRead.getAmountsOut(
          amountIn,
          path,
          { blockTag }
        );

    if (!amounts || amounts.length !== path.length) return null;

    const amountOut = amounts[amounts.length - 1];
    if (amountOut <= 0n) return null;

    return { path, amountOut };
  });

  const valid = quotes
    .filter(item => item && !item.error)
    .sort((a, b) =>
      a.amountOut === b.amountOut
        ? a.path.length - b.path.length
        : a.amountOut > b.amountOut ? -1 : 1
    );

  return valid[0] || null;
}

async function resolveOrderTokenMeta(address) {
  const lower = String(address).toLowerCase();

  const cached = orderTokenMetaCache.get(lower);
  if (cached) return cached;

  const knownSymbol = addressToSymbol.get(lower);
  if (knownSymbol && tokenMap[knownSymbol]) {
    return tokenMap[knownSymbol];
  }

  try {
    const contract = new ethers.Contract(address, ERC20_ABI, rpc);
    const [rawSymbol, rawDecimals] = await Promise.all([
      contract.symbol(),
      contract.decimals()
    ]);

    let symbol = String(rawSymbol || "Unknown").trim().toUpperCase();
    const decimals = Number(rawDecimals);

    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new Error("Invalid token decimals.");
    }

    if (tokenMap[symbol] &&
        tokenMap[symbol].address.toLowerCase() !== lower) {
      symbol = `${symbol}_${String(address).slice(2, 6).toUpperCase()}`;
    }

    const meta = {
      symbol,
      address: ethers.getAddress(address),
      decimals,
      native: false,
      displayName: symbol,
      source: "On-chain legacy order"
    };

    addressToSymbol.set(lower, symbol);
    orderTokenMetaCache.set(lower, meta);
    return meta;
  } catch {
    const meta = {
      symbol: `Unknown_${String(address).slice(2, 6).toUpperCase()}`,
      address,
      decimals: 18,
      native: false,
      displayName: "Unknown"
    };

    orderTokenMetaCache.set(lower, meta);
    return meta;
  }
}

async function readCurrentPools() {
  return mapLimit(pairConfig, 16, async (item) => {
    const contract = new ethers.Contract(item.address, PAIR_ABI, rpc);

    try {
      const [token0, token1, reserves, totalSupply] = await Promise.all([
        contract.token0(),
        contract.token1(),
        contract.getReserves(),
        contract.totalSupply()
      ]);

      return {
        ...item,
        token0: ethers.getAddress(token0),
        token1: ethers.getAddress(token1),
        reserve0: BigInt(reserves[0]),
        reserve1: BigInt(reserves[1]),
        totalSupply: BigInt(totalSupply),
        error: null
      };
    } catch (error) {
      return {
        ...item,
        token0: ethers.ZeroAddress,
        token1: ethers.ZeroAddress,
        reserve0: 0n,
        reserve1: 0n,
        totalSupply: 0n,
        error: error?.shortMessage || error?.message || "QWAP pool read failed"
      };
    }
  });
}

function reserveFor(snapshot, address) {
  const target = address.toLowerCase();
  if (snapshot.token0.toLowerCase() === target) return snapshot.reserve0;
  if (snapshot.token1.toLowerCase() === target) return snapshot.reserve1;
  return null;
}

async function priceFromSnapshots(
  assetSymbol,
  quoteSymbol,
  snapshots,
  blockTag = null
) {
  if (assetSymbol === quoteSymbol) return 1;

  const asset = token(assetSymbol);
  const quote = token(quoteSymbol);

  if (!asset || !quote) return null;

  try {
    const amountIn = 10n ** BigInt(asset.decimals);

    const route = await findBestQwapRoute(
      asset.address,
      quote.address,
      amountIn,
      snapshots,
      blockTag
    );

    if (!route) return null;

    const value = Number(
      ethers.formatUnits(route.amountOut, quote.decimals)
    );

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function buildPriceMap(snapshots, blockTag = null) {
  const result = {};

  const values = await mapLimit(
    Object.keys(tokenMap),
    3,
    async (symbol) => ({
      symbol,
      price: await priceFromSnapshots(
        symbol,
        selectedQuote,
        snapshots,
        blockTag
      )
    })
  );

  for (const item of values) {
    if (!item || item.error) continue;
    result[item.symbol] = item.price;
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
  return mapLimit(pairSnapshots, 12, async (snapshot) => {
    const contract = new ethers.Contract(snapshot.address, PAIR_ABI, rpc);

    try {
      const reserves = await contract.getReserves({
        blockTag: blockNumber
      });

      return {
        ...snapshot,
        reserve0: BigInt(reserves[0]),
        reserve1: BigInt(reserves[1]),
        error: null
      };
    } catch (error) {
      return {
        ...snapshot,
        reserve0: 0n,
        reserve1: 0n,
        error: error?.shortMessage || error?.message || "Historical reserve read failed"
      };
    }
  });
}

async function readTokenPriceHistory(
  tokenSymbol,
  quoteSymbol,
  startBlock,
  latestBlock
) {
  const asset = token(tokenSymbol);
  const quote = token(quoteSymbol);

  if (!asset || !quote || tokenSymbol === quoteSymbol) return [];

  const assetAddress = asset.address.toLowerCase();
  const quoteAddress = quote.address.toLowerCase();

  const snapshot = pairSnapshots.find((item) => {
    const a = item.token0.toLowerCase();
    const b = item.token1.toLowerCase();

    return (
      (a === assetAddress && b === quoteAddress) ||
      (a === quoteAddress && b === assetAddress)
    );
  });

  // Multihop-priced assets can still have a current/historical reserve
  // snapshot, but no direct pair event stream against the selected quote.
  if (!snapshot || snapshot.error) return [];

  const logs = await rpc.getLogs({
    address: snapshot.address,
    topics: [SWAP_TOPIC],
    fromBlock: startBlock,
    toBlock: latestBlock
  });

  const rawPoints = [];

  for (const log of logs) {
    try {
      const parsed = PAIR_INTERFACE.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (!parsed) continue;

      const amount0In = BigInt(parsed.args.amount0In);
      const amount1In = BigInt(parsed.args.amount1In);
      const amount0Out = BigInt(parsed.args.amount0Out);
      const amount1Out = BigInt(parsed.args.amount1Out);

      let assetRaw = 0n;
      let quoteRaw = 0n;

      const assetIs0 =
        snapshot.token0.toLowerCase() === assetAddress;

      if (assetIs0) {
        if (amount0In > 0n) {
          assetRaw = amount0In;
          quoteRaw = amount1Out;
        } else if (amount1In > 0n) {
          assetRaw = amount0Out;
          quoteRaw = amount1In;
        }
      } else {
        if (amount1In > 0n) {
          assetRaw = amount1In;
          quoteRaw = amount0Out;
        } else if (amount0In > 0n) {
          assetRaw = amount1Out;
          quoteRaw = amount0In;
        }
      }

      if (assetRaw <= 0n || quoteRaw <= 0n) continue;

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
        blockNumber: Number(log.blockNumber),
        logIndex: log.index ?? log.logIndex ?? 0,
        price: quoteAmount / assetAmount
      });
    } catch (error) {
      console.warn("Could not parse QWAP Swap event:", error);
    }
  }

  if (!rawPoints.length) return [];

  const blockNumbers = [
    ...new Set(rawPoints.map(point => point.blockNumber))
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
    .map(point => ({
      timestamp: timestamps.get(point.blockNumber),
      price: point.price,
      logIndex: point.logIndex
    }))
    .filter(point =>
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
    message || "Price history from on-chain swaps.";

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

  const activeSnapshots = pairSnapshots.filter(snapshot =>
    !snapshot.error &&
    snapshot.reserve0 > 0n &&
    snapshot.reserve1 > 0n
  );

  // Avoid hitting the RPC with thousands of independent getLogs calls.
  // The UI explicitly marks the result partial when this safety cap applies.
  const MAX_VOLUME_POOLS = 250;
  const selectedSnapshots = activeSnapshots.slice(0, MAX_VOLUME_POOLS);

  if (activeSnapshots.length > selectedSnapshots.length) {
    complete = false;
  }

  const results = await mapLimit(
    selectedSnapshots,
    5,
    async (snapshot) => {
      const logs = await rpc.getLogs({
        address: snapshot.address,
        topics: [SWAP_TOPIC],
        fromBlock: startBlock,
        toBlock: latestBlock
      });

      return { snapshot, logs };
    }
  );

  for (const result of results) {
    if (!result || result.error) {
      complete = false;
      continue;
    }

    const { snapshot, logs } = result;
    const poolKey = snapshot.address.toLowerCase();

    successfulPools++;
    let poolVolume = 0;

    for (const log of logs) {
      try {
        const parsed = PAIR_INTERFACE.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (!parsed) continue;

        const amount0In = BigInt(parsed.args.amount0In);
        const amount1In = BigInt(parsed.args.amount1In);
        const amount0Out = BigInt(parsed.args.amount0Out);
        const amount1Out = BigInt(parsed.args.amount1Out);

        let tokenInAddress;
        let tokenOutAddress;
        let amountIn;
        let amountOut;

        if (amount0In > 0n) {
          tokenInAddress = snapshot.token0;
          tokenOutAddress = snapshot.token1;
          amountIn = amount0In;
          amountOut = amount1Out;
        } else if (amount1In > 0n) {
          tokenInAddress = snapshot.token1;
          tokenOutAddress = snapshot.token0;
          amountIn = amount1In;
          amountOut = amount0Out;
        } else {
          continue;
        }

        const tokenInSymbol = symbolForAddress(tokenInAddress);
        const tokenOutSymbol = symbolForAddress(tokenOutAddress);

        const tokenInMeta = token(tokenInSymbol);
        const tokenOutMeta = token(tokenOutSymbol);

        if (
          tokenInMeta &&
          prices[tokenInSymbol] !== null &&
          prices[tokenInSymbol] !== undefined
        ) {
          const inputAmount = Number(
            ethers.formatUnits(amountIn, tokenInMeta.decimals)
          );

          const volume = inputAmount * prices[tokenInSymbol];

          if (Number.isFinite(volume)) {
            poolVolume += volume;
          }
        }

        recent.push({
          blockNumber: Number(log.blockNumber),
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
        console.warn("Could not parse a QWAP Swap event:", error);
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
    setStatus("Updating market data...");

    const [network, latestBlock] = await Promise.all([
      rpc.getNetwork(),
      rpc.getBlockNumber()
    ]);

    if (Number(network.chainId) !== CHAIN_ID) {
      throw new Error(
        `RPC returned chain ${network.chainId}, expected ${CHAIN_ID}.`
      );
    }

    pairSnapshots = await readCurrentPools();
    currentPrices = await buildPriceMap(pairSnapshots);

    let historicalPrices = null;
    let eventData = null;
    let historicalMessage = "24H historical price unavailable";

    try {
      const latest = await rpc.getBlock(latestBlock);
      if (!latest) throw new Error("Cannot read latest block timestamp.");

      const targetTimestamp = Number(latest.timestamp) - 86400;
      const startBlock = await findBlockAtTimestamp(
        targetTimestamp,
        latestBlock
      );

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
          historicalPrices = await buildPriceMap(
            results[0].value,
            startBlock
          );

          historicalMessage =
            `Historical price snapshot: block ${startBlock.toLocaleString("en-US")}`;
        } else {
          historicalMessage = "Historical QWAP reserves unavailable from this RPC";
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
      console.warn("QWAP 24-hour data unavailable:", error);

      eventData = null;
      historicalPrices = null;
      marketHistoryWindow = null;
      historicalMessage = "24H QWAP historical data unavailable";
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

    $("updatedAt").textContent =
      `Updated ${new Date().toLocaleTimeString()}`;

    const failedPools = pairSnapshots.filter(p => p.error).length;
    const activePools = pairSnapshots.filter(p =>
      !p.error && p.reserve0 > 0n && p.reserve1 > 0n
    ).length;

    const notes = [];

    if (failedPools) notes.push(`${failedPools} pool reads failed`);
    if (!eventData) notes.push("24H event data unavailable");
    else if (!eventData.complete) {
      notes.push(
        `24H volume is partial (${eventData.successfulPools} pools queried)`
      );
    }
    if (!historicalPrices) notes.push("24H price change unavailable");

    if (notes.length) {
      setStatus(
        `Market data updated at block ${latestBlock}. ${activePools} active pools. ${notes.join("; ")}.`,
        "warn"
      );
    } else {
      setStatus(
        `Market data updated at block ${latestBlock}: ${activePools} active pools, prices, liquidity and 24H data.`,
        "success"
      );
    }

    updateOrderPreview();
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
  const input = token(tokenIn);
  const output = token(tokenOut);
  if (!input || !output) return null;

  const paths = buildCandidatePaths(
    input.address,
    output.address,
    pairSnapshots,
    5,
    1
  );

  return paths.length ? paths[0] : null;
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

async function getOrderPreview() {
  const baseSymbol = $("baseToken").value;
  const quoteSymbol = $("quoteToken").value;

  const base = token(baseSymbol);
  const quote = token(quoteSymbol);

  if (!base || !quote || baseSymbol === quoteSymbol) {
    throw new Error("Select two different tokens.");
  }

  const amountText = $("orderAmount").value.trim();
  const priceText = $("limitPrice").value.trim();

  if (!amountText || !priceText) {
    throw new Error("Enter an amount and limit price.");
  }

  const priceScaled = ethers.parseUnits(priceText, 18);
  if (priceScaled <= 0n) {
    throw new Error("Limit price must be greater than zero.");
  }

  const buying = currentSide === "buy";
  const tokenIn = buying ? quote : base;
  const tokenOut = buying ? base : quote;

  const amountIn = ethers.parseUnits(
    amountText,
    tokenIn.decimals
  );

  if (amountIn <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

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

  const route = await findBestQwapRoute(
    tokenIn.address,
    tokenOut.address,
    amountIn
  );

  if (!route || !route.path?.length) {
    throw new Error(
      "No active QWAP route exists for this token pair. No pool will be created."
    );
  }

  return {
    base,
    quote,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    path: route.path,
    routeQuote: route.amountOut,
    priceScaled,
    buying
  };
}

async function updateOrderPreview() {
  const sequence = ++previewRequestId;

  const baseSymbol = $("baseToken").value;
  const quoteSymbol = $("quoteToken").value;

  $("amountLabel").textContent = currentSide === "buy"
    ? `Amount to spend (${quoteSymbol})`
    : `Amount to sell (${baseSymbol})`;

  $("priceLabel").textContent =
    `Limit price (${quoteSymbol} per ${baseSymbol})`;

  $("orderDirection").textContent = currentSide === "buy"
    ? `${quoteSymbol}  ${baseSymbol}`
    : `${baseSymbol}  ${quoteSymbol}`;

  $("placeOrderBtn").disabled = true;

  try {
    const preview = await getOrderPreview();

    if (sequence !== previewRequestId) return;

    const minimum = ethers.formatUnits(
      preview.minAmountOut,
      preview.tokenOut.decimals
    );

    const currentQuote = ethers.formatUnits(
      preview.routeQuote,
      preview.tokenOut.decimals
    );

    const routeSymbols = preview.path.map(address =>
      symbolForAddress(address)
    );

    $("minimumOutput").textContent =
      `${numberFormat(Number(minimum), 8)} ${preview.tokenOut.symbol}`;

    $("executionCondition").textContent =
      `${currentSide === "buy" ? "Buy only at or below" : "Sell only at or above"} ` +
      `${$("limitPrice").value} ${quoteSymbol}. ` +
      `Route: ${routeSymbols.join("  ")}. ` +
      `Current quote: ${numberFormat(Number(currentQuote), 8)} ${preview.tokenOut.symbol}.`;

    $("placeOrderBtn").disabled = !orderBookAddress;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Place Limit Order"
      : "Preview Only  Limit Orders Unavailable";
  } catch (error) {
    if (sequence !== previewRequestId) return;

    $("minimumOutput").textContent = "";
    $("executionCondition").textContent = error.message;

    $("placeOrderBtn").disabled = true;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Enter Valid Order Details"
      : "Preview Only  Limit Orders Unavailable";
  }
}

async function loadOrderBookDeployment() {
  orderBookAddress = null;
  orderBookConfig = null;

  legacyOrderBookAddress = null;
  legacyOrderBookConfig = null;
  legacyRouterRead = null;

  // V2 remains read-only configured as a legacy book.
  try {
    const response = await fetch(
      `${ORDERBOOK_V2_URL}?ts=${Date.now()}`,
      { cache: "no-store" }
    );

    if (response.ok) {
      const data = await response.json();
      const address = data.address || data.orderBook || data.limitOrderBook;

      if (!address || !ethers.isAddress(address)) {
        throw new Error("V2 Order Book config has no valid address.");
      }

      if (data.chainId && Number(data.chainId) !== CHAIN_ID) {
        throw new Error("V2 Order Book belongs to another chain.");
      }

      if (await rpc.getCode(address) === "0x") {
        throw new Error("No V2 Order Book bytecode at configured address.");
      }

      const legacyBook = new ethers.Contract(
        address,
        V2_ORDERBOOK_ABI,
        rpc
      );

      const routerAddress = await legacyBook.router();

      if (
        !ethers.isAddress(routerAddress) ||
        await rpc.getCode(routerAddress) === "0x"
      ) {
        throw new Error("V2 Order Book Router is unavailable.");
      }

      legacyOrderBookAddress = ethers.getAddress(address);
      legacyOrderBookConfig = data;

      legacyRouterRead = new ethers.Contract(
        routerAddress,
        LEGACY_ROUTER_ABI,
        rpc
      );
    }
  } catch (error) {
    console.warn("Legacy V2 Order Book unavailable:", error);
    legacyOrderBookAddress = null;
    legacyOrderBookConfig = null;
    legacyRouterRead = null;
  }

  // New orders use only V3, whose immutable Router is QWAP.
  try {
    const response = await fetch(
      `${ORDERBOOK_V3_URL}?ts=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      setOrderStatus(
        "Limit Order service is not configured. Market data and previews remain available; new orders are disabled.",
        "warn"
      );

      updateOrderPreview();
      return;
    }

    const data = await response.json();
    const address = data.address || data.orderBook || data.limitOrderBook;

    if (!address || !ethers.isAddress(address)) {
      throw new Error("V3 Order Book config has no valid address.");
    }

    if (data.chainId && Number(data.chainId) !== CHAIN_ID) {
      throw new Error("V3 Order Book belongs to another chain.");
    }

    if (await rpc.getCode(address) === "0x") {
      throw new Error("No V3 Order Book bytecode at configured address.");
    }

    const book = new ethers.Contract(
      address,
      V3_ORDERBOOK_ABI,
      rpc
    );

    const deployedRouter = await book.router();

    if (
      deployedRouter.toLowerCase() !==
      qwapConfig.routerAddress.toLowerCase()
    ) {
      throw new Error("V3 Order Book is not connected to the configured QWAP Router.");
    }

    orderBookAddress = ethers.getAddress(address);
    orderBookConfig = data;

    setOrderStatus(
      `Limit Order service connected.`,
      "success"
    );
  } catch (error) {
    orderBookAddress = null;
    orderBookConfig = null;

    setOrderStatus(
      error?.shortMessage || error?.message || "V3 Order Book configuration unavailable.",
      "warn"
    );
  }

  updateOrderPreview();
}

async function ensureAllowance(tokenMeta, amount, spender) {
  const contract = new ethers.Contract(
    tokenMeta.address,
    ERC20_ABI,
    walletSigner
  );

  const allowance = await contract.allowance(
    walletAccount,
    spender
  );

  if (allowance >= amount) return;

  if (allowance > 0n) {
    const resetTx = await contract.approve(spender, 0n);

    setOrderStatus(
      "Waiting for previous token allowance reset...",
      "warn"
    );

    await resetTx.wait();
  }

  const approveTx = await contract.approve(spender, amount);

  setOrderStatus(
    "Approve transaction submitted. Confirm the wallet transaction...",
    "warn"
  );

  await approveTx.wait();
}

async function placeLimitOrder() {
  if (!orderBookAddress) {
    throw new Error("QWAP V3 Order Book has not been deployed/configured.");
  }

  await ensureSharedWallet();

  const preview = await getOrderPreview();

  // Recheck the selected route immediately before escrow.
  const liveAmounts = await routerRead.getAmountsOut(
    preview.amountIn,
    preview.path
  );

  if (
    !liveAmounts ||
    liveAmounts.length !== preview.path.length ||
    liveAmounts[liveAmounts.length - 1] <= 0n
  ) {
    throw new Error("The selected QWAP route is no longer available.");
  }

  const expirySeconds = Number($("orderExpiry").value);

  if (!Number.isFinite(expirySeconds) || expirySeconds <= 0) {
    throw new Error("Invalid order expiry.");
  }

  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;

  const book = new ethers.Contract(
    orderBookAddress,
    V3_ORDERBOOK_ABI,
    walletSigner
  );

  $("placeOrderBtn").disabled = true;

  try {
    const isNativeInput =
      preview.tokenIn.address.toLowerCase() ===
      qwapConfig.wrappedNativeAddress.toLowerCase();

    if (!isNativeInput) {
      await ensureAllowance(
        preview.tokenIn,
        preview.amountIn,
        orderBookAddress
      );
    }

    const options = isNativeInput
      ? { value: preview.amountIn }
      : { value: 0n };

    setOrderStatus(
      "Submitting Limit Order. Confirm the transaction in your wallet...",
      "warn"
    );

    const tx = await book.createLimitOrder(
      preview.path,
      preview.amountIn,
      preview.minAmountOut,
      walletAccount,
      expiry,
      options
    );

    setOrderStatus(
      `V3 orderTransaction submitted: ${compactAddress(tx.hash)}`,
      "warn"
    );

    await tx.wait();

    setOrderStatus(
      "Limit Order created. It will execute when the limit condition is met.",
      "success"
    );

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

  if (!walletAccount) {
    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Connected QMSwap wallet not detected.
      </td></tr>
    `;
    return;
  }

  body.innerHTML = `
    <tr><td colspan="6" class="empty">
      Loading your V2 and V3 orders...
    </td></tr>
  `;

  try {
    const sources = [];

    if (legacyOrderBookAddress) {
      sources.push({
        version: "v2",
        address: legacyOrderBookAddress,
        abi: V2_ORDERBOOK_ABI,
        config: legacyOrderBookConfig
      });
    }

    if (orderBookAddress) {
      sources.push({
        version: "v3",
        address: orderBookAddress,
        abi: V3_ORDERBOOK_ABI,
        config: orderBookConfig
      });
    }

    if (!sources.length) {
      body.innerHTML = `
        <tr><td colspan="6" class="empty">
          No configured Limit Order Book contracts.
        </td></tr>
      `;
      return;
    }

    const eventGroups = await Promise.all(
      sources.map(async (source) => {
        try {
          const book = new ethers.Contract(
            source.address,
            source.abi,
            rpc
          );

          const filter = book.filters.OrderCreated(
            null,
            walletAccount
          );

          const fromBlock = Number(
            source.config?.deploymentBlock || 0
          );

          const events = await book.queryFilter(
            filter,
            fromBlock,
            "latest"
          );

          return events.map(event => ({
            source,
            event
          }));
        } catch (error) {
          console.warn(
            `${source.version.toUpperCase()} order query failed:`,
            error
          );
          return [];
        }
      })
    );

    const records = eventGroups
      .flat()
      .sort((a, b) =>
        Number(b.event.blockNumber) - Number(a.event.blockNumber)
      )
      .slice(0, 100);

    const heading = $("ordersHeading");
    const description = $("ordersDescription");

    if (heading) heading.textContent = "My Orders";
    if (description) {
      description.textContent =
        "Orders created by your connected wallet.";
    }

    if (!records.length) {
      body.innerHTML = `
        <tr><td colspan="6" class="empty">
          You have no limit orders yet.
        </td></tr>
      `;
      return;
    }

    const rows = await Promise.all(records.map(async ({ source, event }) => {
      const id = event.args.orderId;
      const book = new ethers.Contract(
        source.address,
        source.abi,
        rpc
      );

      const order = await book.getOrder(id);

      const [tokenInMeta, tokenOutMeta] = await Promise.all([
        resolveOrderTokenMeta(order.tokenIn),
        resolveOrderTokenMeta(order.tokenOut)
      ]);

      const tokenInSymbol = tokenInMeta.symbol;
      const tokenOutSymbol = tokenOutMeta.symbol;

      const entryText = formatOrderEntry(
        order,
        tokenInMeta,
        tokenOutMeta,
        tokenInSymbol,
        tokenOutSymbol
      );

      const status = Number(order.status);
      const expired = Math.floor(Date.now() / 1000) > Number(order.expiry);

      let action = `
        <span class="state state-off">
          ${esc(orderStatusLabel(status))}
        </span>
      `;

      if (status === 1 && expired) {
        action = `
          <button class="btn"
            data-order-version="${source.version}"
            data-order-action="expire"
            data-order-id="${id}">
            Refund
          </button>
        `;
      } else if (status === 1) {
        let executable = false;

        try {
          if (source.version === "v2" && legacyRouterRead) {
            const quote = await legacyRouterRead.quoteOut(
              order.tokenIn,
              order.tokenOut,
              order.amountIn
            );

            executable = quote >= order.minAmountOut;
          } else if (source.version === "v3" && routerRead) {
            const path = Array.from(order.path || []);

            if (path.length >= 2) {
              const amounts = await routerRead.getAmountsOut(
                order.amountIn,
                path
              );

              executable =
                amounts[amounts.length - 1] >= order.minAmountOut;
            }
          }
        } catch {
          executable = false;
        }

        action = `
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${executable
              ? `<button class="btn success"
                  data-order-version="${source.version}"
                  data-order-action="execute"
                  data-order-id="${id}">
                  Execute
                </button>`
              : '<span class="state state-warn">Waiting</span>'}
            <button class="btn danger"
              data-order-version="${source.version}"
              data-order-action="cancel"
              data-order-id="${id}">
              Cancel
            </button>
          </div>
        `;
      }

      const routeText = source.version === "v3" && order.path
        ? Array.from(order.path)
            .map(address => symbolForAddress(address))
            .join("  ")
        : `${tokenInSymbol}  ${tokenOutSymbol}`;

      return `
        <tr>
          <td>
            <div class="asset-name">
              #${id.toString()}
            </div>
          </td>
          <td>
            ${amountFormat(order.amountIn, tokenInMeta.decimals)}
            ${esc(tokenInSymbol)}
            <div class="muted" style="font-size:10px">
              ${esc(routeText)}
            </div>
          </td>
          <td>${esc(entryText)}</td>
          <td>
            ${amountFormat(order.minAmountOut, tokenOutMeta.decimals)}
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

async function handleOrderAction(action, id, version = "v3") {
  await ensureSharedWallet();

  const isLegacy = version === "v2";
  const address = isLegacy
    ? legacyOrderBookAddress
    : orderBookAddress;

  const abi = isLegacy
    ? V2_ORDERBOOK_ABI
    : V3_ORDERBOOK_ABI;

  if (!address) {
    throw new Error(`${version.toUpperCase()} Order Book is unavailable.`);
  }

  const book = new ethers.Contract(
    address,
    abi,
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

  setOrderStatus(
    `${version.toUpperCase()}Transaction submitted: ${compactAddress(tx.hash)}`,
    "warn"
  );

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
      await handleOrderAction(action, id, button.dataset.orderVersion || "v3");
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

  await loadQwapMarketConfig();
  await discoverQwapPools();

  selectedChartToken = tokenMap.BTC
    ? "BTC"
    : (Object.keys(tokenMap)[0] || "");

  tokenPricePage = 0;
  marketHistoryWindow = null;

  bindLimitOrderUI();
  await loadOrderBookDeployment();

  document.querySelectorAll("[data-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      selectQuote(button.dataset.quote);
    });
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

  await loadMyOrders();
  await refreshMarket();

  if (marketRefreshTimer !== null) {
    clearInterval(marketRefreshTimer);
  }

  marketRefreshTimer = setInterval(refreshMarket, 60000);
}

