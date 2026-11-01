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
  "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)",
  "event Sync(uint112 reserve0,uint112 reserve1)"
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
const SYNC_TOPIC = PAIR_INTERFACE.getEvent("Sync").topicHash;

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
// The current spot price and its 24H chart share this exact QWAP route.
const marketPriceRoutes = new Map();
let lastPriceChanges = {};
let poolVolumes = {};

const TOKEN_PAGE_SIZE = 5;
let tokenPricePage = 0;
let selectedChartToken = "BTC";
let marketHistoryWindow = null;
let chartHistoryPoints = [];
let chartResizeBound = false;
let chartRequestId = 0;
let volumeRefreshing = false;
let lastVolumeRefreshAt = 0;

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

const CORE_MARKET_SYMBOLS = ["QMS", "BTC", "ETH", "USDT"];
const CORE_MARKET_SET = new Set(CORE_MARKET_SYMBOLS);

let corePairSnapshots = [];
let extraPairSnapshots = [];
let extraPoolsLoading = false;
let marketCoreLoaded = false;
let pendingPoolRefresh = false;
let historyRefreshing = false;
let lastHistoryRefreshAt = 0;
let historyLaunchTimer = null;
let pendingHistoryBlock = 0;
let volumeLaunchTimer = null;
let pendingVolumeWindow = null;
let lastExtraPoolRefreshAt = 0;
let lastMarketBlock = 0;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function setStatus(message, tone = "") {
  const el = $("marketStatus");
  if (!el) return;

  el.textContent = String(message ?? "").replace(/\bQWAP\s+Router\b/gi, "market router").replace(/\bQWAP\s+route\b/gi, "selected route").replace(/\bQWAP\b/gi, "QMSwap");
  el.dataset.tone = tone;

  // Hide routine success messages; keep loading, warnings and errors visible.
  el.hidden = tone === "success";
}

function setOrderStatus(message, tone = "") {
  $("orderStatus").textContent = String(message ?? "").replace(/\bQWAP\s+Router\b/gi, "market router").replace(/\bQWAP\s+route\b/gi, "selected route").replace(/\bQWAP\b/gi, "QMSwap");
  $("orderStatus").dataset.tone = tone;
}

function setWalletLabel() { /* Wallet connects on order actions. */ }

