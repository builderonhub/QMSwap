import { ethers } from "ethers";
import deployment from "./deployments/qms-testnet.json";
import poolAbi from "./src/abis/QMSwapPool.json";
import tokenAbi from "./src/abis/TestToken.json";

const CFG = {
  chainId: 19480,
  chainIdHex: "0x4c18",
  rpc: "https://rpc.testnet.qms.finance",
  explorer: "https://testnet.qmsscan.io",
  token0: deployment.token0,
  token1: deployment.token1,
  pool: deployment.pool
};

const $ = (id) => document.getElementById(id);
const app = $("liqApp");

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" style="color:inherit;text-decoration:none">
      <div class="logo">↗</div><div>QM<span>Swap</span></div>
    </a>
    <div class="top-actions liq-nav">
      <div class="network-chip">● &nbsp; QMS TESTNET</div>
      <a class="wallet-btn" href="/">← Swap</a>
      <button class="wallet-btn" id="connectLiqBtn">Connect Wallet</button>
    </div>
  </header>
  <main class="liq-page">
    <section class="intro">
      <div class="eyebrow">Liquidity Pool</div>
      <h1>Add liquidity</h1>
      <p>Deposit two tokens into a pool to provide liquidity to QMSwap.</p>
    </section>
    <section class="swap-card liq-card">
      <div class="liq-title-row">
        <div>
          <h2 style="margin:0;font-size:21px">Deposit tokens</h2>
          <div class="subtle" style="margin-top:5px">Choose the amounts of both tokens to deposit</div>
        </div>
        <button class="icon-btn" id="refreshLiqBtn" title="Refresh pool">↻</button>
      </div>

      <div class="amount-panel liq-panel">
        <div class="liq-field-head"><span>Token A</span><span id="liqBalance0">Balance: —</span></div>
        <div class="liq-input-row">
          <input class="liq-amount" id="liqAmount0" inputmode="decimal" placeholder="0.0" autocomplete="off">
          <button class="liq-token" id="liqToken0">TOKEN A</button>
        </div>
        <div class="liq-balance"><span>Currently in pool</span><span id="liqReserve0">—</span></div>
        <div class="liq-balance"><span></span><button class="liq-max" id="liqMax0">MAX</button></div>
      </div>

      <div class="switch-wrap"><span style="color:#a9a2bd;font-size:12px">AND</span></div>

      <div class="amount-panel liq-panel">
        <div class="liq-field-head"><span>Token B</span><span id="liqBalance1">Balance: —</span></div>
        <div class="liq-input-row">
          <input class="liq-amount" id="liqAmount1" inputmode="decimal" placeholder="0.0" autocomplete="off">
          <button class="liq-token" id="liqToken1">TOKEN B</button>
        </div>
        <div class="liq-balance"><span>Currently in pool</span><span id="liqReserve1">—</span></div>
        <div class="liq-balance"><span></span><button class="liq-max" id="liqMax1">MAX</button></div>
      </div>

      <div class="liq-info">
        <div class="liq-row"><span>Pool ratio</span><strong id="liqRatio">Loading…</strong></div>
        <div class="liq-row"><span>Pool contract</span><strong id="liqPoolAddress">—</strong></div>
        <div class="liq-row"><span>Estimated LP shares</span><strong id="liqShares">Will simulate before sending</strong></div>
        <div class="liq-row">
          <span>LP slippage tolerance</span>
          <select id="liqSlippage" style="background:#242033;color:#eee;border:1px solid #383348;padding:5px 8px;border-radius:9px">
            <option value="10">0.1%</option>
            <option value="50" selected>0.5%</option>
            <option value="100">1.0%</option>
          </select>
        </div>
      </div>

      <div class="liq-hint" id="liqRatioHint">
        If the pool has no liquidity, the amounts you choose for both tokens will determine the initial price ratio.
      </div>

      <div id="liqFallbackWrap" hidden>
        <label class="liq-check">
          <input type="checkbox" id="liqAllowZeroMin">
          The contract does not return estimated LP shares. I accept submitting minShares = 0 for this testnet transaction.
        </label>
      </div>

      <button class="primary" id="liqSubmitBtn" disabled>Add Liquidity</button>
      <div class="liq-status" id="liqStatus" role="status">Loading tokens and pool data…</div>
      <a class="liq-tx" id="liqTxLink" target="_blank" rel="noopener noreferrer" hidden></a>
    </section>

    <div class="notice">
      <strong>QMS Testnet only.</strong> QMSUSD and QMSGOLD are project test tokens, not official QMS assets.
      This action submits a testnet transaction and requires QMS to pay gas fees.
    </div>
    <div class="footer">QMSwap · Add Liquidity · Verify every transaction in your wallet.</div>
  </main>`;

const provider = new ethers.JsonRpcProvider(CFG.rpc);
let walletProvider = null;
let signer = null;
let account = "";
let tokens = [];
let reserves = [0n, 0n];
let walletBalances = [0n, 0n];
let lastEdited = 0;
let busy = false;
let pendingAddAfterConnect = false;

const poolRead = new ethers.Contract(CFG.pool, poolAbi, provider);

function hasMethod(abi, name) {
  return abi.some((f) => f.type === "function" && f.name === name);
}
function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
}
function fmt(raw, decimals, places = 6) {
  let s = ethers.formatUnits(raw, decimals);
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + places + 1);
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") || "0";
}
function status(message, kind = "") {
  $("liqStatus").textContent = message;
  $("liqStatus").className = `liq-status ${kind}`.trim();
}
function parseAmount(value, decimals, label) {
  if (!value.trim()) throw new Error(`Enter an amount for ${label}.`);
  let amount;
  try {
    amount = ethers.parseUnits(value.trim(), decimals);
  } catch {
    throw new Error(`Amount of ${label} is invalid.`);
  }
  if (amount <= 0n) throw new Error(`Amount of ${label} must be greater than zero.`);
  return amount;
}
function pairToOther(changedIndex) {
  if (tokens.length !== 2 || reserves[0] <= 0n || reserves[1] <= 0n) return;
  try {
    if (changedIndex === 0) {
      const value = $("liqAmount0").value.trim();
      if (!value) { $("liqAmount1").value = ""; return; }
      const amount0 = ethers.parseUnits(value, tokens[0].decimals);
      const amount1 = amount0 * reserves[1] / reserves[0];
      $("liqAmount1").value = fmt(amount1, tokens[1].decimals, 10);
    } else {
      const value = $("liqAmount1").value.trim();
      if (!value) { $("liqAmount0").value = ""; return; }
      const amount1 = ethers.parseUnits(value, tokens[1].decimals);
      const amount0 = amount1 * reserves[0] / reserves[1];
      $("liqAmount0").value = fmt(amount0, tokens[0].decimals, 10);
    }
  } catch {
  }
}
function updatePairLabels() {
  if (tokens.length !== 2) return;
  $("liqToken0").textContent = tokens[0].symbol;
  $("liqToken1").textContent = tokens[1].symbol;
  $("liqBalance0").textContent = account
    ? `Balance: ${fmt(walletBalances[0], tokens[0].decimals, 5)}`
    : "Balance: Connect wallet";
  $("liqBalance1").textContent = account
    ? `Balance: ${fmt(walletBalances[1], tokens[1].decimals, 5)}`
    : "Balance: Connect wallet";
  $("liqReserve0").textContent = `${fmt(reserves[0], tokens[0].decimals, 5)} ${tokens[0].symbol}`;
  $("liqReserve1").textContent = `${fmt(reserves[1], tokens[1].decimals, 5)} ${tokens[1].symbol}`;

  if (reserves[0] > 0n && reserves[1] > 0n) {
    const a = Number(ethers.formatUnits(reserves[0], tokens[0].decimals));
    const b = Number(ethers.formatUnits(reserves[1], tokens[1].decimals));
    const ratio = b / a;
    $("liqRatio").textContent =
      `1 ${tokens[0].symbol} ≈ ${ratio.toLocaleString(undefined, { maximumSignificantDigits: 7 })} ${tokens[1].symbol}`;
    $("liqRatioHint").textContent =
      "Enter an amount for one token to calculate the other using the current pool ratio. You can adjust both amounts before submitting.";
  } else {
    $("liqRatio").textContent = "Empty pool";
    $("liqRatioHint").textContent =
      "The pool has no liquidity. Enter both amounts manually; you choose the initial ratio. Carefully review this price before confirming.";
  }
}
async function loadToken(address) {
  const contract = new ethers.Contract(address, tokenAbi, provider);
  const [symbol, decimals] = await Promise.all([
    contract.symbol(), contract.decimals()
  ]);
  return {
    address,
    symbol: String(symbol),
    decimals: Number(decimals),
    read: contract
  };
}
async function refreshPool(silent = false) {
  try {
    if (tokens.length !== 2) return;
    const values = await Promise.all([
      tokens[0].read.balanceOf(CFG.pool),
      tokens[1].read.balanceOf(CFG.pool)
    ]);
    reserves = values.map((v) => BigInt(v.toString()));
    updatePairLabels();
    if (reserves.every((r) => r > 0n)) pairToOther(lastEdited);
    if (!silent) status("Token reserves updated on QMS Testnet.", "success");
  } catch (e) {
    if (!silent) status(`Unable to read pool: ${e.shortMessage || e.message}`, "error");
  }
}
async function refreshWalletBalances() {
  if (!account || !walletProvider || tokens.length !== 2) return;
  walletBalances = await Promise.all(tokens.map(async (t) => {
    const c = new ethers.Contract(t.address, tokenAbi, walletProvider);
    const value = await c.balanceOf(account);
    return BigInt(value.toString());
  }));
  updatePairLabels();
}
async function switchNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask or a compatible EVM wallet was not found.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chainIdHex }]
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;

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

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CFG.chainIdHex }]
    });
  }
}
async function connectWallet() {
  try {
    status("Requesting wallet connection and switching to QMS Testnet in MetaMask…");
    await switchNetwork();

    walletProvider = new ethers.BrowserProvider(window.ethereum);
    await walletProvider.send("eth_requestAccounts", []);

    const network = await walletProvider.getNetwork();
    if (network.chainId !== BigInt(CFG.chainId)) {
      throw new Error("Your wallet is not on QMS Testnet.");
    }

    signer = await walletProvider.getSigner();
    account = await signer.getAddress();
    $("connectLiqBtn").textContent = shortAddress(account);

    await refreshWalletBalances();
    status("Wallet connected: " + account, "success");

    const continueAdding = pendingAddAfterConnect;
    pendingAddAfterConnect = false;

    if (continueAdding) {
      status("Wallet connected. Continuing with liquidity checks and deposit… ");
      await addLiquidity();
    }
  } catch (e) {
    pendingAddAfterConnect = false;
    status("Unable to connect or prepare the wallet: " +
      (e.shortMessage || e.message), "error");
  }
}
async function approveIfNeeded(tokenInfo, amount) {
  const token = new ethers.Contract(tokenInfo.address, tokenAbi, signer);
  const allowance = BigInt((await token.allowance(account, CFG.pool)).toString());
  if (allowance >= amount) return;

  status(`Confirm the approval for ${tokenInfo.symbol} in your wallet. This transaction grants allowance only to the current pool…`);
  const tx = await token.approve(CFG.pool, amount);
  status(`Waiting for approval of ${tokenInfo.symbol}: ${tx.hash}`);
  await tx.wait();
}
function readEstimatedShares(result, fragment) {
  const outputs = fragment.outputs || [];
  let index = outputs.findIndex((o) => /share/i.test(o.name || ""));
  if (index < 0 && outputs.length === 1 && outputs[0].type.startsWith("uint")) {
    index = 0;
  }
  if (index < 0) return null;
  const value = outputs.length === 1 ? result : result?.[index];
  if (value === undefined || value === null) return null;
  try { return BigInt(value.toString()); } catch { return null; }
}
async function addLiquidity() {
  if (busy) return;
  if (!signer) {
    pendingAddAfterConnect = true;
    status("Connecting wallet. After you approve in MetaMask, the page will continue adding liquidity automatically…");
    await connectWallet();
    return;
  }
  if (tokens.length !== 2) {
    status("Tokens have not finished loading. Try refreshing the page.", "error");
    return;
  }

  busy = true;
  $("liqSubmitBtn").disabled = true;
  status("Checking balances, network, and token allowances before submitting the transaction…");
  $("liqTxLink").hidden = true;

  try {
    await refreshPool(true);

    const amount0 = parseAmount($("liqAmount0").value, tokens[0].decimals, tokens[0].symbol);
    const amount1 = parseAmount($("liqAmount1").value, tokens[1].decimals, tokens[1].symbol);

    if (amount0 > walletBalances[0]) {
      throw new Error(`Insufficient ${tokens[0].symbol}. Wallet balance: ${fmt(walletBalances[0], tokens[0].decimals)}.`);
    }
    if (amount1 > walletBalances[1]) {
      throw new Error(`Insufficient ${tokens[1].symbol}. Wallet balance: ${fmt(walletBalances[1], tokens[1].decimals)}.`);
    }

    const poolWrite = new ethers.Contract(CFG.pool, poolAbi, signer);
    const signature = "addLiquidity(uint256,uint256,uint256)";
    if (!poolWrite.interface.hasFunction(signature)) {
      throw new Error("The current ABI does not contain addLiquidity(uint256,uint256,uint256). The transaction was not submitted.");
    }
    const fragment = poolWrite.interface.getFunction(signature);
    const addFn = poolWrite.getFunction(signature);

    await approveIfNeeded(tokens[0], amount0);
    await approveIfNeeded(tokens[1], amount1);

    status("Simulating addLiquidity to estimate LP shares and validate the transaction…");
    const preview = await addFn.staticCall(amount0, amount1, 0n);
    const estimate = readEstimatedShares(preview, fragment);

    let minShares = 0n;
    if (estimate !== null) {
      if (estimate <= 0n) throw new Error("Simulation returned zero LP shares. The transaction was not submitted.");
      const slippageBps = BigInt($("liqSlippage").value || "50");
      minShares = estimate * (10000n - slippageBps) / 10000n;
      $("liqShares").textContent =
        `${fmt(estimate, 18, 8)} (estimated); minimum ${fmt(minShares, 18, 8)}`;
      $("liqFallbackWrap").hidden = true;
    } else {
      $("liqShares").textContent = "The contract does not return an LP share value";
      $("liqFallbackWrap").hidden = false;
      if (!$("liqAllowZeroMin").checked) {
        throw new Error(
          "Simulation did not return LP shares to calculate minShares. Review the warning on the interface. If you accept minShares=0 for this testnet transaction, check the confirmation box and try again."
        );
      }
      minShares = 0n;
    }

    const confirmedText =
      `Deposit ${fmt(amount0, tokens[0].decimals)} ${tokens[0].symbol} and ` +
      `${fmt(amount1, tokens[1].decimals)} ${tokens[1].symbol}.`;
    status(
      `${confirmedText}\nminShares: ${minShares.toString()}\nReview and confirm the transaction in MetaMask.`
    );

    const tx = await addFn(amount0, amount1, minShares);
    status(`Transaction submitted: addLiquidity: ${tx.hash}\nWaiting for confirmation…`);
    const receipt = await tx.wait();

    $("liqTxLink").href = `${CFG.explorer}/tx/${tx.hash}`;
    $("liqTxLink").textContent = "View transaction on QMSScan ↗";
    $("liqTxLink").hidden = false;

    await refreshPool(true);
    await refreshWalletBalances();
    status(`Liquidity deposited successfully at block ${receipt.blockNumber}.\n${confirmedText}`, "success");
  } catch (e) {
    status(`Failed to add liquidity: ${e.shortMessage || e.reason || e.message}`, "error");
  } finally {
    busy = false;
    $("liqSubmitBtn").disabled = false;
  }
}

$("connectLiqBtn").addEventListener("click", connectWallet);
$("refreshLiqBtn").addEventListener("click", async () => {
  await refreshPool(false);
  await refreshWalletBalances();
});
$("liqAmount0").addEventListener("input", () => {
  lastEdited = 0;
  pairToOther(0);
});
$("liqAmount1").addEventListener("input", () => {
  lastEdited = 1;
  pairToOther(1);
});
$("liqMax0").addEventListener("click", () => {
  if (!account || tokens.length !== 2) return status("Connect your wallet before using MAX.");
  $("liqAmount0").value = ethers.formatUnits(walletBalances[0], tokens[0].decimals);
  lastEdited = 0;
  pairToOther(0);
});
$("liqMax1").addEventListener("click", () => {
  if (!account || tokens.length !== 2) return status("Connect your wallet before using MAX.");
  $("liqAmount1").value = ethers.formatUnits(walletBalances[1], tokens[1].decimals);
  lastEdited = 1;
  pairToOther(1);
});
$("liqSubmitBtn").addEventListener("click", addLiquidity);

async function restoreWalletIfAvailable() {
  try {
    if (!window.ethereum) return;

    const accounts = await window.ethereum.request({
      method: "eth_accounts"
    });
    const chainId = await window.ethereum.request({
      method: "eth_chainId"
    });

    if (!accounts || accounts.length === 0) return;
    if (BigInt(chainId) !== BigInt(CFG.chainId)) return;

    walletProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await walletProvider.getSigner(accounts[0]);
    account = await signer.getAddress();

    $("connectLiqBtn").textContent = shortAddress(account);
    await refreshWalletBalances();
    status("Wallet connection restored: " + shortAddress(account) +
      ". Review the token amounts, then click Add Liquidity.", "success");
  } catch (e) {
    console.warn("Unable to restore wallet connection:", e);
  }
}
async function init() {
  try {
    let a0 = CFG.token0;
    let a1 = CFG.token1;
    if (hasMethod(poolAbi, "token0")) a0 = await poolRead.getFunction("token0")();
    if (hasMethod(poolAbi, "token1")) a1 = await poolRead.getFunction("token1")();

    tokens = await Promise.all([loadToken(a0), loadToken(a1)]);
    $("liqPoolAddress").textContent = shortAddress(CFG.pool);
    $("liqPoolAddress").title = CFG.pool;
    await refreshPool(true);

    $("liqSubmitBtn").disabled = false;
    status("Connected RPC. Enter the token amounts to deposit.", "success");
  } catch (e) {
    status(`Unable to load the contract or RPC: ${e.shortMessage || e.message}`, "error");
  }
}
if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
init().then(() => restoreWalletIfAvailable());
setInterval(() => refreshPool(true), 15000);