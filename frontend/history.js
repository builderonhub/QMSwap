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
      item.type
    ].join(" ").toLowerCase();

    return !query || text.includes(query);
  });
}

function render() {
  const dataset = activeDataset();
  const visible = applyFilters(dataset.rows);

  $("sectionTitle").textContent = dataset.title;
  $("resultCount").textContent =
    `${visible.length} shown · ${dataset.rows.length} loaded`;
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
    await injectedWallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID }]
    });

    $("switchBtn").hidden = true;
    setStatus("Wallet switched to QMS Testnet.", "success");
  } catch (error) {
    if (error.code === 4902) {
      try {
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

        $("switchBtn").hidden = true;
        setStatus("QMS Testnet was added to your wallet.", "success");
      } catch (addError) {
        setStatus(addError?.message || String(addError), "error");
      }
    } else {
      setStatus(error?.message || String(error), "error");
    }
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
$("refreshBtn").addEventListener("click", () => fetchPage(false));
$("loadMoreBtn").addEventListener("click", () => fetchPage(true));
$("exportBtn").addEventListener("click", downloadCsv);
$("searchInput").addEventListener("input", render);
$("directionFilter").addEventListener("change", render);
$("statusFilter").addEventListener("change", render);

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