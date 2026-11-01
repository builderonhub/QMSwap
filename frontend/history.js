"use strict";

const EXPLORER = "https://testnet.qmsscan.io";
const API_BASE = `${EXPLORER}/api/v2`;
const CHAIN_ID = "0x4c18";
const PAGE_SIZE = 25;

const $ = id => document.getElementById(id);

const DATASETS = {
  transactions: {
    endpoint: "transactions",
    title: "Transactions",
    rows: [],
    next: null,
    loaded: false,
    page: 0
  },
  "token-transfers": {
    endpoint: "token-transfers",
    title: "Token Transfers",
    rows: [],
    next: null,
    loaded: false,
    page: 0
  },
  "internal-transactions": {
    endpoint: "internal-transactions",
    title: "Internal Transactions",
    rows: [],
    next: null,
    loaded: false,
    page: 0
  }
};

let activeTab = "transactions";
let account = "";
let injectedWallet = null;
let loading = false;
let localSwapRows = [];

let walletOverviewState = {
  status: "idle",
  wallet: "",
  totalTransactions: null,
  contractsInteracted: null,
  tokenContractsHeld: null,
  totalGasWei: null,
  outgoingTransactions: 0,
  gasFeeRecords: 0,
  firstActivityMs: null,
  pagesScanned: 0,
  scanComplete: false,
  tokenBalancesLoaded: false,
  error: ""
};

let walletOverviewRequestId = 0;
const WALLET_OVERVIEW_MAX_PAGES = 1000;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function shorten(value) {
  if (!value) return "—";
  const text = String(value);
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}

function entityAddress(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.hash || value.address_hash || "";
}