function enforceUsdtQuoteOnly() {
  selectedQuote = "USDT";

  // Remove the USDT/USDC switch from the Market page. Keep USDC token and
  // pool metadata available to legacy orders and background route discovery.
  document.querySelectorAll(".quote-switch, [data-quote]").forEach((element) => {
    element.remove();
  });

  const header = $("priceHeader");
  if (header) header.textContent = "Price (USDT)";
}

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
    throw new Error("Market data is not available from Swap.");
  }

  const routerAddress = config.routerAddress;
  const factoryAddress = config.factoryAddress;
  const wrappedNativeAddress = config.wrappedNativeAddress;

  if (
    !ethers.isAddress(routerAddress) ||
    !ethers.isAddress(factoryAddress) ||
    !ethers.isAddress(wrappedNativeAddress)
  ) {
    throw new Error("Invalid market configuration.");
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
    throw new Error("Market configuration does not match.");
  }

  if (
    actualWqms.toLowerCase() !==
    qwapConfig.wrappedNativeAddress.toLowerCase()
  ) {
    throw new Error("Market token configuration does not match Swap.");
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
      source: item.source || "QWAP",
      pools: Array.isArray(item.pools) ? item.pools : [],
      pairAddress: item.pairAddress || null,
      baseAddress: item.baseAddress || null
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

  if (!tokenMap.USDT) {
    throw new Error("Swap registry must contain QWAP USDT.");
  }

  if (!tokenMap[selectedQuote]) {
    selectedQuote = "USDT";
  }

  console.log("QMSwap Market asset registry loaded:", Object.keys(tokenMap));
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
  const unique = new Map();

  function addPair(key, address) {
    if (
      !address ||
      !ethers.isAddress(address) ||
      address.toLowerCase() === ethers.ZeroAddress.toLowerCase()
    ) {
      return false;
    }

    const lower = address.toLowerCase();
    if (unique.has(lower)) return false;

    unique.set(lower, {
      key,
      address: ethers.getAddress(address)
    });

    return true;
  }

  // These ten pools were confirmed active on QMS Testnet.
  // Loading them directly avoids a Factory scan before first render.
  const coreSeeds = [
    ["QMS/USDC", "0xc9c07DC80B9381615ef5a575c333125F711465eD"],
    ["QMS/USDT", "0xeE027e0beEeE782e700Ca024514494b045F7278d"],
    ["QMS/BTC",  "0xEf7773f9CeC2F034f94622A524B1Cf242C775042"],
    ["QMS/ETH",  "0x46C41Cf1E80549c67958601a9b79d9a162FC55a2"],
    ["USDC/USDT","0x54f221a63e9d0F23d4cF8e12436Fe58E7D807704"],
    ["USDC/BTC", "0x0265aE868d937372f0273E1DfAf40478fc3d9b19"],
    ["USDC/ETH", "0x3768B01813fA03A4863A44392Ed7F8F801455fc3"],
    ["USDT/BTC", "0x380D05428aaC8C958BeE96C5fbd349D1C415d1f4"],
    ["USDT/ETH", "0xa60f8dfd3E65A2A9E346Ed51a4863949798dEeaB"],
    ["BTC/ETH",  "0x8308FdBD7D1487D4a46De712C2766d7a8E671360"]
  ];

  for (const [key, address] of coreSeeds) {
    const [a, b] = key.split("/");
    if (token(a) && token(b)) addPair(key, address);
  }

  const assets = Object.values(tokenMap);
  const coreAddresses = new Set(
    CORE_MARKET_SYMBOLS
      .map(symbol => token(symbol)?.address?.toLowerCase())
      .filter(Boolean)
  );

  // Use the exact QWAP pool addresses saved during token import.
  for (const asset of assets) {
    for (const pool of asset.pools || []) {
      if (pool?.venue !== "QWAP") continue;
      if (!ethers.isAddress(pool.pairAddress)) continue;

      const baseAddress = pool.baseAddress;
      let baseSymbol = baseAddress
        ? symbolForAddress(baseAddress)
        : "Unknown";

      if (baseSymbol === "Unknown") {
        baseSymbol = String(
          pool.baseSymbol || pool.baseKey || ""
        ).toUpperCase();
      }

      if (baseSymbol === "WQMS") baseSymbol = "QMS";

      if (!baseSymbol || !token(baseSymbol)) continue;

      addPair(
        `${asset.symbol}/${baseSymbol}`,
        pool.pairAddress
      );
    }

    // Compatibility with a single-pair QPad token record.
    if (asset.pairAddress) {
      const baseAddress =
        asset.baseAddress || qwapConfig.wrappedNativeAddress;

      let baseSymbol = symbolForAddress(baseAddress);
      if (baseSymbol === "Unknown") baseSymbol = "QMS";

      if (token(baseSymbol)) {
        addPair(
          `${asset.symbol}/${baseSymbol}`,
          asset.pairAddress
        );
      }
    }
  }

  pairConfig = [...unique.values()];

  // Only perform one WQMS lookup for assets with no cached pool
  // metadata. Never scan every possible imported-token combination.
  const fallbackAssets = assets.filter(asset => {
    if (coreAddresses.has(asset.address.toLowerCase())) return false;

    const hasCachedQwapPool =
      (asset.pools || []).some(pool =>
        pool?.venue === "QWAP" &&
        ethers.isAddress(pool.pairAddress)
      ) ||
      Boolean(asset.pairAddress);

    return !hasCachedQwapPool;
  });

  if (fallbackAssets.length) {
    mapLimit(fallbackAssets, 8, async asset => {
      const address = await factoryRead.getPair(
        asset.address,
        qwapConfig.wrappedNativeAddress
      );

      if (!address || address === ethers.ZeroAddress) return null;

      return {
        key: `${asset.symbol}/QMS`,
        address
      };
    }).then(results => {
      let changed = false;

      for (const item of results) {
        if (!item || item.error) continue;
        if (addPair(item.key, item.address)) changed = true;
      }

      if (changed) {
        pairConfig = [...unique.values()];

        if (marketCoreLoaded) {
          if (refreshing) {
            pendingPoolRefresh = true;
          } else {
            void refreshMarket();
          }
        }
      }
    }).catch(error => {
      console.warn("Additional pool discovery failed:", error);
    });
  }

  console.log(
    `Market initialized with ${pairConfig.length} known pools.`
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
  blockTag = null,
  maxPathLength = 5,
  maxPaths = 128
) {
  if (!routerRead || amountIn <= 0n) return null;

  const paths = buildCandidatePaths(
    tokenInAddress,
    tokenOutAddress,
    snapshots,
    maxPathLength,
    maxPaths
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

async function readCurrentPools(items = pairConfig) {
  return mapLimit(items, 8, async (item) => {
    const contract = new ethers.Contract(item.address, PAIR_ABI, rpc);

    try {
      const [token0, token1, reserves, totalSupply] = await Promise.all([
        contract.token0(),
        contract.token1(),
        contract.getReserves(),
        contract.totalSupply()
      ]);

      const parts = String(item.key || "").split("/");
      if (parts.length === 2) {
        const expectedA = token(parts[0]);
        const expectedB = token(parts[1]);

        if (expectedA && expectedB) {
          const a = String(token0).toLowerCase();
          const b = String(token1).toLowerCase();
          const x = expectedA.address.toLowerCase();
          const y = expectedB.address.toLowerCase();

          const valid =
            (a === x && b === y) ||
            (a === y && b === x);

          if (!valid) {
            throw new Error("Pool token addresses do not match the asset pair.");
          }
        }
      }

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
      blockTag,
      4,
      24
    );

    const routeKey = `${assetSymbol}->${quoteSymbol}`;

    if (!route) {
      if (blockTag === null) marketPriceRoutes.delete(routeKey);
      return null;
    }

    if (blockTag === null) {
      marketPriceRoutes.set(routeKey, [...route.path]);
    }

    const value = Number(
      ethers.formatUnits(route.amountOut, quote.decimals)
    );

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    if (blockTag === null) {
      marketPriceRoutes.delete(`${assetSymbol}->${quoteSymbol}`);
    }
    return null;
  }
}

async function buildPriceMap(snapshots, blockTag = null, symbols = Object.keys(tokenMap)) {
  const result = {};

  const values = await mapLimit(
    symbols,
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

async function getMarketPriceRoute(assetSymbol, quoteSymbol) {
  const key = `${assetSymbol}->${quoteSymbol}`;
  const cachedPath = marketPriceRoutes.get(key);

  if (Array.isArray(cachedPath) && cachedPath.length >= 2) {
    return { path: [...cachedPath] };
  }

  const asset = token(assetSymbol);
  const quote = token(quoteSymbol);
  if (!asset || !quote || !routerRead) return null;

  const route = await findBestQwapRoute(
    asset.address,
    quote.address,
    10n ** BigInt(asset.decimals),
    pairSnapshots,
    null,
    4,
    24
  );

  if (route?.path?.length >= 2) {
    marketPriceRoutes.set(key, [...route.path]);
    return route;
  }

  marketPriceRoutes.delete(key);
  return null;
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
  const preferredOrder = ["QMS", "BTC", "ETH", "BNB", "USDT"];

  const symbols = [
    ...preferredOrder.filter((symbol) => symbol !== "USDC" && token(symbol)),
    ...Object.keys(tokenMap)
      .filter((symbol) => symbol !== "USDC" && !preferredOrder.includes(symbol))
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

async function readHistoricalPools(blockNumber, snapshots = pairSnapshots) {
  return mapLimit(snapshots, 12, async (snapshot) => {
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
        error: error?.shortMessage ||
          error?.message ||
          "Historical reserve read failed"
      };
    }
  });
}

function routePoolSnapshots(routePath) {
  if (!Array.isArray(routePath) || routePath.length < 2) return [];

  const used = new Set();
  const result = [];

  for (let i = 0; i < routePath.length - 1; i++) {
    const from = String(routePath[i]).toLowerCase();
    const to = String(routePath[i + 1]).toLowerCase();

    const snapshot = pairSnapshots.find(item => {
      if (item.error) return false;

      const a = String(item.token0 || "").toLowerCase();
      const b = String(item.token1 || "").toLowerCase();

      return (a === from && b === to) || (a === to && b === from);
    });

    if (!snapshot) return [];

    const key = String(snapshot.address).toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      result.push(snapshot);
    }
  }

  return result;
}

async function readTokenPriceHistory(
  tokenSymbol,
  quoteSymbol,
  startBlock,
  latestBlock,
  routePath
) {
  const asset = token(tokenSymbol);
  const quote = token(quoteSymbol);

  if (!asset || !quote || tokenSymbol === quoteSymbol) return [];
  if (!routerRead || !Array.isArray(routePath) || routePath.length < 2) return [];
  if (!Number.isSafeInteger(startBlock) || !Number.isSafeInteger(latestBlock) || latestBlock <= startBlock) {
    throw new Error("Invalid 24-hour block range for QWAP Router history.");
  }

  // Do not make chart availability depend on Swap/Sync logs. The old chart
  // counted a direct BTC/USDT pool, while the live price may use BTC/QMS/USDT.
  // Sample the exact active Router route at evenly spaced historical blocks.
  const SAMPLE_COUNT = 49; // endpoints are rendered separately: ~30-minute intervals
  const span = latestBlock - startBlock;
  const sampleBlocks = [];
  const seen = new Set();

  for (let i = 1; i < SAMPLE_COUNT - 1; i++) {
    const blockNumber = Math.floor(
      startBlock + (span * i) / (SAMPLE_COUNT - 1)
    );

    if (
      blockNumber > startBlock &&
      blockNumber < latestBlock &&
      !seen.has(blockNumber)
    ) {
      seen.add(blockNumber);
      sampleBlocks.push(blockNumber);
    }
  }

  const results = await mapLimit(sampleBlocks, 4, async blockNumber => {
    const [amounts, block] = await Promise.all([
      routerRead.getAmountsOut(
        10n ** BigInt(asset.decimals),
        routePath,
        { blockTag: blockNumber }
      ),
      rpc.getBlock(blockNumber)
    ]);

    if (!amounts || amounts.length !== routePath.length || !block) return null;

    const output = BigInt(amounts[amounts.length - 1]);
    if (output <= 0n) return null;

    const price = Number(ethers.formatUnits(output, quote.decimals));
    if (!Number.isFinite(price) || price <= 0) return null;

    return {
      timestamp: Number(block.timestamp),
      price,
      blockNumber
    };
  });

  const failed = results.filter(item => item?.error);
  if (failed.length) {
    console.warn(
      `QWAP historical Router samples failed: ${failed.length}/${sampleBlocks.length}`,
      failed[0].error
    );
  }

  const points = results
    .filter(item => item && !item.error)
    .sort((a, b) => a.timestamp - b.timestamp || a.blockNumber - b.blockNumber);

  if (!points.length) {
    const firstError = failed[0]?.error;
    throw new Error(
      "QWAP Router could not return historical prices for the selected route" +
      (firstError ? `: ${firstError}` : ".")
    );
  }

  return points;
}
function chartPriceFormat(value) {
  if (!Number.isFinite(value)) return "\u{2014}";
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
    message || "24H price history from on-chain swaps.";

  requestAnimationFrame(drawTokenPriceChart);
}

async function readSelectedHistoricalPrice(
  tokenSymbol,
  quoteSymbol,
  startBlock,
  routePath
) {
  const asset = token(tokenSymbol);
  const quote = token(quoteSymbol);

  if (!asset || !quote || tokenSymbol === quoteSymbol) return null;
  if (!routerRead || !Array.isArray(routePath) || routePath.length < 2) return null;

  const amountIn = 10n ** BigInt(asset.decimals);
  const amounts = await routerRead.getAmountsOut(
    amountIn,
    routePath,
    { blockTag: startBlock }
  );

  if (!amounts || amounts.length !== routePath.length) return null;

  const output = BigInt(amounts[amounts.length - 1]);
  if (output <= 0n) return null;

  const price = Number(ethers.formatUnits(output, quote.decimals));
  return Number.isFinite(price) && price > 0 ? price : null;
}
async function loadSelectedTokenChart() {
  // Every new selection invalidates the previous chart request.
  const requestId = ++chartRequestId;

  const symbol = selectedChartToken;
  const quoteSymbol = selectedQuote;
  const asset = token(symbol);

  if (!asset) {
    renderTokenChart([], "Selected token is not configured.");
    return;
  }

  if (symbol === quoteSymbol) {
    renderTokenChart(
      [],
      "This is the selected quote asset. Choose another token to view its price chart."
    );
    return;
  }

  renderTokenChart([], `Loading ${symbol} 24H price history...`);

  try {
    let historyWindow = marketHistoryWindow;

    if (!historyWindow) {
      const latestBlock = lastMarketBlock || await rpc.getBlockNumber();
      const latest = await rpc.getBlock(latestBlock);

      if (!latest) throw new Error("Cannot read latest block timestamp.");

      const targetTimestamp = Number(latest.timestamp) - 86400;
      const startBlock = await findBlockAtTimestamp(targetTimestamp, latestBlock);

      if (
        requestId !== chartRequestId ||
        symbol !== selectedChartToken ||
        quoteSymbol !== selectedQuote
      ) return;

      if (startBlock === null) {
        renderTokenChart(
          [],
          "The RPC did not provide a usable 24-hour historical block range."
        );
        return;
      }

      historyWindow = {
        startBlock,
        latestBlock,
        targetTimestamp,
        latestTimestamp: Number(latest.timestamp),
        historicalPrices: null
      };

      marketHistoryWindow = historyWindow;
    }

    // Use the exact same route selected for the Market spot price.
    const marketRoute = await getMarketPriceRoute(symbol, quoteSymbol);

    if (!marketRoute?.path?.length) {
      renderTokenChart([], `No active market route is available for ${symbol}/${quoteSymbol}.`);
      return;
    }

    const routePath = [...marketRoute.path];

    const results = await Promise.allSettled([
      readSelectedHistoricalPrice(
        symbol,
        quoteSymbol,
        historyWindow.startBlock,
        routePath
      ),
      readTokenPriceHistory(
        symbol,
        quoteSymbol,
        historyWindow.startBlock,
        historyWindow.latestBlock,
        routePath
      )
    ]);

    if (
      requestId !== chartRequestId ||
      symbol !== selectedChartToken ||
      quoteSymbol !== selectedQuote
    ) return;

    const historicalPrice =
      results[0].status === "fulfilled" ? results[0].value : null;

    const routePoints =
      results[1].status === "fulfilled" ? results[1].value : [];

    if (results[0].status === "rejected") {
      console.warn("Historical market price unavailable:", results[0].reason);
    }

    if (results[1].status === "rejected") {
      console.warn("Market price history unavailable:", results[1].reason);
    }

    const points = [];

    if (Number.isFinite(historicalPrice) && historicalPrice > 0) {
      points.push({
        timestamp: historyWindow.targetTimestamp,
        price: historicalPrice
      });
    }

    points.push(...routePoints);

    const currentPrice = currentPrices[symbol];

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

    points.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

    const routeSymbols = routePath.map(symbolForAddress);
    const message = points.length >= 2
      ? `24H QWAP Router history: ${points.length} price samples at approximately 30-minute intervals. Route: ${routeSymbols.join(" \u{2192} ")}.`
      : `Insufficient historical QWAP Router quotes for route: ${routeSymbols.join(" \u{2192} ")}.`;

    renderTokenChart(points, message);

  } catch (error) {
    if (requestId === chartRequestId) {
      console.warn("Selected market chart unavailable:", error);

      renderTokenChart(
        [],
        "24H price history unavailable: " +
          (error?.shortMessage || error?.message || "RPC error")
      );
    }
  }
}
async function read24HourEvents(startBlock, latestBlock, prices) {
  const perPool = {};
  const recent = [];
  let totalVolume = 0;
  let complete = true;
  let successfulPools = 0;

  const activeSnapshots = corePairSnapshots.filter(snapshot =>
    !snapshot.error &&
    snapshot.reserve0 > 0n &&
    snapshot.reserve1 > 0n
  );

  // Avoid hitting the RPC with thousands of independent getLogs calls.
  // The UI explicitly marks the result partial when this safety cap applies.
  const MAX_VOLUME_POOLS = 10;
  const selectedSnapshots = activeSnapshots.slice(0, MAX_VOLUME_POOLS);

  if (activeSnapshots.length > selectedSnapshots.length) {
    complete = false;
  }

  const results = await mapLimit(
    selectedSnapshots,
    2,
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
        console.warn("Could not parse a market Swap event:", error);
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

async function refreshExtraMarketPools(items) {
  if (!items.length || extraPoolsLoading) return;

  const cacheFresh =
    Date.now() - lastExtraPoolRefreshAt < 120000 &&
    extraPairSnapshots.length === items.length;

  if (cacheFresh) return;

  extraPoolsLoading = true;
  lastExtraPoolRefreshAt = Date.now();

  try {
    const snapshots = await readCurrentPools(items);

    extraPairSnapshots = snapshots;
    pairSnapshots = [
      ...corePairSnapshots,
      ...extraPairSnapshots
    ];

    const extraSymbols = Object.keys(tokenMap).filter(
      symbol => !CORE_MARKET_SET.has(symbol)
    );

    if (extraSymbols.length) {
      const extraPrices = await buildPriceMap(
        pairSnapshots,
        null,
        extraSymbols
      );

      Object.assign(currentPrices, extraPrices);
      if (!CORE_MARKET_SET.has(selectedChartToken)) {
        void loadSelectedTokenChart();
      }
    }

    renderTokenRows(currentPrices, lastPriceChanges);
    renderPoolSummary(pairSnapshots, currentPrices);

    void updateOrderPreview();

  } catch (error) {
    console.warn("Additional market pools refresh failed:", error);
    lastExtraPoolRefreshAt = 0;

  } finally {
    extraPoolsLoading = false;

    if (
      lastMarketBlock > 0 &&
      !historyRefreshing &&
      Date.now() - lastHistoryRefreshAt >= 300000
    ) {
      lastHistoryRefreshAt = Date.now();
      scheduleMarketHistory(lastMarketBlock);
    }
  }
}

async function refreshMarketVolume(startBlock, latestBlock) {
  if (volumeRefreshing) return;

  if (Date.now() - lastVolumeRefreshAt < 300000) return;

  volumeRefreshing = true;
  lastVolumeRefreshAt = Date.now();

  const quoteAtStart = selectedQuote;
  const pricesAtStart = { ...currentPrices };

  try {
    const eventData = await read24HourEvents(
      startBlock,
      latestBlock,
      pricesAtStart
    );

    if (quoteAtStart !== selectedQuote) return;

    poolVolumes = eventData.perPool || {};

    $("totalVolume").textContent = eventData
      ? numberFormat(eventData.totalVolume, 2) + " " + quoteAtStart
      : "Unavailable";

  } catch (error) {
    console.warn("Background 24H volume unavailable:", error);

    if (quoteAtStart === selectedQuote) {
      $("totalVolume").textContent = "Unavailable";
    }

  } finally {
    volumeRefreshing = false;

    // If the quote changed while volume was loading,
    // run the volume query again for the new quote.
    if (quoteAtStart !== selectedQuote) {
      lastVolumeRefreshAt = 0;

      const latestWindow = marketHistoryWindow;

      if (latestWindow) {
        void refreshMarketVolume(
          latestWindow.startBlock,
          latestWindow.latestBlock
        );
      }
    }
  }
}

function scheduleMarketHistory(latestBlock, delayMs = 15000) {
  pendingHistoryBlock = Math.max(
    pendingHistoryBlock,
    Number(latestBlock) || 0
  );

  if (historyLaunchTimer !== null) return;

  const run = () => {
    const activeId = document.activeElement?.id || "";

    const orderFormFocused = [
      "orderAmount",
      "limitPrice",
      "baseToken",
      "quoteToken",
      "orderExpiry",
      "placeOrderBtn"
    ].includes(activeId);

    if (
      document.visibilityState === "hidden" ||
      orderFormFocused
    ) {
      historyLaunchTimer = setTimeout(run, 10000);
      return;
    }

    historyLaunchTimer = null;

    const block = pendingHistoryBlock;
    pendingHistoryBlock = 0;

    if (block > 0 && !historyRefreshing) {
      void refreshMarketHistory(block);
    }
  };

  historyLaunchTimer = setTimeout(run, delayMs);
}

function scheduleMarketVolume(startBlock, latestBlock, delayMs = 10000) {
  pendingVolumeWindow = {
    startBlock,
    latestBlock
  };

  if (volumeLaunchTimer !== null) return;

  const run = () => {
    const activeId = document.activeElement?.id || "";

    const orderFormFocused = [
      "orderAmount",
      "limitPrice",
      "baseToken",
      "quoteToken",
      "orderExpiry",
      "placeOrderBtn"
    ].includes(activeId);

    if (
      document.visibilityState === "hidden" ||
      orderFormFocused
    ) {
      volumeLaunchTimer = setTimeout(run, 10000);
      return;
    }

    volumeLaunchTimer = null;

    const job = pendingVolumeWindow;
    pendingVolumeWindow = null;

    if (job) {
      void refreshMarketVolume(
        job.startBlock,
        job.latestBlock
      );
    }
  };

  volumeLaunchTimer = setTimeout(run, delayMs);
}
async function refreshMarketHistory(latestBlock) {
  if (historyRefreshing) return;

  historyRefreshing = true;
  lastHistoryRefreshAt = Date.now();

  const quoteAtStart = selectedQuote;

  try {
    const latest = await rpc.getBlock(latestBlock);

    if (!latest) {
      throw new Error("Cannot read latest block timestamp.");
    }

    const targetTimestamp = Number(latest.timestamp) - 86400;

    const startBlock = await findBlockAtTimestamp(
      targetTimestamp,
      latestBlock
    );

    if (startBlock === null) {
      marketHistoryWindow = null;

      $("historyMeta").textContent =
        "24H historical data unavailable.";

      renderTokenChart(
        [],
        "The RPC did not provide a usable 24-hour historical block range."
      );

      return;
    }

    marketHistoryWindow = {
      startBlock,
      latestBlock,
      targetTimestamp,
      latestTimestamp: Number(latest.timestamp),
      historicalPrices: null
    };

    // Clear stale changes while the new historical snapshot loads.
    lastPriceChanges = {};

    renderTokenRows(
      currentPrices,
      lastPriceChanges
    );

    // First load the selected chart.
    // On first visit this is BTC.
    await loadSelectedTokenChart();

    // Ignore stale work if the user changed the quote asset.
    if (quoteAtStart !== selectedQuote) return;

    $("historyMeta").textContent =
      "Loading 24H reference prices for core assets...";

    // Read historical reserves from the ten default pools only.
    // Imported token pools are not included in this request.
    const historicalCoreSnapshots = await readHistoricalPools(
      startBlock,
      corePairSnapshots
    );

    if (quoteAtStart !== selectedQuote) return;

    const coreSymbols = CORE_MARKET_SYMBOLS.filter(
      symbol => token(symbol)
    );

    const historicalCorePrices = await buildPriceMap(
      historicalCoreSnapshots,
      startBlock,
      coreSymbols
    );

    if (quoteAtStart !== selectedQuote) return;

    // Compare current spot prices with historical prices.
    const changes = renderChanges(
      currentPrices,
      historicalCorePrices
    );

    lastPriceChanges = changes;

    renderTokenRows(
      currentPrices,
      lastPriceChanges
    );

    $("historyMeta").textContent =
      "24H reference block " +
      startBlock.toLocaleString("en-US") +
      " for five core assets.";

    // Trading volume runs independently after chart and price changes.
    scheduleMarketVolume(startBlock, latestBlock);

  } catch (error) {
    console.warn(
      "Background market history unavailable:",
      error
    );

    $("historyMeta").textContent =
      "24H historical data unavailable.";

  } finally {
    historyRefreshing = false;
  }
}

async function refreshMarket() {
  if (refreshing) {
    pendingPoolRefresh = true;
    return;
  }

  refreshing = true;
  $("refreshBtn").disabled = true;

  try {
    const [network, latestBlock] = await Promise.all([
      rpc.getNetwork(),
      rpc.getBlockNumber()
    ]);

    if (Number(network.chainId) !== CHAIN_ID) {
      throw new Error(
        `RPC returned chain ${network.chainId}, expected ${CHAIN_ID}.`
      );
    }

    lastMarketBlock = latestBlock;

    const corePairs = pairConfig.filter(item => {
      const parts = String(item.key || "").split("/");
      return parts.length === 2 &&
        parts.every(symbol => CORE_MARKET_SET.has(symbol));
    });

    const extraPairs = pairConfig.filter(item => {
      const parts = String(item.key || "").split("/");
      return !(
        parts.length === 2 &&
        parts.every(symbol => CORE_MARKET_SET.has(symbol))
      );
    });

    // Load the ten core pools first. Imported assets do not block
    // the initial token table or the main market statistics.
    corePairSnapshots = await readCurrentPools(corePairs);

    pairSnapshots = [
      ...corePairSnapshots,
      ...extraPairSnapshots
    ];

    const coreSymbols = CORE_MARKET_SYMBOLS.filter(
      symbol => token(symbol)
    );

    const corePrices = await buildPriceMap(
      corePairSnapshots,
      null,
      coreSymbols
    );

    for (const symbol of coreSymbols) {
      currentPrices[symbol] =
        corePrices[symbol] ?? null;
    }

    renderTokenRows(currentPrices, lastPriceChanges);
    renderPoolSummary(pairSnapshots, currentPrices);

    $("currentBlock").textContent =
      latestBlock.toLocaleString("en-US");

    $("updatedAt").textContent =
      `Updated ${new Date().toLocaleTimeString()}`;

    marketCoreLoaded = true;

    setStatus("Market data updated.", "success");
    void updateOrderPreview();

    // Imported pools load separately and do not block the default BTC chart.
    if (extraPairs.length) {
      void refreshExtraMarketPools(extraPairs);
    }

    // The default chart loads after the six USDT-market pools are ready.
    if (
      !historyRefreshing &&
      Date.now() - lastHistoryRefreshAt >= 300000
    ) {
      scheduleMarketHistory(latestBlock);
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

    if (pendingPoolRefresh) {
      pendingPoolRefresh = false;
      Promise.resolve().then(() => refreshMarket());
    }
  }
}

function selectQuote() {
  // Market valuation is permanently denominated in USDT.
  selectedQuote = "USDT";
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

const SPEND_BALANCE_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const SPEND_BALANCE_CACHE_MS = 15000;

const spendBalanceCache = new Map();
const spendBalancePending = new Map();

let spendBalanceRequestId = 0;

function ensureSpendBalanceElement() {
  const label = $("amountLabel");

  if (!label) return null;

  let element = label.querySelector("#orderSpendBalance");

  if (!element) {
    element = document.createElement("span");
    element.id = "orderSpendBalance";
    element.setAttribute("aria-live", "polite");

    label.appendChild(element);
  }

  // Keep the balance on the same row, aligned to the right.
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.justifyContent = "space-between";
  label.style.gap = "12px";
  label.style.width = "100%";

  element.style.marginLeft = "auto";
  element.style.flexShrink = "0";
  element.style.whiteSpace = "nowrap";
  element.style.fontSize = "12px";
  element.style.fontWeight = "500";
  element.style.opacity = "0.8";
  element.style.textAlign = "right";

  return element;
}

function formatSpendWalletBalance(rawBalance, decimals) {
  const formatted = ethers.formatUnits(
    rawBalance,
    decimals
  );

  const parts = formatted.split(".");
  const integerPart = parts[0] || "0";
  const fractionPart = parts[1] || "";

  const groupedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );

  // Show up to 8 fractional digits without trailing zeros.
  const visibleFraction = fractionPart
    .slice(0, 8)
    .replace(/0+$/, "");

  return visibleFraction
    ? `${groupedInteger}.${visibleFraction}`
    : groupedInteger;
}

async function refreshSpendBalance(force = false) {
  const balanceElement = ensureSpendBalanceElement();

  if (!balanceElement) return;

  // Read the latest wallet account from the main application.
  if (typeof marketContext?.getAccount === "function") {
    const activeAccount = marketContext.getAccount();

    if (activeAccount !== undefined && activeAccount !== null) {
      walletAccount = activeAccount || "";
    }
  }

  // The token being spent changes with Buy/Sell.
  const spendSymbol = currentSide === "buy"
    ? $("quoteToken")?.value
    : $("baseToken")?.value;

  const spendToken = spendSymbol
    ? token(spendSymbol)
    : null;

  if (!walletAccount) {
    balanceElement.textContent = "Connect wallet";
    return;
  }

  if (!spendToken?.address || !ethers.isAddress(spendToken.address)) {
    balanceElement.textContent = "Balance unavailable";
    return;
  }

  const account = walletAccount;
  const accountKey = account.toLowerCase();

  const tokenAddress = spendToken.address.toLowerCase();

  const cacheKey = [
    accountKey,
    tokenAddress,
    spendToken.native ? "native" : "erc20"
  ].join(":");

  const requestId = ++spendBalanceRequestId;

  const isStillSelected = () => {
    const currentSymbol = currentSide === "buy"
      ? $("quoteToken")?.value
      : $("baseToken")?.value;

    const currentAccount =
      typeof marketContext?.getAccount === "function"
        ? (marketContext.getAccount() || "")
        : walletAccount;

    return (
      requestId === spendBalanceRequestId &&
      currentSymbol === spendSymbol &&
      currentAccount.toLowerCase() === accountKey
    );
  };

  // Reuse a fresh result while the user is typing.
  const cached = spendBalanceCache.get(cacheKey);

  if (
    !force &&
    cached &&
    Date.now() - cached.timestamp < SPEND_BALANCE_CACHE_MS
  ) {
    if (isStillSelected()) {
      const element = ensureSpendBalanceElement();

      if (element) {
        element.textContent =
          `Balance: ${formatSpendWalletBalance(
            cached.balance,
            spendToken.decimals
          )} ${spendSymbol}`;
      }
    }

    return;
  }

  balanceElement.textContent = `Balance: Loading ${spendSymbol}...`;

  let pending = spendBalancePending.get(cacheKey);

  if (!pending) {
    pending = (async () => {
      // QMS is the native QMS balance.
      if (spendToken.native) {
        return await rpc.getBalance(account);
      }

      // Other tokens use ERC20 balanceOf().
      const contract = new ethers.Contract(
        spendToken.address,
        SPEND_BALANCE_ABI,
        rpc
      );

      return await contract.balanceOf(account);
    })();

    spendBalancePending.set(cacheKey, pending);
  }

  try {
    const rawBalance = await pending;

    spendBalanceCache.set(cacheKey, {
      balance: rawBalance,
      timestamp: Date.now()
    });

    if (!isStillSelected()) return;

    const element = ensureSpendBalanceElement();

    if (element) {
      element.textContent =
        `Balance: ${formatSpendWalletBalance(
          rawBalance,
          spendToken.decimals
        )} ${spendSymbol}`;
    }

  } catch (error) {
    console.debug(
      "Wallet spend balance unavailable:",
      spendSymbol,
      error
    );

    if (isStillSelected()) {
      const element = ensureSpendBalanceElement();

      if (element) {
        element.textContent = "Balance: Unavailable";
      }
    }

  } finally {
    if (spendBalancePending.get(cacheKey) === pending) {
      spendBalancePending.delete(cacheKey);
    }
  }
}

function getTokenUsdtPrice(symbol) {
  if (!symbol) return null;

  if (symbol === "USDT") return 1;

  const tokenPrice = Number(currentPrices[symbol]);
  const usdtPriceInMarketQuote = Number(currentPrices.USDT);

  if (
    Number.isFinite(tokenPrice) &&
    tokenPrice > 0 &&
    Number.isFinite(usdtPriceInMarketQuote) &&
    usdtPriceInMarketQuote > 0
  ) {
    return tokenPrice / usdtPriceInMarketQuote;
  }

  // Fallback for the stablecoin while the first price snapshot loads.
  if (symbol === "USDC") return 1;

  return null;
}

async function getQwapPriceScaled(tokenInMeta, tokenOutMeta, blockTag = null) {
  if (!tokenInMeta || !tokenOutMeta || !routerRead) {
    throw new Error("Market price source is unavailable.");
  }

  if (
    tokenInMeta.address.toLowerCase() ===
    tokenOutMeta.address.toLowerCase()
  ) {
    return 10n ** 18n;
  }

  const amountIn = 10n ** BigInt(tokenInMeta.decimals);
  const route = await findBestQwapRoute(
    tokenInMeta.address,
    tokenOutMeta.address,
    amountIn,
    pairSnapshots,
    blockTag,
    5,
    48
  );

  if (!route || route.amountOut <= 0n) {
    throw new Error(
      `No active market route can price ${tokenInMeta.symbol} in ${tokenOutMeta.symbol}.`
    );
  }

  // `amountIn` is exactly one whole input token. Convert the Router output
  // into an 18-decimal human price without passing through a JS float.
  return (
    BigInt(route.amountOut) * (10n ** 18n) /
    (10n ** BigInt(tokenOutMeta.decimals))
  );
}

function formatUsdtEntryPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  const fixed = number.toFixed(6);
  const parts = fixed.split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = parts[1].replace(/0+$/, "");

  return `${whole}.${fraction.length ? fraction : "00"}`;
}

function orderEntryMetadataStorageKey() {
  if (!walletAccount || !orderBookAddress) return null;

  return (
    `qmswap.limitOrderEntry.v1.${CHAIN_ID}.` +
    `${String(walletAccount).toLowerCase()}.` +
    `${String(orderBookAddress).toLowerCase()}`
  );
}

function readOrderEntryMetadataStore() {
  try {
    const key = orderEntryMetadataStorageKey();
    if (!key) return {};

    const saved = JSON.parse(localStorage.getItem(key) || "{}");

    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveOrderEntryMetadata(orderId, preview) {
  try {
    const key = orderEntryMetadataStorageKey();

    if (!key || !orderId || !preview) return;

    const store = readOrderEntryMetadataStore();

    const recordKey =
      `${String(orderId)}:` +
      `${String(preview.tokenIn.address).toLowerCase()}:` +
      `${String(preview.tokenOut.address).toLowerCase()}`;

    store[recordKey] = {
      baseSymbol: preview.baseSymbol,
      quoteSymbol: preview.quoteSymbol,
      limitPriceUsdt: String(preview.limitPriceUsdt),
      side: preview.buying ? "buy" : "sell",
      savedAt: Date.now()
    };

    const entries = Object.entries(store).slice(-150);

    localStorage.setItem(
      key,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch (error) {
    console.warn("Could not save local order entry metadata:", error);
  }
}

function getOrderEntryMetadata(order) {
  try {
    if (!order?.id) return null;

    const store = readOrderEntryMetadataStore();

    const recordKey =
      `${String(order.id)}:` +
      `${String(order.tokenIn).toLowerCase()}:` +
      `${String(order.tokenOut).toLowerCase()}`;

    return store[recordKey] || null;
  } catch {
    return null;
  }
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

  // User input is always USDT per BASE token.
  const limitPriceUsdtScaled = ethers.parseUnits(priceText, 18);

  if (limitPriceUsdtScaled <= 0n) {
    throw new Error("Limit price must be greater than zero.");
  }

  const buying = currentSide === "buy";

  const tokenIn = buying ? quote : base;
  const tokenOut = buying ? base : quote;

  // The amount is still denominated in the actual escrow token.
  const amountIn = ethers.parseUnits(
    amountText,
    tokenIn.decimals
  );

  if (amountIn <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  // Pin all preview route quotes to one block so the Router comparison and
  // minimum-size search cannot mix reserve states from different blocks.
  const quoteBlock = await rpc.getBlockNumber();

  // Convert the selected quote asset into USDT using the same live QWAP
  // Router used by Market Price and by the V3 Order Book.
  const usdt = token("USDT");
  if (!usdt) throw new Error("USDT is missing from the token registry.");

  const quotePriceUsdtScaled = await getQwapPriceScaled(
    quote,
    usdt,
    quoteBlock
  );
  if (quotePriceUsdtScaled <= 0n) {
    throw new Error("Invalid quote-to-USDT conversion.");
  }

  const quotePriceUsdt = Number(
    ethers.formatUnits(quotePriceUsdtScaled, 18)
  );

  if (!Number.isFinite(quotePriceUsdt) || quotePriceUsdt <= 0) {
    throw new Error("The market returned an invalid quote-to-USDT price.");
  }

  // Convert USDT per BASE to selected QUOTE per BASE.
  const conversionNumerator =
    limitPriceUsdtScaled * (10n ** 18n);

  // Buy rounds down: a stricter maximum buy price.
  // Sell rounds up: a stricter minimum sell price.
  const priceScaled = buying
    ? conversionNumerator / quotePriceUsdtScaled
    : ceilDiv(conversionNumerator, quotePriceUsdtScaled);

  if (priceScaled <= 0n) {
    throw new Error("Converted limit price is too small.");
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

  let route = null;
  try {
    route = await findBestQwapRoute(
      tokenIn.address,
      tokenOut.address,
      amountIn,
      pairSnapshots,
      quoteBlock
    );
  } catch (error) {
    if (!isInsufficientRouteAmountError(error)) throw error;
  }

  // A spend below the route's smallest non-zero output can make the normal
  // quote return no route. Find the best path with a reference-sized input,
  // then keep the actual order-size output at zero for the preflight check.
  if (!route || !route.path?.length) {
    const referenceAmount = 10n ** BigInt(tokenIn.decimals);
    const referenceRoute = await findBestQwapRoute(
      tokenIn.address,
      tokenOut.address,
      referenceAmount,
      pairSnapshots,
      quoteBlock
    );

    if (!referenceRoute?.path?.length) {
      throw new Error(
        "No active market route exists for this token pair. No pool will be created."
      );
    }

    let actualAmountOut = 0n;
    try {
      const actualAmounts = await routerRead.getAmountsOut(
        amountIn,
        referenceRoute.path,
        { blockTag: quoteBlock }
      );
      if (actualAmounts?.length === referenceRoute.path.length) {
        actualAmountOut = BigInt(actualAmounts[actualAmounts.length - 1]);
      }
    } catch (error) {
      if (!isInsufficientRouteAmountError(error)) throw error;
    }

    route = { ...referenceRoute, amountOut: actualAmountOut };
  }

  const humanInput = Number(ethers.formatUnits(amountIn, tokenIn.decimals));
  const humanOutput = Number(ethers.formatUnits(route.amountOut, tokenOut.decimals));

  const quotePerBase = humanOutput > 0
    ? (buying ? humanInput / humanOutput : humanOutput / humanInput)
    : null;

  const currentExecutionPriceUsdt =
    quotePerBase === null ? null : quotePerBase * quotePriceUsdt;

  // Read the one-token USDT reference at the same block as the exact-size
  // execution quote. If it is unavailable, fall back to the Market snapshot.
  let spotPriceUsdt = getTokenUsdtPrice(baseSymbol);
  try {
    const spotScaled = await getQwapPriceScaled(base, usdt, quoteBlock);
    const spotValue = Number(ethers.formatUnits(spotScaled, 18));
    if (Number.isFinite(spotValue) && spotValue > 0) {
      spotPriceUsdt = spotValue;
    }
  } catch (error) {
    console.warn("Exact-block USDT spot reference unavailable:", error);
  }

  return {
    base,
    quote,
    baseSymbol,
    quoteSymbol,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    path: route.path,
    routeQuote: route.amountOut,
    priceScaled,
    limitPriceUsdt: priceText,
    quotePriceUsdt,
    currentExecutionPriceUsdt,
    spotPriceUsdt,
    quoteBlock,
    buying
  };
}

function formatRawTokenAmount(rawAmount, tokenMeta) {
  const formatted = ethers.formatUnits(BigInt(rawAmount), tokenMeta.decimals);
  const [whole = "0", fraction = ""] = formatted.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}

function requiredOutputForAmount(amountIn, preview) {
  const amount = BigInt(amountIn);
  if (preview.buying) {
    const numerator =
      amount *
      (10n ** BigInt(preview.base.decimals)) *
      (10n ** 18n);
    const denominator =
      (10n ** BigInt(preview.quote.decimals)) *
      preview.priceScaled;
    return ceilDiv(numerator, denominator);
  }

  const numerator =
    amount *
    preview.priceScaled *
    (10n ** BigInt(preview.quote.decimals));
  const denominator =
    (10n ** BigInt(preview.base.decimals)) *
    (10n ** 18n);
  return ceilDiv(numerator, denominator);
}

const MINIMUM_ROUTE_SPEND_CACHE_MS = 15000;
const minimumRouteSpendCache = new Map();

function isInsufficientRouteAmountError(error) {
  const reason = String(
    error?.shortMessage || error?.reason || error?.message || ""
  );
  return /INSUFFICIENT_INPUT_AMOUNT|INSUFFICIENT_OUTPUT_AMOUNT|INSUFFICIENT_LIQUIDITY|zero output|output amount is zero|ds-math-sub-underflow/i.test(reason);
}

function getSpotLimitMismatch(preview, routeQuote = preview.routeQuote) {
  const spotPriceUsdt =
    Number.isFinite(preview.spotPriceUsdt) && preview.spotPriceUsdt > 0
      ? preview.spotPriceUsdt
      : getTokenUsdtPrice(preview.baseSymbol);
  const limitPriceUsdt = Number(preview.limitPriceUsdt);

  if (
    !Number.isFinite(spotPriceUsdt) ||
    spotPriceUsdt <= 0 ||
    !Number.isFinite(limitPriceUsdt) ||
    limitPriceUsdt <= 0
  ) return null;

  const spotConditionReached = preview.buying
    ? spotPriceUsdt <= limitPriceUsdt
    : spotPriceUsdt >= limitPriceUsdt;

  const actualOutput = BigInt(routeQuote);
  const requiredOutput = BigInt(preview.minAmountOut);

  // A legitimate out-of-range limit may wait. Block only when the displayed
  // USDT spot says the limit has been reached but the exact order-size route
  // still cannot deliver the order's required minimum output.
  if (!spotConditionReached || actualOutput >= requiredOutput) return null;

  const inputHuman = Number(
    ethers.formatUnits(preview.amountIn, preview.tokenIn.decimals)
  );
  const outputHuman = Number(
    ethers.formatUnits(actualOutput, preview.tokenOut.decimals)
  );
  const quotePerBase = preview.buying
    ? inputHuman / outputHuman
    : outputHuman / inputHuman;
  const executionPriceUsdt = quotePerBase * preview.quotePriceUsdt;

  return {
    spotPriceUsdt,
    limitPriceUsdt,
    actualOutput,
    requiredOutput,
    shortfall: requiredOutput - actualOutput,
    executionPriceUsdt
  };
}

async function findExecutableSpendRange(preview, isCurrentRequest) {
  if (!routerRead) return null;
  const originalAmount = BigInt(preview.amountIn);
  if (originalAmount <= 0n) return null;

  const quoteAtPreviewBlock = amount =>
    Number.isSafeInteger(preview.quoteBlock)
      ? routerRead.getAmountsOut(amount, preview.path, { blockTag: preview.quoteBlock })
      : routerRead.getAmountsOut(amount, preview.path);

  async function evaluate(amount) {
    try {
      const amounts = await quoteAtPreviewBlock(amount);
      if (!isCurrentRequest()) return null;
      if (!amounts || amounts.length !== preview.path.length) {
        return { amountIn: amount, executable: false, routeQuote: 0n };
      }
      const routeQuote = BigInt(amounts[amounts.length - 1]);
      const minAmountOut = requiredOutputForAmount(amount, preview);
      return { amountIn: amount, routeQuote, minAmountOut, executable: routeQuote >= minAmountOut };
    } catch (error) {
      if (!isCurrentRequest()) return null;
      const reason = String(error?.shortMessage || error?.reason || error?.message || "");
      if (/INSUFFICIENT_INPUT_AMOUNT|INSUFFICIENT_OUTPUT_AMOUNT|INSUFFICIENT_LIQUIDITY|zero output/i.test(reason)) {
        return { amountIn: amount, executable: false, routeQuote: 0n };
      }
      throw error;
    }
  }

  async function refineMinimum(failAmount, passResult) {
    let low = BigInt(failAmount);
    let high = BigInt(passResult.amountIn);
    let best = passResult;
    const iterations = Math.min(48, Math.max(18, preview.tokenIn.decimals + 8));
    for (let i = 0; i < iterations; i++) {
      const middle = (low + high) / 2n;
      if (middle <= low || middle >= high) break;
      const result = await evaluate(middle);
      if (!result) return null;
      if (result.executable) { high = middle; best = result; }
      else low = middle;
    }
    const finalResult = await evaluate(high);
    return finalResult?.executable ? finalResult : best;
  }

  async function refineMaximum(passResult, failAmount) {
    let low = BigInt(passResult.amountIn);
    let high = BigInt(failAmount);
    let best = passResult;
    const iterations = Math.min(48, Math.max(18, preview.tokenIn.decimals + 8));
    for (let i = 0; i < iterations; i++) {
      const middle = (low + high) / 2n;
      if (middle <= low || middle >= high) break;
      const result = await evaluate(middle);
      if (!result) return null;
      if (result.executable) { low = middle; best = result; }
      else high = middle;
    }
    const finalResult = await evaluate(low);
    return finalResult?.executable ? finalResult : best;
  }

  // A large order can fail because its price impact is too high. Search down
  // first; when a passing amount is found, locate both spend boundaries.
  let candidate = originalAmount;
  let largestPassing = null;
  let smallestPassing = null;
  let lowerFailure = null;
  const maxHalvings = Math.min(80, Math.max(32, preview.tokenIn.decimals + 44));

  for (let i = 0; i < maxHalvings; i++) {
    candidate /= 2n;
    if (candidate < 1n) break;
    const result = await evaluate(candidate);
    if (!result) return null;
    if (result.executable) {
      if (!largestPassing) largestPassing = result;
      smallestPassing = result;
    } else if (largestPassing) {
      lowerFailure = result;
      break;
    }
    if (candidate === 1n) break;
  }

  if (largestPassing) {
    const minimum = lowerFailure
      ? await refineMinimum(lowerFailure.amountIn, smallestPassing)
      : smallestPassing;
    const maximum = await refineMaximum(largestPassing, originalAmount);
    if (!minimum || !maximum) return null;
    return {
      minAmountIn: minimum.amountIn,
      maxAmountIn: maximum.amountIn,
      minRouteQuote: minimum.routeQuote,
      maxRouteQuote: maximum.routeQuote,
      searchedUpTo: originalAmount
    };
  }

  // If every smaller amount fails (for example, output rounds to zero),
  // search upward to find the first executable amount.
  let lowerFailureAmount = originalAmount;
  candidate = originalAmount;
  let firstPassing = null;
  const maxSearchAmount = 1024n * (10n ** BigInt(preview.tokenIn.decimals));
  const maxDoublings = Math.min(80, Math.max(32, preview.tokenIn.decimals + 44));
  for (let i = 0; i < maxDoublings && candidate < maxSearchAmount; i++) {
    candidate *= 2n;
    if (candidate > maxSearchAmount) candidate = maxSearchAmount;
    const result = await evaluate(candidate);
    if (!result) return null;
    if (result.executable) {
      firstPassing = await refineMinimum(lowerFailureAmount, result);
      break;
    }
    lowerFailureAmount = candidate;
  }

  if (!firstPassing) {
    return { minAmountIn: null, maxAmountIn: null, searchedUpTo: candidate };
  }

  let lastPassing = firstPassing;
  let upperFailure = null;
  candidate = firstPassing.amountIn;
  for (let i = 0; i < maxDoublings; i++) {
    candidate *= 2n;
    const result = await evaluate(candidate);
    if (!result) return null;
    if (result.executable) lastPassing = result;
    else { upperFailure = candidate; break; }
  }

  const maximum = upperFailure
    ? await refineMaximum(lastPassing, upperFailure)
    : null;
  if (upperFailure && !maximum) return null;
  return {
    minAmountIn: firstPassing.amountIn,
    maxAmountIn: maximum?.amountIn ?? null,
    minRouteQuote: firstPassing.routeQuote,
    maxRouteQuote: maximum?.routeQuote ?? null,
    searchedUpTo: candidate
  };
}

function buildSpotLimitMismatchMessage(preview, spendRange) {
  const symbol = preview.tokenIn.symbol;
  const limit = formatUsdtEntryPrice(preview.limitPriceUsdt);
  const entered = BigInt(preview.amountIn);

  if (spendRange?.minAmountIn) {
    const minimum = formatRawTokenAmount(spendRange.minAmountIn, preview.tokenIn);
    if (entered < spendRange.minAmountIn) {
      return `Minimum Spend: ${minimum} ${symbol} \u{2014} Enter at least ${minimum} ${symbol} to meet the ${limit} USDT / ${preview.baseSymbol} limit now.`;
    }

    if (spendRange.maxAmountIn && entered > spendRange.maxAmountIn) {
      const maximum = formatRawTokenAmount(spendRange.maxAmountIn, preview.tokenIn);
      return `Maximum Spend: ${maximum} ${symbol} \u{2014} Reduce the spend to ${maximum} ${symbol} or less to meet the limit now.`;
    }

    return `QWAP quote changed during preflight \u{2014} refresh the quote before placing this order.`;
  }

  return `No executable spend amount meets the ${limit} USDT / ${preview.baseSymbol} limit on the current QWAP route.`;
}

async function updateOrderPreview() {
  const sequence = ++previewRequestId;
  const baseSymbol = $("baseToken").value;
  const quoteSymbol = $("quoteToken").value;

  $("amountLabel").textContent = currentSide === "buy"
    ? `Amount to spend (${quoteSymbol})`
    : `Amount to sell (${baseSymbol})`;

  if (typeof refreshSpendBalance === "function") {
    void refreshSpendBalance();
  }

  $("priceLabel").textContent = `Limit price (USDT per ${baseSymbol})`;
  $("orderDirection").textContent = currentSide === "buy"
    ? `${quoteSymbol}  ${baseSymbol}`
    : `${baseSymbol}  ${quoteSymbol}`;
  $("placeOrderBtn").disabled = true;

  try {
    const preview = await getOrderPreview();
    if (sequence !== previewRequestId) return;

    $("minimumOutput").textContent =
      `${formatRawTokenAmount(preview.minAmountOut, preview.tokenOut)} ${preview.tokenOut.symbol}`;

    const marketableNow = preview.routeQuote >= preview.minAmountOut;
    const spotMismatch = getSpotLimitMismatch(preview);

    if (spotMismatch) {
      let spendRange = null;
      let spendSearchError = null;
      try {
        spendRange = await findExecutableSpendRange(
          preview,
          () => sequence === previewRequestId
        );
      } catch (error) {
        spendSearchError = error;
        console.warn("Executable minimum-spend search failed:", error);
      }

      if (sequence !== previewRequestId) return;

      $("executionCondition").textContent = spendSearchError
        ? "Minimum Spend: unavailable \u{2014} QWAP Router quote failed. Refresh the quote."
        : buildSpotLimitMismatchMessage(preview, spendRange);
      $("placeOrderBtn").disabled = true;
      $("placeOrderBtn").textContent = "Adjust Spend Amount";
      return;
    }

    const routeSymbols = preview.path.map(address => symbolForAddress(address));
    const convertedLimit = Number(ethers.formatUnits(preview.priceScaled, 18));
    const currentQuote = formatRawTokenAmount(preview.routeQuote, preview.tokenOut);

    $("executionCondition").textContent =
      `${preview.buying ? "Buy only at or below" : "Sell only at or above"} ${formatUsdtEntryPrice(preview.limitPriceUsdt)} USDT / ${baseSymbol}`;
    $("placeOrderBtn").disabled = !orderBookAddress;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Place Limit Order"
      : "Preview Only  Order Book Not Deployed";
  } catch (error) {
    if (sequence !== previewRequestId) return;
    $("minimumOutput").textContent = "";
    const displayLimit = formatUsdtEntryPrice($("limitPrice").value);
    $("executionCondition").textContent = displayLimit
      ? `${currentSide === "buy" ? "Buy only at or below" : "Sell only at or above"} ${displayLimit} USDT / ${baseSymbol}`
      : "Enter a valid limit price.";
    $("placeOrderBtn").disabled = true;
    $("placeOrderBtn").textContent = orderBookAddress
      ? "Enter Valid Order Details"
      : "Preview Only  Order Book Not Deployed";
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
        "QMSwap Limit Order service is not configured. Market prices and previews remain available; new Limit Orders are disabled.",
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
      throw new Error("V3 Order Book configuration does not match this market.");
    }

    orderBookAddress = ethers.getAddress(address);
    orderBookConfig = data;

    setOrderStatus(
      `QMSwap Limit Order service connected: ${compactAddress(address)}.`,
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
    throw new Error("QMSwap Limit Order service is not configured.");
  }

  await ensureSharedWallet();

  const preview = await getOrderPreview();

  // Recheck the exact QWAP route against the limit-derived minimum output
  // immediately before any approval or escrow transaction.
  const liveQuoteBlock = await rpc.getBlockNumber();
  const liveAmounts = await routerRead.getAmountsOut(
    preview.amountIn,
    preview.path,
    { blockTag: liveQuoteBlock }
  );

  if (!liveAmounts || liveAmounts.length !== preview.path.length) {
    throw new Error("The selected market route is no longer available. Refresh the quote.");
  }

  const liveRouteQuote = BigInt(liveAmounts[liveAmounts.length - 1]);
  const livePreview = {
    ...preview,
    quoteBlock: liveQuoteBlock,
    routeQuote: liveRouteQuote
  };

  try {
    const usdtToken = token("USDT");
    if (usdtToken) {
      const liveSpotScaled = await getQwapPriceScaled(
        preview.base,
        usdtToken,
        liveQuoteBlock
      );
      const liveSpot = Number(ethers.formatUnits(liveSpotScaled, 18));
      if (Number.isFinite(liveSpot) && liveSpot > 0) {
        livePreview.spotPriceUsdt = liveSpot;
      }
    }
  } catch (error) {
    console.warn("Final USDT spot check unavailable:", error);
  }

  const liveMismatch = getSpotLimitMismatch(livePreview, liveRouteQuote);
  if (liveMismatch) {
    const spendRange = await findExecutableSpendRange(livePreview, () => true);
    throw new Error(buildSpotLimitMismatchMessage(livePreview, spendRange));
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
      "Submitting QMSwap Limit Order. Confirm the transaction in your wallet...",
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
      `V3 order transaction submitted: ${compactAddress(tx.hash)}`,
      "warn"
    );

    const receipt = await tx.wait();

    // Parse OrderCreated from the order-book receipt.
    // The exact USDT price is saved locally, keyed by order ID.
    const entryEventInterface = new ethers.Interface(V3_ORDERBOOK_ABI);

    let createdOrderId = null;

    for (const log of receipt.logs || []) {
      if (
        String(log.address || "").toLowerCase() !==
        String(orderBookAddress || "").toLowerCase()
      ) {
        continue;
      }

      try {
        const parsed = entryEventInterface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed?.name !== "OrderCreated") continue;

        const eventOwner = parsed.args.owner;

        if (
          eventOwner &&
          String(eventOwner).toLowerCase() !==
            String(walletAccount).toLowerCase()
        ) {
          continue;
        }

        createdOrderId = String(parsed.args.orderId);
        break;

      } catch {
        // Ignore unrelated receipt logs.
      }
    }

    if (createdOrderId) {
      saveOrderEntryMetadata(
        createdOrderId,
        preview
      );
    } else {
      console.warn(
        "OrderCreated ID could not be parsed. Entry will use an on-chain approximation."
      );
    }

    setOrderStatus(
      "QMSwap Limit Order created successfully.",
      "success"
    );

    $("orderAmount").value = "";

    await loadMyOrders(true);
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
    return "\u{2014}";
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
  if (!tokenInMeta || !tokenOutMeta) return "";

  // New orders display the exact USDT price entered by the user.
  const saved = getOrderEntryMetadata(order);

  if (saved?.limitPriceUsdt && saved?.baseSymbol) {
    return (
      `${formatUsdtEntryPrice(saved.limitPriceUsdt)} USDT / ` +
      `${saved.baseSymbol}`
    );
  }

  // Old orders have no stored original USDT limit price.
  // Reconstruct an approximate value from their on-chain minimum output.
  const stableQuotes = new Set(["USDT", "USDC"]);

  let quoteSymbol;
  let baseSymbol;
  let quotePerBaseText;

  if (stableQuotes.has(tokenInSymbol)) {
    quoteSymbol = tokenInSymbol;
    baseSymbol = tokenOutSymbol;

    quotePerBaseText = formatRawTokenRatio(
      order.amountIn,
      tokenInMeta,
      order.minAmountOut,
      tokenOutMeta,
      12
    );

  } else if (stableQuotes.has(tokenOutSymbol)) {
    quoteSymbol = tokenOutSymbol;
    baseSymbol = tokenInSymbol;

    quotePerBaseText = formatRawTokenRatio(
      order.minAmountOut,
      tokenOutMeta,
      order.amountIn,
      tokenInMeta,
      12
    );

  } else {
    // For older non-stable pairs, infer the quote asset using
    // their current indicative USDT prices.
    const inUsdt = getTokenUsdtPrice(tokenInSymbol);
    const outUsdt = getTokenUsdtPrice(tokenOutSymbol);

    if (
      !Number.isFinite(inUsdt) ||
      inUsdt <= 0 ||
      !Number.isFinite(outUsdt) ||
      outUsdt <= 0
    ) {
      return "USD entry unavailable";
    }

    if (inUsdt <= outUsdt) {
      quoteSymbol = tokenInSymbol;
      baseSymbol = tokenOutSymbol;

      quotePerBaseText = formatRawTokenRatio(
        order.amountIn,
        tokenInMeta,
        order.minAmountOut,
        tokenOutMeta,
        12
      );

    } else {
      quoteSymbol = tokenOutSymbol;
      baseSymbol = tokenInSymbol;

      quotePerBaseText = formatRawTokenRatio(
        order.minAmountOut,
        tokenOutMeta,
        order.amountIn,
        tokenInMeta,
        12
      );
    }
  }

  const quotePerBase = Number(quotePerBaseText);
  const quotePriceUsdt = getTokenUsdtPrice(quoteSymbol);

  if (
    !Number.isFinite(quotePerBase) ||
    quotePerBase <= 0 ||
    !Number.isFinite(quotePriceUsdt) ||
    quotePriceUsdt <= 0
  ) {
    return "USD entry unavailable";
  }

  const approximateUsdtPrice =
    quotePerBase * quotePriceUsdt;

  return (
    ` ${formatUsdtEntryPrice(approximateUsdtPrice)} USDT / ` +
    `${baseSymbol}`
  );
}

const ORDER_PAGE_SIZE = 10;
const ORDER_EVENT_SCAN_CHUNK = 2000;

let orderPaginationState = {
  wallet: "",
  pageIndex: 0,
  events: [],
  cursorBlock: null,
  exhausted: false,
  loading: false
};

function resetOrderPagination(wallet = walletAccount || "") {
  orderPaginationState = {
    wallet: String(wallet).toLowerCase(),
    pageIndex: 0,
    events: [],
    cursorBlock: null,
    exhausted: false,
    loading: false
  };
}

function ensureOrderPaginationElement() {
  const body = $("orderRows");
  if (!body) return null;

  let element = $("ordersPagination");
  if (element) return element;

  const anchor = body.closest(".scroll") || body.parentElement;
  if (!anchor) return null;

  element = document.createElement("div");
  element.id = "ordersPagination";
  element.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:12px",
    "flex-wrap:wrap",
    "padding:12px 2px 2px",
    "font-size:12px",
    "color:var(--muted, #9aa4b2)"
  ].join(";");

  anchor.insertAdjacentElement("afterend", element);
  return element;
}

function renderOrderPagination(hasPrevious, hasNext, count = 0, loading = false) {
  const element = ensureOrderPaginationElement();
  if (!element) return;

  if (
    !walletAccount ||
    (!loading &&
      count === 0 &&
      orderPaginationState.events.length === 0 &&
      orderPaginationState.exhausted)
  ) {
    element.hidden = true;
    element.innerHTML = "";
    return;
  }

  element.hidden = false;

  const first = orderPaginationState.pageIndex * ORDER_PAGE_SIZE + 1;
  const last = first + Math.max(0, count - 1);

  const summary = loading
    ? "Loading orders..."
    : count
      ? `Showing ${first}-${last}`
      : "No orders on this page";

  element.innerHTML = `
    <span>${summary} | Page ${orderPaginationState.pageIndex + 1}</span>
    <div style="display:flex;gap:8px">
      <button type="button" class="btn" id="ordersPreviousPage"
        ${!hasPrevious || loading ? "disabled" : ""}>Previous</button>
      <button type="button" class="btn" id="ordersNextPage"
        ${!hasNext || loading ? "disabled" : ""}>Next</button>
    </div>
  `;

  const previous = $("ordersPreviousPage");
  const next = $("ordersNextPage");

  if (previous) {
    previous.addEventListener("click", () => {
      if (orderPaginationState.loading || orderPaginationState.pageIndex <= 0) return;

      orderPaginationState.pageIndex -= 1;
      void loadMyOrders(false);
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      if (orderPaginationState.loading) return;

      orderPaginationState.pageIndex += 1;
      void loadMyOrders(false);
    });
  }
}

async function ensureOrderEvents(requiredCount, sources) {
  if (orderPaginationState.cursorBlock === null) {
    orderPaginationState.cursorBlock = await rpc.getBlockNumber();
  }

  const deploymentBlocks = sources.map(source =>
    Math.max(0, Math.floor(Number(source.config?.deploymentBlock || 0)))
  );

  const earliestDeploymentBlock = deploymentBlocks.length
    ? Math.min(...deploymentBlocks)
    : 0;

  const ownerTopic = ethers.zeroPadValue(
    ethers.getAddress(walletAccount),
    32
  );

  while (
    orderPaginationState.events.length < requiredCount &&
    !orderPaginationState.exhausted
  ) {
    const toBlock = orderPaginationState.cursorBlock;

    if (toBlock < earliestDeploymentBlock) {
      orderPaginationState.exhausted = true;
      break;
    }

    const fromBlock = Math.max(
      earliestDeploymentBlock,
      toBlock - ORDER_EVENT_SCAN_CHUNK + 1
    );

    const groups = await Promise.all(sources.map(async source => {
      const deploymentBlock = Math.max(
        0,
        Math.floor(Number(source.config?.deploymentBlock || 0))
      );

      const queryFrom = Math.max(fromBlock, deploymentBlock);
      if (queryFrom > toBlock) return [];

      const iface = new ethers.Interface(source.abi);
      const eventFragment = iface.getEvent("OrderCreated");

      if (!eventFragment) {
        throw new Error("OrderCreated event is missing from the Order Book ABI.");
      }

      const logs = await rpc.getLogs({
        address: source.address,
        topics: [eventFragment.topicHash, null, ownerTopic],
        fromBlock: queryFrom,
        toBlock
      });

      return logs.flatMap(log => {
        try {
          const parsed = iface.parseLog({
            topics: log.topics,
            data: log.data
          });

          if (!parsed || parsed.name !== "OrderCreated") return [];

          return [{
            source,
            event: {
              args: parsed.args,
              blockNumber: Number(log.blockNumber),
              index: Number(log.index ?? log.logIndex ?? 0),
              transactionIndex: Number(log.transactionIndex ?? 0),
              transactionHash: log.transactionHash
            }
          }];
        } catch (error) {
          console.warn("Could not decode OrderCreated event:", error);
          return [];
        }
      });
    }));

    orderPaginationState.events.push(...groups.flat());

    orderPaginationState.events.sort((a, b) =>
      Number(b.event.blockNumber) - Number(a.event.blockNumber) ||
      Number(b.event.transactionIndex || 0) - Number(a.event.transactionIndex || 0) ||
      Number(b.event.index || 0) - Number(a.event.index || 0)
    );

    orderPaginationState.cursorBlock = fromBlock - 1;

    if (fromBlock <= earliestDeploymentBlock) {
      orderPaginationState.exhausted = true;
    }
  }
}

async function loadMyOrders(reset = false) {
  const body = $("orderRows");

  if (!walletAccount) {
    resetOrderPagination("");
    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Connected QMSwap wallet not detected.
      </td></tr>
    `;
    renderOrderPagination(false, false, 0);
    return;
  }

  const walletKey = String(walletAccount).toLowerCase();

  if (reset || orderPaginationState.wallet !== walletKey) {
    resetOrderPagination(walletKey);
  }

  if (orderPaginationState.loading) return;
  orderPaginationState.loading = true;

  body.innerHTML = `
    <tr><td colspan="6" class="empty">
      Loading the latest 10 orders...
    </td></tr>
  `;

  renderOrderPagination(
    orderPaginationState.pageIndex > 0,
    false,
    0,
    true
  );

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

    const offset = orderPaginationState.pageIndex * ORDER_PAGE_SIZE;
    const requiredCount = offset + ORDER_PAGE_SIZE + 1;

    await ensureOrderEvents(requiredCount, sources);

    const records = orderPaginationState.events.slice(
      offset,
      offset + ORDER_PAGE_SIZE
    );

    const hasPrevious = orderPaginationState.pageIndex > 0;
    const hasNext =
      orderPaginationState.events.length > offset + ORDER_PAGE_SIZE;

    const heading = $("ordersHeading");
    const description = $("ordersDescription");

    if (heading) heading.textContent = "My Orders";
    if (description) {
      description.textContent =
        "Orders created by your connected QMSwap wallet.";
    }

    if (!records.length) {
      body.innerHTML = `
        <tr><td colspan="6" class="empty">
          You have no limit orders yet.
        </td></tr>
      `;
      orderPaginationState.exhausted = true;
      renderOrderPagination(false, false, 0);
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
        let quoteOutRaw = null;
        let quoteError = "";

        try {
          if (source.version === "v2" && legacyRouterRead) {
            quoteOutRaw = await legacyRouterRead.quoteOut(
              order.tokenIn,
              order.tokenOut,
              order.amountIn
            );

            executable = quoteOutRaw >= order.minAmountOut;

          } else if (source.version === "v3" && routerRead) {
            const orderPath = Array.from(order.path || []);

            if (orderPath.length >= 2) {
              const amounts = await routerRead.getAmountsOut(
                order.amountIn,
                orderPath
              );

              quoteOutRaw = amounts[amounts.length - 1];
              executable = quoteOutRaw >= order.minAmountOut;
            }
          }
        } catch (error) {
          quoteError =
            error?.shortMessage ||
            error?.reason ||
            error?.message ||
            String(error);

          executable = false;
        }

        console.info("[QMSwap Limit Order Diagnostic]", {
          version: source.version,
          orderId: String(id),
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          path: Array.from(order.path || []),
          amountInRaw: String(order.amountIn),
          quoteOutRaw:
            quoteOutRaw === null ? null : String(quoteOutRaw),
          minAmountOutRaw: String(order.minAmountOut),
          tokenOutSymbol,
          tokenOutDecimals: tokenOutMeta.decimals,
          executable,
          routerReadAvailable: Boolean(routerRead),
          error: quoteError || null
        });

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
        : "Legacy direct route";

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
    renderOrderPagination(hasPrevious, hasNext, records.length);
  } catch (error) {
    console.error("My Orders loading failed:", error);

    body.innerHTML = `
      <tr><td colspan="6" class="empty">
        Could not load your orders:
        ${esc(error?.shortMessage || error?.message || "RPC error")}
      </td></tr>
    `;
    renderOrderPagination(orderPaginationState.pageIndex > 0, false, 0);
  } finally {
    orderPaginationState.loading = false;
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
    `${version.toUpperCase()} transaction submitted: ${compactAddress(tx.hash)}`,
    "warn"
  );

  await tx.wait();

  setOrderStatus("Order transaction confirmed.", "success");

  void loadMyOrders().catch(error => {
    console.warn("Order history load failed:", error);
  });

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
      await loadMyOrders(true);
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
  enforceUsdtQuoteOnly();

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

  // Discover Order Books in the background so Market prices and the chart
  // can render without waiting for extra contract/code checks.
  void loadOrderBookDeployment()
    .then(() => {
      if (walletAccount) {
        void loadMyOrders().catch(error => {
          console.warn("Order history load after deployment discovery failed:", error);
        });
      }
    })
    .catch(error => {
      console.warn("Order Book discovery failed:", error);
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

  void loadMyOrders().catch(error => {
    console.warn("Order history load failed:", error);
  });

  await refreshMarket();

  if (marketRefreshTimer !== null) {
    clearInterval(marketRefreshTimer);
  }

  marketRefreshTimer = setInterval(async () => {
    await refreshMarket();

    if (walletAccount && (orderBookAddress || legacyOrderBookAddress)) {
      void loadMyOrders().catch(error => {
        console.warn("Periodic order-state refresh failed:", error);
      });
    }
  }, 60000);
}