function formatRaw(value, decimals = 18, maxFraction = 6) {
  try {
    if (value === null || value === undefined || value === "") return "0";

    const raw = BigInt(value);
    const negative = raw < 0n;
    const amount = negative ? -raw : raw;
    const scale = 10n ** BigInt(decimals);
    const whole = (amount / scale).toString();
    const remainder = (amount % scale).toString().padStart(decimals, "0");
    const fraction = remainder.slice(0, maxFraction).replace(/0+$/, "");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return `${negative ? "-" : ""}${grouped}${fraction ? "." + fraction : ""}`;
  } catch {
    return "—";
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}


const LOCAL_SWAP_HISTORY_PREFIX = "qmswap.tradeHistory.v1";

function localSwapStorageKey(wallet = account) {
  if (!wallet) return "";

  return `${LOCAL_SWAP_HISTORY_PREFIX}:${BigInt(CHAIN_ID).toString()}:${String(wallet).toLowerCase()}`;
}

function loadLocalSwapHistory() {
  localSwapRows = [];

  if (!account) return;

  try {
    const storageKey = localSwapStorageKey(account);
    const records = JSON.parse(localStorage.getItem(storageKey) || "[]");

    if (!Array.isArray(records)) return;

    const seen = new Set();

    localSwapRows = records
      .filter(record => {
        if (!record || typeof record !== "object") return false;

        const hash = String(record.hash || "").toLowerCase();

        if (!/^0x[0-9a-f]{64}$/.test(hash)) return false;
        if (seen.has(hash)) return false;

        if (String(record.chainId) !== BigInt(CHAIN_ID).toString()) return false;
        if (String(record.wallet || "").toLowerCase() !== account.toLowerCase()) return false;
        if (record.receiptVerified !== true) return false;

        seen.add(hash);
        return true;
      })
      .map(record => ({
        ...record,
        qmswapLocal: true
      }))
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  } catch (error) {
    console.warn("Local QMSwap history could not be loaded:", error);
    localSwapRows = [];
  }
}

function timestampMs(value) {
  if (value === null || value === undefined || value === "") return NaN;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    return numeric < 1000000000000 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatSignedBps(value) {
  try {
    const bps = BigInt(value);
    const negative = bps < 0n;
    const absolute = negative ? -bps : bps;
    const percentage = (Number(absolute) / 100).toFixed(2);

    return `${negative ? "-" : bps > 0n ? "+" : ""}${percentage}%`;
  } catch {
    return "Unavailable";
  }
}

function getActiveRows() {
  const explorerRows = activeDataset().rows;

  if (activeTab !== "transactions" || !localSwapRows.length) {
    return explorerRows;
  }

  const localHashes = new Set(
    localSwapRows.map(item => String(item.hash).toLowerCase())
  );

  const uniqueExplorerRows = explorerRows.filter(item =>
    !localHashes.has(String(itemHash(item)).toLowerCase())
  );

  return [...localSwapRows, ...uniqueExplorerRows].sort(
    (a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp)
  );
}


const QWAP_ROUTER_HISTORY_ADDRESS =
  "0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619";

function decodedParameter(transaction, parameterName) {
  const parameters = transaction.decoded_input?.parameters;

  if (!Array.isArray(parameters)) return null;

  const found = parameters.find(
    parameter => parameter.name === parameterName
  );

  return found ? found.value : null;
}

function transferTokenAddress(transfer) {
  return String(
    transfer?.token?.address_hash ||
    transfer?.token?.address ||
    ""
  ).toLowerCase();
}

function transferWalletAddress(value) {
  return String(entityAddress(value) || "").toLowerCase();
}

function safeTokenDecimals(value) {
  const decimals = Number(value ?? 18);

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Explorer returned invalid token decimals.");
  }

  return decimals;
}

async function importHistoricalSwap() {
  if (!account) {
    setStatus("Connect your wallet before importing a historical swap.", "warn");
    return;
  }

  if (!injectedWallet) {
    setStatus("Wallet provider is unavailable.", "error");
    return;
  }

  const button = $("importSwapBtn");
  const input = $("importSwapHash");

  const hash = String(input.value || "").trim();

  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    setStatus("Enter a valid 32-byte transaction hash.", "warn");
    return;
  }

  if (button) button.disabled = true;

  try {
    const chainId = await injectedWallet.request({
      method: "eth_chainId"
    });

    if (String(chainId).toLowerCase() !== CHAIN_ID.toLowerCase()) {
      throw new Error("Switch your wallet to QMS Testnet before importing.");
    }

    const storageKey = localSwapStorageKey(account);

    if (!storageKey) {
      throw new Error("Could not identify the selected wallet.");
    }

    const response = await fetch(
      `${API_BASE}/transactions/${encodeURIComponent(hash)}`,
      {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`QMSScan returned HTTP ${response.status}.`);
    }

    const payload = await response.json();

    const transaction =
      payload.transaction ||
      (payload.result && payload.result.hash ? payload.result : payload);

    if (
      !transaction ||
      String(transaction.hash || "").toLowerCase() !== hash.toLowerCase()
    ) {
      throw new Error("Explorer response does not match the requested transaction hash.");
    }

    const sender = transferWalletAddress(transaction.from);
    const recipient = String(account).toLowerCase();
    const router = transferWalletAddress(transaction.to);

    if (sender !== recipient) {
      throw new Error("This transaction does not belong to the connected wallet.");
    }

    if (router !== QWAP_ROUTER_HISTORY_ADDRESS.toLowerCase()) {
      throw new Error("This transaction was not sent to the configured QWAP Router.");
    }

    const method = String(
      transaction.method ||
      transaction.decoded_input?.method_call ||
      ""
    ).toLowerCase();

    if (!method.includes("swapexacttokensfortokens")) {
      throw new Error(
        "This importer currently supports historical ERC20-to-ERC20 QWAP swaps only."
      );
    }

    const statusValue = String(
      transaction.status || transaction.result || ""
    ).toLowerCase();

    if (!["ok", "success", "confirmed"].includes(statusValue)) {
      throw new Error("The historical transaction is not confirmed successfully.");
    }

    if (!transaction.block_number) {
      throw new Error("Confirmed block information is missing.");
    }

    const path = decodedParameter(transaction, "path");
    const inputAmount = decodedParameter(transaction, "amountIn");
    const minimumOutput = decodedParameter(transaction, "amountOutMin");

    if (
      !Array.isArray(path) ||
      path.length < 2 ||
      !ethers.isAddress(path[0]) ||
      !ethers.isAddress(path[path.length - 1])
    ) {
      throw new Error("Explorer did not provide a valid swap token path.");
    }

    if (inputAmount === null || minimumOutput === null) {
      throw new Error("Explorer did not provide the decoded swap amounts.");
    }

    const inputTokenAddress = String(path[0]).toLowerCase();
    const outputTokenAddress = String(path[path.length - 1]).toLowerCase();

    const transfers = Array.isArray(transaction.token_transfers)
      ? transaction.token_transfers
      : [];

    const inputTransfer = transfers.find(transfer =>
      transferTokenAddress(transfer) === inputTokenAddress &&
      transferWalletAddress(transfer.from) === recipient
    );

    if (!inputTransfer) {
      throw new Error("The input token transfer was not found in explorer logs.");
    }

    const outputTransfers = transfers.filter(transfer =>
      transferTokenAddress(transfer) === outputTokenAddress &&
      transferWalletAddress(transfer.to) === recipient
    );

    if (!outputTransfers.length) {
      throw new Error("The actual output token transfer to this wallet was not found.");
    }

    const inputToken = inputTransfer.token || {};
    const outputToken = outputTransfers[0].token || {};

    const inputDecimals = safeTokenDecimals(
      inputTransfer.total?.decimals ?? inputToken.decimals
    );

    const outputDecimals = safeTokenDecimals(
      outputTransfers[0].total?.decimals ?? outputToken.decimals
    );

    let actualReceivedRaw = 0n;

    for (const transfer of outputTransfers) {
      actualReceivedRaw += BigInt(
        transfer.total?.value ?? transfer.amount ?? "0"
      );
    }

    if (actualReceivedRaw <= 0n) {
      throw new Error("Actual output transfer amount is zero or unavailable.");
    }

    const amountInRaw = BigInt(inputAmount);

    if (amountInRaw <= 0n) {
      throw new Error("Decoded input amount is invalid.");
    }

    let actualGasFeeWei = null;

    if (
      transaction.fee &&
      transaction.fee.value !== null &&
      transaction.fee.value !== undefined
    ) {
      actualGasFeeWei = BigInt(transaction.fee.value);
    } else if (
      transaction.gas_used !== null &&
      transaction.gas_used !== undefined &&
      transaction.gas_price !== null &&
      transaction.gas_price !== undefined
    ) {
      actualGasFeeWei =
        BigInt(transaction.gas_used) *
        BigInt(transaction.gas_price);
    }

    const record = {
      schemaVersion: 1,
      chainId: BigInt(CHAIN_ID).toString(),
      wallet: recipient,
      hash: hash.toLowerCase(),
      status: "success",
      fromKey: String(inputToken.symbol || "TOKEN"),
      toKey: String(outputToken.symbol || "TOKEN"),
      fromSymbol: String(inputToken.symbol || "TOKEN"),
      outputSymbol: String(outputToken.symbol || "TOKEN"),
      inputDecimals,
      outputDecimals,
      amountInRaw: String(amountInRaw),
      expectedAmountOutRaw: null,
      minimumReceivedRaw: String(BigInt(minimumOutput)),
      actualReceivedRaw: String(actualReceivedRaw),
      actualOutputVerified: true,
      actualGasFeeWei:
        actualGasFeeWei !== null ? String(actualGasFeeWei) : null,
      estimatedGasWei: "0",
      actualOutputDeviationBps: null,
      gasEstimateDifferenceBps: null,
      blockNumber: String(transaction.block_number),
      timestamp: transaction.timestamp || "",
      timestampSource: "qmscan-transaction-details",
      venue: "QWAP",
      receiptVerified: true,
      verificationSource: "qmscan-transaction-details"
    };

    let existing = [];

    try {
      existing = JSON.parse(localStorage.getItem(storageKey) || "[]");

      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }

    const existingIndex = existing.findIndex(item =>
      String(item.hash || "").toLowerCase() === hash.toLowerCase()
    );

    if (existingIndex >= 0) {
      existing[existingIndex] = {
        ...existing[existingIndex],
        ...record
      };
    } else {
      existing.unshift(record);
    }

    existing.sort((a, b) => {
      const dateA = timestampMs(a.timestamp) || 0;
      const dateB = timestampMs(b.timestamp) || 0;
      return dateB - dateA;
    });

    existing = existing.slice(0, 500);

    localStorage.setItem(storageKey, JSON.stringify(existing));

    loadLocalSwapHistory();
    render();

    input.value = "";

    setStatus(
      "Historical QWAP swap imported and verified from QMSScan transaction details. Existing transaction hashes are not duplicated.",
      "success"
    );
  } catch (error) {
    console.error("Historical swap import failed:", error);
    setStatus(
      `Historical swap import failed: ${error?.message || String(error)}`,
      "error"
    );
  } finally {
    if (button) button.disabled = false;
  }
}
function walletTimestampMs(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric < 1000000000000 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatQmsWei(value) {
  try {
    const raw = BigInt(value);
    const negative = raw < 0n;
    const amount = negative ? -raw : raw;

    // Round to four decimal places without floating-point arithmetic.
    const divisor = 10n ** 14n;
    const rounded = (amount + divisor / 2n) / divisor;

    // Preserve visibility of very small non-zero fees.
    if (amount > 0n && rounded === 0n) {
      return negative ? ">-0.0001" : "<0.0001";
    }

    const whole = (rounded / 10000n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    const fraction = (rounded % 10000n)
      .toString()
      .padStart(4, "0")
      .replace(/0+$/, "");

    return `${negative ? "-" : ""}${whole}${fraction ? "." + fraction : ""}`;
  } catch {
    return "Unavailable";
  }
}

function updateWalletOverviewCard(id, value, noteId, note) {
  const element = $(id);
  const noteElement = $(noteId);

  if (element) element.textContent = value;
  if (noteElement) noteElement.textContent = note;
}

async function fetchWalletApiJson(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`QMSScan returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function scanWalletTransactions(wallet, requestId) {
  const contractSet = new Set();
  const transactionSet = new Set();

  let totalGasWei = 0n;
  let outgoingTransactions = 0;
  let gasFeeRecords = 0;
  let firstActivityMs = null;
  let pageCount = 0;
  let next = null;
  let complete = false;

  const walletLower = wallet.toLowerCase();

  const baseUrl =
    `${API_BASE}/addresses/${encodeURIComponent(wallet)}/transactions`;

  while (pageCount < WALLET_OVERVIEW_MAX_PAGES) {
    if (requestId !== walletOverviewRequestId) return null;

    const params = new URLSearchParams();

    if (next) {
      for (const [key, value] of Object.entries(next)) {
        if (value !== null && value !== undefined) {
          params.set(key, String(value));
        }
      }
    } else {
      params.set("items_count", "50");
    }

    const page = await fetchWalletApiJson(
      `${baseUrl}?${params.toString()}`
    );

    if (!Array.isArray(page.items)) {
      throw new Error("QMSScan returned an invalid transaction page.");
    }

    pageCount++;

    for (const tx of page.items) {
      const hash = String(itemHash(tx) || "").toLowerCase();

      if (hash && transactionSet.has(hash)) continue;
      if (hash) transactionSet.add(hash);

      const timestamp = walletTimestampMs(tx.timestamp);

      if (
        timestamp !== null &&
        (firstActivityMs === null || timestamp < firstActivityMs)
      ) {
        firstActivityMs = timestamp;
      }

      const sender = entityAddress(tx.from).toLowerCase();

      if (sender !== walletLower) continue;

      outgoingTransactions++;

      let feeWei = null;

      try {
        if (
          tx.fee &&
          typeof tx.fee === "object" &&
          tx.fee.value !== undefined
        ) {
          feeWei = BigInt(tx.fee.value);
        } else if (
          tx.fee !== null &&
          tx.fee !== undefined &&
          typeof tx.fee !== "object"
        ) {
          feeWei = BigInt(tx.fee);
        } else if (
          tx.gas_used !== null &&
          tx.gas_used !== undefined &&
          tx.gas_price !== null &&
          tx.gas_price !== undefined
        ) {
          feeWei =
            BigInt(tx.gas_used) * BigInt(tx.gas_price);
        }
      } catch {
        feeWei = null;
      }

      if (feeWei !== null && feeWei >= 0n) {
        totalGasWei += feeWei;
        gasFeeRecords++;
      }

      const target = tx.to || {};
      const targetAddress = entityAddress(target);

      if (
        targetAddress &&
        (
          target.is_contract === true ||
          String(target.is_contract).toLowerCase() === "true"
        )
      ) {
        contractSet.add(targetAddress.toLowerCase());
      }

      const createdAddress = entityAddress(tx.created_contract);

      if (createdAddress) {
        contractSet.add(createdAddress.toLowerCase());
      }
    }

    next = page.next_page_params || null;

    if (
      !next ||
      typeof next !== "object" ||
      Object.keys(next).length === 0
    ) {
      complete = true;
      break;
    }
  }

  return {
    totalTransactionsScanned: transactionSet.size,
    contractsInteracted: contractSet.size,
    totalGasWei,
    outgoingTransactions,
    gasFeeRecords,
    firstActivityMs,
    pagesScanned: pageCount,
    complete
  };
}

async function loadWalletOverview(force = false) {
  if (!account) return;

  const wallet = account.toLowerCase();

  if (
    !force &&
    walletOverviewState.wallet === wallet &&
    walletOverviewState.status !== "idle"
  ) {
    return;
  }

  const requestId = ++walletOverviewRequestId;

  walletOverviewState = {
    status: "loading",
    wallet,
    totalTransactions: null,
    contractsInteracted: null,
    tokenContractsHeld: null,
    totalGasWei: null,
    outgoingTransactions: 0,
    gasFeeRecords: 0,
    firstActivityMs: null,
    pagesScanned: 0,
    scanComplete: false,
    tokenBalancesLoaded: false,
    error: ""
  };

  renderTradeAnalytics();

  const baseUrl =
    `${API_BASE}/addresses/${encodeURIComponent(wallet)}`;

  const [counterResult, balanceResult, scanResult] =
    await Promise.allSettled([
      fetchWalletApiJson(`${baseUrl}/counters`),
      fetchWalletApiJson(`${baseUrl}/token-balances`),
      scanWalletTransactions(wallet, requestId)
    ]);

  if (requestId !== walletOverviewRequestId) return;

  const result = {
    status: "partial",
    wallet,
    totalTransactions: null,
    contractsInteracted: null,
    tokenContractsHeld: null,
    totalGasWei: null,
    outgoingTransactions: 0,
    gasFeeRecords: 0,
    firstActivityMs: null,
    pagesScanned: 0,
    scanComplete: false,
    tokenBalancesLoaded: false,
    error: ""
  };

  if (counterResult.status === "fulfilled") {
    const counters = counterResult.value;

    const count =
      counters.transactions_count ??
      counters.transaction_count ??
      counters.transactionsCount;

    if (
      count !== null &&
      count !== undefined &&
      /^\d+$/.test(String(count))
    ) {
      result.totalTransactions = String(count);
    }
  } else {
    result.error = counterResult.reason?.message || "Address counter unavailable.";
  }

  if (balanceResult.status === "fulfilled") {
    const payload = balanceResult.value;

    const balances = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : null;

    if (balances) {
      const tokenAddresses = new Set();

      for (const item of balances) {
        const token = item.token || {};

        if (
          token.type &&
          String(token.type).toUpperCase() !== "ERC-20"
        ) {
          continue;
        }

        const address = String(
          token.address_hash || token.address || ""
        ).toLowerCase();

        if (!/^0x[0-9a-f]{40}$/.test(address)) continue;

        try {
          if (BigInt(item.value ?? "0") > 0n) {
            tokenAddresses.add(address);
          }
        } catch {}
      }

      result.tokenContractsHeld = tokenAddresses.size;
      result.tokenBalancesLoaded = true;
    }
  } else {
    result.error = balanceResult.reason?.message || result.error;
  }

  if (scanResult.status === "fulfilled" && scanResult.value) {
    const scan = scanResult.value;

    result.contractsInteracted = scan.complete
      ? scan.contractsInteracted
      : null;

    result.totalGasWei =
      scan.complete && scan.gasFeeRecords === scan.outgoingTransactions
        ? scan.totalGasWei.toString()
        : null;

    result.outgoingTransactions = scan.outgoingTransactions;
    result.gasFeeRecords = scan.gasFeeRecords;
    result.firstActivityMs = scan.firstActivityMs;
    result.pagesScanned = scan.pagesScanned;
    result.scanComplete = scan.complete;
  } else if (scanResult.status === "rejected") {
    result.error = scanResult.reason?.message || result.error;
  }

  result.status =
    result.scanComplete &&
    result.tokenBalancesLoaded &&
    result.totalTransactions !== null
      ? "complete"
      : "partial";

  walletOverviewState = result;

  renderTradeAnalytics();
}
function renderTradeAnalytics() {
  const panel = $("tradeAnalytics");
  if (!panel) return;

  panel.hidden = !account;

  if (!account) return;

  const wallet = account.toLowerCase();

  if (
    walletOverviewState.wallet !== wallet ||
    walletOverviewState.status === "idle"
  ) {
    void loadWalletOverview();
    return;
  }

  const data = walletOverviewState;

  if (data.status === "loading") {
    updateWalletOverviewCard(
      "statTotalTransactions", "Loading...",
      "statTransactionNote", "Reading QMSScan address counters"
    );

    updateWalletOverviewCard(
      "statContractsInteracted", "Loading...",
      "statContractsNote", "Scanning contract interactions"
    );

    updateWalletOverviewCard(
      "statTokenContractsHeld", "Loading...",
      "statTokenContractsNote", "Reading positive token balances"
    );

    updateWalletOverviewCard(
      "statGasSpent", "Loading...",
      "statGasNote", "Summing outgoing transaction fees"
    );

    updateWalletOverviewCard(
      "statWalletAge", "Loading...",
      "statWalletAgeNote", "Finding first on-chain activity"
    );

    return;
  }

  updateWalletOverviewCard(
    "statTotalTransactions",
    data.totalTransactions !== null
      ? BigInt(data.totalTransactions).toLocaleString()
      : "Unavailable",
    "statTransactionNote",
    data.totalTransactions !== null
      ? "QMSScan address transaction counter"
      : "Address counter unavailable"
  );

  updateWalletOverviewCard(
    "statContractsInteracted",
    data.contractsInteracted !== null
      ? data.contractsInteracted.toLocaleString()
      : "Incomplete",
    "statContractsNote",
    data.scanComplete
      ? "Unique contract addresses called or created"
      : "Full transaction scan not completed"
  );

  updateWalletOverviewCard(
    "statTokenContractsHeld",
    data.tokenContractsHeld !== null
      ? data.tokenContractsHeld.toLocaleString()
      : "Unavailable",
    "statTokenContractsNote",
    data.tokenBalancesLoaded
      ? "ERC-20 contracts with positive balances"
      : "Token balance data unavailable"
  );

  let gasValue = "Unavailable";
  let gasNote = "Actual outgoing transaction fees";

  if (data.totalGasWei !== null) {
    gasValue = `${formatQmsWei(data.totalGasWei)} QMS`;
    gasNote =
      `Fees verified for ${data.gasFeeRecords.toLocaleString()} / ` +
      `${data.outgoingTransactions.toLocaleString()} outgoing transactions`;
  } else if (data.scanComplete) {
    gasValue = "Incomplete";
    gasNote =
      `Fee data incomplete: ${data.gasFeeRecords.toLocaleString()} / ` +
      `${data.outgoingTransactions.toLocaleString()} outgoing transactions`;
  } else {
    gasNote = "Full transaction scan not completed";
  }

  updateWalletOverviewCard(
    "statGasSpent",
    gasValue,
    "statGasNote",
    gasNote
  );

  let ageValue = "Unavailable";
  let ageNote = "First transaction date unavailable";

  if (data.scanComplete && data.firstActivityMs !== null) {
    const firstDate = new Date(data.firstActivityMs);

    const ageDays = Math.max(
      0,
      Math.floor((Date.now() - data.firstActivityMs) / 86400000)
    );

    ageValue = ageDays === 1
      ? "1 day"
      : `${ageDays.toLocaleString()} days`;

    ageNote = "First activity: " +
      firstDate.toLocaleDateString();
  }

  updateWalletOverviewCard(
    "statWalletAge",
    ageValue,
    "statWalletAgeNote",
    ageNote
  );
}

function renderLocalSwapRow(item) {
  const status = statusFor(item, "transactions");

  const statusClass = status === "Success"
    ? "success"
    : status === "Failed"
      ? "failed"
      : "pending";

  const block = item.blockNumber ?? "—";

  const safeBlock = /^\d+$/.test(String(block))
    ? `<a class="address-link" href="${EXPLORER}/block/${encodeURIComponent(block)}" target="_blank" rel="noopener noreferrer">#${esc(block)}</a>`
    : "—";

  const hash = String(item.hash || "");

  const txLink = /^0x[0-9a-fA-F]{64}$/.test(hash)
    ? `<a class="tx-link hash" href="${EXPLORER}/tx/${encodeURIComponent(hash)}" target="_blank" rel="noopener noreferrer">${esc(shorten(hash))} ↗</a>`
    : '<span class="muted">Unavailable</span>';

  const actualOutput = item.actualReceivedRaw !== null
    ? `${formatRaw(item.actualReceivedRaw, Number(item.outputDecimals || 18), 8)} ${esc(item.outputSymbol || item.toKey)}`
    : "Not verified";

  const inputAmount =
    `${formatRaw(item.amountInRaw, Number(item.inputDecimals || 18), 8)} ${esc(item.fromSymbol || item.fromKey)}`;

  const gasFee = item.actualGasFeeWei !== null
    ? `${formatRaw(item.actualGasFeeWei, 18, 18)} QMS`
    : "Unavailable";

  const deviation = item.actualOutputDeviationBps !== null
    ? formatSignedBps(item.actualOutputDeviationBps)
    : "Unavailable";

  return `
    <tr>
      <td>
        <div>${esc(formatDate(item.timestamp))}</div>
        <div class="sub-label">Block ${safeBlock}</div>
      </td>
      <td>
        <div class="main-label">Swap · ${esc(item.fromSymbol || item.fromKey)} → ${esc(item.outputSymbol || item.toKey)}</div>
        <div class="sub-label">QMSwap verified receipt · ${esc(item.venue || "QWAP")}</div>
      </td>
      <td>
        <div class="main-label">${actualOutput}</div>
        <div class="sub-label">Input: ${inputAmount} · Gas: ${gasFee} · Δ ${esc(deviation)}</div>
      </td>
      <td>
        <div>${explorerAddress(item.wallet)}</div>
        <div class="sub-label">QMSwap transaction</div>
      </td>
      <td><span class="badge ${statusClass}">${esc(status)}</span></td>
      <td>${txLink}</td>
    </tr>`;
}
function setStatus(message, tone = "") {
  $("status").textContent = message;
  $("status").dataset.tone = tone;
}

function activeDataset() {
  return DATASETS[activeTab];
}

function getWalletProvider() {
  if (window.okxwallet && typeof window.okxwallet.request === "function") {
    return window.okxwallet;
  }
  if (window.ethereum && typeof window.ethereum.request === "function") {
    return window.ethereum;
  }
  return null;
}

function updateWalletUI() {
  $("walletAddress").textContent = account || "Not connected";
  $("connectBtn").textContent = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : "Connect Wallet";

  if (account) {
    $("addressLink").href = `${EXPLORER}/address/${encodeURIComponent(account)}`;
    $("addressLink").hidden = false;
  } else {
    $("addressLink").hidden = true;
  }
}

function statusFor(item, type) {
  if (item.qmswapLocal) {
    return item.status === "success" ? "Success"
      : item.status === "failed" ? "Failed"
      : "Pending";
  }

  if (type === "token-transfers") return "Success";

  const values = [
    item.status,
    item.result,
    item.revert_reason,
    item.error
  ].filter(Boolean).map(value => String(value).toLowerCase());

  if (values.some(value =>
    value.includes("fail") ||
    value.includes("error") ||
    value.includes("revert") ||
    value.includes("dropped")
  )) {
    return "Failed";
  }

  if (values.some(value =>
    value === "ok" ||
    value.includes("success") ||
    value.includes("confirmed") ||
    value === "1"
  )) {
    return "Success";
  }

  if (type === "internal-transactions") {
    if (item.success === true) return "Success";
    if (item.success === false) return "Failed";
    if (item.error) return "Failed";
  }

  return item.block_number ? "Confirmed" : "Pending";
}

function directionFor(item) {
  if (item.qmswapLocal) return "Sent";

  const from = entityAddress(item.from).toLowerCase();
  const to = entityAddress(item.to).toLowerCase();
  const wallet = account.toLowerCase();

  if (from === wallet && to === wallet) return "Self";
  if (from === wallet) return "Sent";
  if (to === wallet) return "Received";
  return "Contract";
}

function itemHash(item) {
  return item.hash || item.transaction_hash || item.tx_hash || "";
}

function methodName(item, type) {
  if (item.qmswapLocal) {
    return `Swap ${item.fromSymbol || item.fromKey} → ${item.outputSymbol || item.toKey}`;
  }

  if (item.method && typeof item.method === "object") {
    return item.method.name || item.method.method_name || "Contract Call";
  }

  if (typeof item.method === "string" && item.method) {
    return item.method;
  }

  if (Array.isArray(item.transaction_types) && item.transaction_types.length) {
    return item.transaction_types
      .map(value => String(value).replaceAll("_", " "))
      .join(", ");
  }

  if (type === "token-transfers") return "Token Transfer";
  if (type === "internal-transactions") return item.type || "Internal Call";

  return "Contract Interaction";
}

function amountDetails(item, type) {
  if (item.qmswapLocal) {
    const actual = item.actualReceivedRaw !== null
      ? `${formatRaw(item.actualReceivedRaw, Number(item.outputDecimals || 18), 8)} ${item.outputSymbol || item.toKey}`
      : "Not verified";

    const input =
      `${formatRaw(item.amountInRaw, Number(item.inputDecimals || 18), 8)} ${item.fromSymbol || item.fromKey}`;

    const fee = item.actualGasFeeWei !== null
      ? `${formatRaw(item.actualGasFeeWei, 18, 18)} QMS`
      : "Unavailable";

    return {
      main: actual,
      sub: `Input: ${input} · Gas: ${fee}`
    };
  }

  if (type === "token-transfers") {
    const token = item.token || {};
    const total = item.total || {};
    const decimals = Number(total.decimals ?? token.decimals ?? 18);
    const value = total.value ?? item.amount ?? "0";
    const symbol = token.symbol || token.name || "Token";

    return {
      main: `${formatRaw(value, decimals, 8)} ${symbol}`,
      sub: token.name && token.name !== symbol ? token.name : shorten(token.address || token.address_hash)
    };
  }

  const value = item.value ?? item.amount ?? "0";

  if (type === "internal-transactions") {
    return {
      main: `${formatRaw(value, 18, 8)} QMS`,
      sub: item.type || "Internal call"
    };
  }

  const feeValue = item.fee && typeof item.fee === "object"
    ? item.fee.value
    : item.fee;

  return {
    main: `${formatRaw(value, 18, 8)} QMS`,
    sub: feeValue !== undefined && feeValue !== null
      ? `Fee: ${formatRaw(feeValue, 18, 8)} QMS`
      : `Gas used: ${item.gas_used ?? "—"}`
  };
}

function explorerAddress(value) {
  const address = entityAddress(value);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return esc(shorten(address));
  }

  return `<a class="address-link" href="${EXPLORER}/address/${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer">${esc(shorten(address))}</a>`;
}

function renderRow(item, type) {
  if (item.qmswapLocal) return renderLocalSwapRow(item);

  const hash = itemHash(item);
  const status = statusFor(item, type);
  const direction = directionFor(item);
  const amount = amountDetails(item, type);
  const from = entityAddress(item.from);
  const to = entityAddress(item.to);
  const block = item.block_number ?? item.block?.number ?? "—";

  const statusClass = status === "Success" ? "success"
    : status === "Failed" ? "failed"
    : status === "Pending" ? "pending"
    : "";

  const txLink = /^0x[0-9a-fA-F]{64}$/.test(hash)
    ? `<a class="tx-link hash" href="${EXPLORER}/tx/${encodeURIComponent(hash)}" target="_blank" rel="noopener noreferrer">${esc(shorten(hash))} ↗</a>`
    : '<span class="muted">Unavailable</span>';

  const fromTo = `
    <div>${explorerAddress(from)}</div>
    <div class="sub-label">to</div>
    <div>${to ? explorerAddress(to) : '<span class="muted">Contract creation</span>'}</div>`;

  const safeBlock = /^\d+$/.test(String(block))
    ? `<a class="address-link" href="${EXPLORER}/block/${encodeURIComponent(block)}" target="_blank" rel="noopener noreferrer">#${esc(block)}</a>`
    : "—";

  return `
    <tr>
      <td>
        <div>${esc(formatDate(item.timestamp))}</div>
        <div class="sub-label">Block ${safeBlock}</div>
      </td>
      <td>
        <div class="main-label">${esc(methodName(item, type))}</div>
        <div class="sub-label">${esc(direction)} · ${esc(type === "transactions" ? (item.transaction_types || []).join(", ") : type === "token-transfers" ? (item.token?.type || "Token") : (item.type || "Internal"))}</div>
      </td>
      <td>
        <div class="main-label">${esc(amount.main)}</div>
        <div class="sub-label">${esc(amount.sub)}</div>
      </td>
      <td>${fromTo}</td>
      <td><span class="badge ${statusClass}">${esc(status)}</span></td>
      <td>${txLink}</td>
    </tr>`;
}

function applyFilters(items) {
  const query = $("searchInput").value.trim().toLowerCase();
  const direction = $("directionFilter").value;
  const statusFilter = $("statusFilter").value;

  return items.filter(item => {
    const itemDirection = directionFor(item).toLowerCase();

    if (direction === "sent" && itemDirection !== "sent") return false;
    if (direction === "received" && itemDirection !== "received") return false;

    const status = statusFor(item, activeTab).toLowerCase();

    if (statusFilter === "success" && status !== "success") return false;
    if (statusFilter === "failed" && status !== "failed") return false;
    if (statusFilter === "pending" && status !== "pending") return false;

    const timeRange = Number($("timeFilter")?.value || 0);

    if (timeRange > 0) {
      const itemTime = timestampMs(item.timestamp);

      if (Number.isFinite(itemTime) && itemTime < Date.now() - timeRange) {
        return false;
      }
    }

    const token = item.token || {};
    const text = [
      itemHash(item),
      entityAddress(item.from),
      entityAddress(item.to),
      methodName(item, activeTab),
      token.name,
      token.symbol,
      token.address,
      item.block_number,
      item.value,
      item.type,
      item.fromSymbol,
      item.outputSymbol,
      item.fromKey,
      item.toKey,
      item.venue
    ].join(" ").toLowerCase();

    return !query || text.includes(query);
  });
}

function render() {
  const dataset = activeDataset();
  const allRows = getActiveRows();
  const visible = applyFilters(allRows);

  renderTradeAnalytics();

  $("sectionTitle").textContent = dataset.title;
  $("resultCount").textContent =
    `${visible.length} shown · ${allRows.length} loaded`;
  $("pageInfo").textContent = `Loaded ${dataset.page} page(s)`;

  $("statusFilter").hidden = activeTab !== "transactions";
  $("historyRows").innerHTML = visible.length
    ? visible.map(item => renderRow(item, activeTab)).join("")
    : `<tr><td colspan="6" class="empty">${dataset.loaded ? "No matching records found." : "Connect your wallet to view history."}</td></tr>`;

  $("loadMoreBtn").hidden = !dataset.next ||
    typeof dataset.next !== "object" ||
    Object.keys(dataset.next).length === 0;

  $("loadMoreBtn").disabled = loading;
  $("refreshBtn").disabled = loading;
  $("exportBtn").disabled = loading || visible.length === 0;
}

async function fetchPage(loadMore = false) {
  if (!account || loading) return;

  loadLocalSwapHistory();

  const dataset = activeDataset();

  if (!loadMore) {
    dataset.rows = [];
    dataset.next = null;
    dataset.page = 0;
    dataset.loaded = false;
  }

  loading = true;
  $("refreshBtn").disabled = true;
  $("loadMoreBtn").disabled = true;
  setStatus(
    loadMore ? `Loading more ${dataset.title.toLowerCase()}...` : `Loading ${dataset.title.toLowerCase()}...`
  );

  try {
    const url = new URL(
      `${API_BASE}/addresses/${encodeURIComponent(account)}/${dataset.endpoint}`
    );

    const params = new URLSearchParams();

    if (loadMore && dataset.next) {
      for (const [key, value] of Object.entries(dataset.next)) {
        if (value !== null && value !== undefined) {
          params.set(key, String(value));
        }
      }
    } else {
      params.set("items_count", String(PAGE_SIZE));
    }

    url.search = params.toString();

    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`QMSScan returned HTTP ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data.items)) {
      throw new Error(data.message || "Unexpected response from QMSScan.");
    }

    dataset.rows.push(...data.items);
    dataset.next = data.next_page_params || null;
    dataset.page += 1;
    dataset.loaded = true;

    setStatus(
      `Loaded ${dataset.rows.length} ${dataset.title.toLowerCase()} for ${shorten(account)}.`,
      "success"
    );
  } catch (error) {
    const message = error?.message || String(error);
    setStatus(
      `Unable to load history: ${message} If the error persists, check browser access to the QMSScan API.`,
      "error"
    );
    dataset.loaded = true;
  } finally {
    loading = false;
    render();
  }
}

async function selectTab(tab) {
  if (!DATASETS[tab]) return;

  activeTab = tab;

  document.querySelectorAll("[data-tab]").forEach(button => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  if (account && !activeDataset().loaded) {
    await fetchPage(false);
  } else {
    render();
  }
}

async function connectWallet() {
  injectedWallet = getWalletProvider();

  if (!injectedWallet) {
    setStatus("No MetaMask or compatible EVM wallet was found.", "error");
    return;
  }

  try {
    const accounts = await injectedWallet.request({
      method: "eth_requestAccounts"
    });

    if (!accounts || !accounts.length) {
      setStatus("No wallet account was selected.", "warn");
      return;
    }

    account = accounts[0];

    if (!/^0x[0-9a-fA-F]{40}$/.test(account)) {
      account = "";
      throw new Error("The connected wallet returned an invalid address.");
    }

    account = `${account.slice(0, 2)}${account.slice(2)}`;
    updateWalletUI();

    try {
      const chainId = await injectedWallet.request({ method: "eth_chainId" });
      $("switchBtn").hidden = chainId === CHAIN_ID;

      if (chainId !== CHAIN_ID) {
        setStatus("History is shown for QMS Testnet. Your wallet is currently on another network.", "warn");
      }
    } catch {
      $("switchBtn").hidden = true;
    }

    bindWalletEvents();
    await fetchPage(false);
  } catch (error) {
    setStatus(error?.message || String(error), "error");
  }
}

async function switchNetwork() {
  if (!injectedWallet) {
    setStatus("Connect your wallet first.", "warn");
    return;
  }

  try {
    try {
      await injectedWallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID }]
      });
    } catch (error) {
      if (error?.code !== 4902) throw error;

      await injectedWallet.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID,
          chainName: "QMS Testnet",
          nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
          rpcUrls: ["https://rpc.testnet.qms.finance"],
          blockExplorerUrls: [EXPLORER]
        }]
      });

      await injectedWallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID }]
      });
    }

    $("switchBtn").hidden = true;
    setStatus("Wallet connected to QMS Testnet.", "success");
  } catch (error) {
    setStatus(error?.message || String(error), "error");
  }
}

function bindWalletEvents() {
  if (!injectedWallet || typeof injectedWallet.on !== "function") return;

  injectedWallet.removeListener?.("accountsChanged", onAccountsChanged);
  injectedWallet.on("accountsChanged", onAccountsChanged);

  injectedWallet.removeListener?.("chainChanged", onChainChanged);
  injectedWallet.on("chainChanged", onChainChanged);
}

async function onAccountsChanged(accounts) {
  account = accounts?.length ? accounts[0] : "";
  updateWalletUI();

  for (const dataset of Object.values(DATASETS)) {
    dataset.rows = [];
    dataset.next = null;
    dataset.loaded = false;
    dataset.page = 0;
  }

  if (account) {
    await fetchPage(false);
  } else {
    setStatus("Wallet disconnected.");
    render();
  }
}

function onChainChanged(chainId) {
  $("switchBtn").hidden = chainId === CHAIN_ID;

  if (chainId !== CHAIN_ID) {
    setStatus("The selected wallet network changed. History remains scoped to QMS Testnet.", "warn");
  }
}

function downloadCsv() {
  const rows = applyFilters(activeDataset().rows);

  if (!rows.length) {
    setStatus("No visible records to export.", "warn");
    return;
  }

  const headers = [
    "Timestamp",
    "Activity",
    "Direction",
    "Amount",
    "From",
    "To",
    "Status",
    "Block",
    "Transaction Hash"
  ];

  const csvRows = rows.map(item => {
    const amount = amountDetails(item, activeTab);

    return [
      item.timestamp || "",
      methodName(item, activeTab),
      directionFor(item),
      amount.main,
      entityAddress(item.from),
      entityAddress(item.to),
      statusFor(item, activeTab),
      item.block_number ?? "",
      itemHash(item)
    ];
  });

  const csv = [headers, ...csvRows].map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8"
  }));

  const link = document.createElement("a");
  link.href = url;
  link.download = `qmswap-${activeTab}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => selectTab(button.dataset.tab));
});

$("connectBtn").addEventListener("click", connectWallet);
$("switchBtn").addEventListener("click", switchNetwork);
$("refreshBtn").addEventListener("click", () => {
  walletOverviewState = {
    status: "idle",
    wallet: ""
  };

  return fetchPage(false);
});
$("loadMoreBtn").addEventListener("click", () => fetchPage(true));
$("exportBtn").addEventListener("click", downloadCsv);
$("searchInput").addEventListener("input", render);
$("directionFilter").addEventListener("change", render);
$("statusFilter").addEventListener("change", render);


window.addEventListener("storage", event => {
  if (!account || !event.key) return;

  if (event.key === localSwapStorageKey(account)) {
    loadLocalSwapHistory();
    render();
  }
});
async function boot() {
  render();

  injectedWallet = getWalletProvider();

  if (!injectedWallet) {
    setStatus("Connect your wallet to view QMS Testnet history.");
    return;
  }

  try {
    const accounts = await injectedWallet.request({ method: "eth_accounts" });

    if (accounts?.length) {
      account = accounts[0];
      updateWalletUI();
      bindWalletEvents();

      const chainId = await injectedWallet.request({ method: "eth_chainId" }).catch(() => "");
      $("switchBtn").hidden = chainId === CHAIN_ID;

      await fetchPage(false);
    } else {
      setStatus("Connect your wallet to load its QMS Testnet history.");
    }
  } catch (error) {
    setStatus(error?.message || String(error), "error");
  }
}

boot();