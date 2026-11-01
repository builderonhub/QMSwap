const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/market-Brz4ga6M.js","assets/provider-browser-CQiFq3dy.js"])))=>i.map(i=>d[i]);
import{J as qt,i as Ot,a as _,C as B,g as Y,B as nt,f as Ye,p as Je,I as rt,Z as Rt}from"./provider-browser-CQiFq3dy.js";const Wt="modulepreload",Nt=function(e){return"/"+e},ot={},Dt=function(t,a,r){let n=Promise.resolve();if(a&&a.length>0){let s=function(u){return Promise.all(u.map(f=>Promise.resolve(f).then(w=>({status:"fulfilled",value:w}),w=>({status:"rejected",reason:w}))))};document.getElementsByTagName("link");const c=document.querySelector("meta[property=csp-nonce]"),d=(c==null?void 0:c.nonce)||(c==null?void 0:c.getAttribute("nonce"));n=s(a.map(u=>{if(u=Nt(u),u in ot)return;ot[u]=!0;const f=u.endsWith(".css"),w=f?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${u}"]${w}`))return;const p=document.createElement("link");if(p.rel=f?"stylesheet":Wt,f||(p.as="script"),p.crossOrigin="",p.href=u,d&&p.setAttribute("nonce",d),document.head.appendChild(p),f)return new Promise((x,A)=>{p.addEventListener("load",x),p.addEventListener("error",()=>A(new Error(`Unable to preload CSS for ${u}`)))})}))}function i(s){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=s,window.dispatchEvent(c),!c.defaultPrevented)throw s}return n.then(s=>{for(const c of s||[])c.status==="rejected"&&i(c.reason);return t().catch(i)})},vt="https://rpc.testnet.qms.finance",N=19480n,Qe="0x4c18";let ke=null;async function $t(){if(ke)return ke;ke=(async()=>{const e=j(),t=Qe.toLowerCase();if(String(await e.request({method:"eth_chainId"})).toLowerCase()===t)return;try{await e.request({method:"wallet_switchEthereumChain",params:[{chainId:Qe}]})}catch(n){if((n==null?void 0:n.code)!==4902)throw n;await e.request({method:"wallet_addEthereumChain",params:[{chainId:Qe,chainName:"QMS Testnet",nativeCurrency:{name:"QMS",symbol:"QMS",decimals:18},rpcUrls:[vt],blockExplorerUrls:[Xe]}]}),String(await e.request({method:"eth_chainId"})).toLowerCase()!==t&&await e.request({method:"wallet_switchEthereumChain",params:[{chainId:Qe}]})}if(String(await e.request({method:"eth_chainId"})).toLowerCase()!==t)throw new Error("Please connect your wallet to QMS Testnet.")})();try{await ke}finally{ke=null}}const Oe="0x0000000000000000000000000000000000000000",Xe="https://testnet.qmsscan.io",o=e=>document.getElementById(e),S=new qt(vt,19480),re="0x93AFF45f28e5DF1b55f5AEFEfB807De843b12619",Re="0x93AFD9aC50822F82c7C4f2Ec8Ec2463b086Fb878",de="0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",Ut=["function getPair(address,address) view returns (address)"],te=Object.create(null),ht="qmswap.importedAssets.v1",gt=50;let De=!1;const ue=Object.freeze({QWAP_USDC:{address:"0xDd4D61DF875cc613E1372c78827a5F4C2741bf11",symbol:"USDC",decimals:6,displayName:"USDC"},QWAP_USDT:{address:"0x5D1386fC130143F92511bC2D18124D3E414ed429",symbol:"USDT",decimals:6,displayName:"USDT"},QWAP_WBTC:{address:"0x5eBfE302200a5b22E182a5C0D10444Fe44b2A678",symbol:"BTC",contractSymbol:"WBTC",decimals:8,displayName:"BTC"},QWAP_WETH:{address:"0x43D7c8434A5290a32C8725224870ad6f85132a31",symbol:"ETH",contractSymbol:"WETH",decimals:18,displayName:"ETH"},QWAP_WQMS:{address:"0x9AA510295aC664A3d5A3182a3eFe959DE2B12c34",symbol:"WQMS",decimals:18,displayName:"WQMS"}}),Ze=["function factory() view returns (address)","function WQMS() view returns (address)","function getAmountsOut(uint256,address[]) view returns (uint256[])","function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])","function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])","function swapExactTokensForETH(uint256,uint256,address[],address,uint256) returns (uint256[])"];let m,fe=null,ye=null,q=null,l="",Pe=0n,Le=0n,z=!1;const ne={},pe=["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function approve(address,uint256) returns (bool)","function faucet() returns (uint256)","function faucetAmount() view returns (uint256)","function adminFaucetAmount() view returns (uint256)","function nextClaimAt(address) view returns (uint256)","function maxSupply() view returns (uint256)","function totalSupply() view returns (uint256)","function owner() view returns (address)"],_t=["function getPair(address,address) view returns (address)","function allPairsLength() view returns (uint256)"],bt=["function token0() view returns (address)","function token1() view returns (address)","function getReserves() view returns (uint256,uint256)","function reserve0() view returns (uint256)","function reserve1() view returns (uint256)","function totalSupply() view returns (uint256)","function previewLiquidity(uint256,uint256) view returns (uint256)","function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function approve(address,uint256) returns (bool)","function getAmountOut(address,uint256) view returns (uint256)"],Ce=["function factory() view returns (address)","function wrappedNative() view returns (address)","function feeBps() view returns (uint256)","function getPair(address,address) view returns (address)","function quoteOut(address,address,uint256) view returns (uint256)","function previewLiquidity(address,address,uint256,uint256) view returns (uint256)","function addLiquidity(address,address,uint256,uint256,uint256,uint256,address) returns (uint256)","function addLiquidityNative(address,uint256,uint256,uint256,address) payable returns (uint256)","function removeLiquidity(address,address,uint256,uint256,uint256,uint256,address) returns (uint256,uint256)","function removeLiquidityNative(address,uint256,uint256,uint256,uint256,address) returns (uint256,uint256)","function swapExactTokensForTokens(address,address,uint256,uint256,uint256,address) returns (uint256)","function swapExactQMSForTokens(address,uint256,uint256,address) payable returns (uint256)","function swapExactTokensForQMS(address,uint256,uint256,uint256,address) returns (uint256)"];let kt,We,yt;const xe=new Map,He=new Map;function Be(e,t=N){return _(e)?`${Number(t)}:${Y(e).toLowerCase()}`:null}function Ke(){xe.clear(),He.clear();const e=[["QMSwap",(m==null?void 0:m.tokens)||{}],["QWAP",ue],["QPad",te]];for(const[t,a]of e)for(const[r,n]of Object.entries(a)){if(!(n!=null&&n.address)||!_(n.address))continue;const i=Y(n.address),s=Be(i);let c=xe.get(s);if(c){if(Number(c.decimals??18)!==Number(n.decimals??18))throw new Error(`Conflicting decimals for asset ${s}`);c.aliases.includes(r)||c.aliases.push(r)}else c={...n,key:r,address:i,chainId:Number(N),identity:s,source:n.source||t,aliases:[r]},xe.set(s,c);He.set(r,c)}return xe}function xt(e,t=N){const a=Be(e,t);return a&&xe.get(a)||null}function h(e){var r;const t=((r=m==null?void 0:m.tokens)==null?void 0:r[e])||ue[e]||te[e];return t?Be(t.address)&&He.get(e)||t:null}function ee(e=oe()){var i;const t=["QMS","USDT","USDC","ETH","BTC","BNB"].filter(s=>{var c;return(c=m==null?void 0:m.tokens)==null?void 0:c[s]}),a=Object.entries(te).filter(([,s])=>(s==null?void 0:s.source)==="Imported"&&Array.isArray(s.pools)&&s.pools.some(c=>(c==null?void 0:c.venue)==="QWAP"||(c==null?void 0:c.venue)==="QMSwap")).map(([s])=>s),r=e==="swap"?[...(i=m==null?void 0:m.tokens)!=null&&i.QMS?["QMS"]:[],...Object.keys(ue),...a]:t,n=new Set;return r.filter(s=>{const c=h(s),d=Be(c==null?void 0:c.address);return!d||n.has(d)?!1:(n.add(d),!0)})}function T(e){return Number(h(e).decimals??18)}function Te(e){return e?`${e.slice(0,6)}...${e.slice(-4)}`:""}function P(e,t=18,a=8){let r=Ye(e,t);const n=r.split(".");if(n.length===1)return r;const i=n[1].slice(0,a).replace(/0+$/,"");return i?`${n[0]}.${i}`:n[0]}function Z(e,t){return!e||!String(e).trim()?0n:Je(String(e).trim(),T(t))}function $(e){var r,n,i,s,c,d,u,f;const t=[(n=(r=e==null?void 0:e.info)==null?void 0:r.error)==null?void 0:n.message,(c=(s=(i=e==null?void 0:e.info)==null?void 0:i.error)==null?void 0:s.data)==null?void 0:c.message,(d=e==null?void 0:e.error)==null?void 0:d.message,(f=(u=e==null?void 0:e.error)==null?void 0:u.data)==null?void 0:f.message,e==null?void 0:e.reason,e==null?void 0:e.shortMessage,e==null?void 0:e.message].filter(w=>typeof w=="string"&&w.trim());return[...new Set(t)].join(" | ").slice(0,1e3)||"Unable to retrieve error details from RPC."}function k(e,t=""){const a=o("status");a&&(a.textContent=e,a.className=`status ${t}`.trim())}function st(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function ve(e){return ee().map(t=>`<option value="${st(t)}" ${t===e?"selected":""}>${st(h(t).displayName)}</option>`).join("")}function Ne(e,t){o("app").innerHTML=`
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="/">
          <span class="brand-mark">Q</span>
          <span>QMSwap</span>
        </a>
        <nav class="main-nav">
          <a href="/" data-page="swap" class="${e==="swap"?"active":""}">Swap</a>
          <a href="/liquidity.html" data-page="liquidity" class="${e==="liquidity"?"active":""}">Add Liquidity</a>
          <a href="/market.html" data-page="market" class="${e==="market"?"active":""}">Market</a>
          <a href="/faucet.html" data-page="faucet" class="${e==="faucet"?"active":""}">Faucet</a>
          <a href="/portfolio.html" data-page="portfolio" class="${e==="portfolio"?"active":""}">Portfolio</a>
          <a href="/history.html" data-page="history" class="${e==="history"?"active":""}">History</a>
        </nav>
        <div class="top-actions">
          <span class="network-pill"><span class="dot"></span> QMS Testnet</span>
          <button class="wallet-btn" id="connectBtn">Connect Wallet</button>
        </div>
      </header>
      <main class="main">${t}</main>
      <footer class="footer">QMSwap | 0.30% swap fee</footer>
    </div>`,o("connectBtn").addEventListener("click",()=>be(!0))}async function Ft(){Ne("market",`
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
  `),fe=await Dt(()=>import("./market-Brz4ga6M.js"),__vite__mapDeps([0,1])),await fe.initMarket({getAccount:()=>l,getSigner:()=>q,ensureWallet:ce})}function Ht(){Ne("swap",`
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
          <select id="fromSelect" class="token-select">${ve("QWAP_USDT")}</select>
        </div>
      </div>
      <div class="flip-row"><button id="flipBtn" class="flip-btn" title="Reverse direction">&#x2193;&#x2191;</button></div>
      <div class="amount-box">
        <div class="amount-label"><span>To (estimated)</span><span id="toBalance">Balance: --</span></div>
        <div class="amount-row">
          <input id="amountOut" type="text" placeholder="0.0" readonly>
          <select id="toSelect" class="token-select">${ve("QWAP_USDC")}</select>
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
    </section>`),sa()}function zt(){const e=(m==null?void 0:m.pairs)||{};return`<option value="">Choose a pool</option>${(Array.isArray(e)?e.map(r=>[`${r.tokenA}/${r.tokenB}`,r]):Object.entries(e)).map(([r,n])=>{var d,u;const[i,s]=String(r).split("/"),c=typeof n=="string"?n:n==null?void 0:n.address;return!i||!s||!((d=h(i))!=null&&d.address)||!((u=h(s))!=null&&u.address)||c&&!_(c)?"":`<option value="${i}/${s}">${i} / ${s}</option>`}).filter(Boolean).join("")}`}function jt(){var t;Ne("liquidity",`
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
          <select id="tokenA" class="token-select">${ve("QMS")}</select>
        </div>
      </div>
      <div class="liquidity-link"><span>+</span></div>
      <div class="amount-box">
        <div class="amount-label"><span>Token B</span><span id="balanceB">Balance: —</span></div>
        <div class="amount-row">
          <input id="amountB" type="text" inputmode="decimal" placeholder="0.0">
          <select id="tokenB" class="token-select">${ve("USDT")}</select>
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
          <select id="removePool" class="token-select">${zt()}</select>
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
  `);const e=((t=m==null?void 0:m.features)==null?void 0:t.removeLiquidity)===!0;o("removeFeatureNotice").hidden=e,ga()}function Vt(){Ne("faucet",`
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
  `),xa()}function he(e){const t=o("txLink");t&&(t.href=`${Xe}/tx/${e}`,t.textContent="View transaction on QMSScan ->",t.hidden=!1)}const Ie="qmswap.pendingSwap.v1";function St(e){try{if(!e){sessionStorage.removeItem(Ie);return}sessionStorage.setItem(Ie,JSON.stringify({hash:e.hash,submittedAt:e.submittedAt,chainId:String(N),fromKey:e.fromKey,toKey:e.toKey,amountIn:String(e.amountIn),expectedAmountOut:String(e.expectedAmountOut),minimumReceived:String(e.minimumReceived),estimatedGasWei:String(e.estimatedGasWei??0n),outputAddress:e.outputAddress,recipient:e.recipient,outputDecimals:e.outputDecimals,outputSymbol:e.outputSymbol,venue:e.venue}))}catch(t){console.warn("Pending transaction storage unavailable:",t)}}function Gt(){try{const e=sessionStorage.getItem(Ie);if(!e)return null;const t=JSON.parse(e);return t.chainId!==String(N)||!Ot(t.hash,32)||!_(t.outputAddress)||!_(t.recipient)?(sessionStorage.removeItem(Ie),null):{...t,amountIn:BigInt(t.amountIn),expectedAmountOut:BigInt(t.expectedAmountOut),minimumReceived:BigInt(t.minimumReceived),estimatedGasWei:BigInt(t.estimatedGasWei||"0"),outputDecimals:Number(t.outputDecimals)}}catch(e){return console.warn("Could not restore pending swap:",e),null}}let U=Gt();function Yt(){U=null,St(null)}function et(e){const t=o("swapReceiptPanel");if(!t)return;t.hidden=!1,o("receiptStatus").textContent="Pending confirmation",o("actualReceived").textContent="Waiting for receipt",o("actualGasFee").textContent="--",o("gasEstimateDifference").textContent="--",o("actualOutputDeviation").textContent="--",o("receiptBlock").textContent="Pending",o("receiptTxHash").textContent=e.hash;const a=o("swapBtn");a&&(a.textContent="Check transaction")}function Jt(e,t){const a=Array.isArray(e.logs)?e.logs:[];if(t.toKey==="QMS"){const i=new rt(["event Withdrawal(address indexed src, uint256 wad)"]);let s=0n;for(const c of a)if(String(c.address).toLowerCase()===String(t.outputAddress).toLowerCase())try{const d=i.parseLog({topics:c.topics,data:c.data});d&&d.name==="Withdrawal"&&(s+=BigInt(d.args.wad))}catch{}return s>0n?{amount:s,source:"Withdrawal event"}:{amount:null,source:"Withdrawal event not found"}}const r=new rt(["event Transfer(address indexed from, address indexed to, uint256 value)"]);let n=0n;for(const i of a)if(String(i.address).toLowerCase()===String(t.outputAddress).toLowerCase())try{const s=r.parseLog({topics:i.topics,data:i.data});s&&s.name==="Transfer"&&String(s.args.to).toLowerCase()===String(t.recipient).toLowerCase()&&(n+=BigInt(s.args.value))}catch{}return n>0n?{amount:n,source:"ERC20 Transfer event"}:{amount:null,source:"Output Transfer event not found"}}function Xt(e){try{if(e.fee!==null&&e.fee!==void 0)return BigInt(e.fee);const t=e.gasPrice??e.effectiveGasPrice;if(e.gasUsed!==null&&e.gasUsed!==void 0&&t!==null&&t!==void 0)return BigInt(e.gasUsed)*BigInt(t)}catch(t){console.warn("Actual gas fee decoding failed:",t)}return null}function Zt(e,t){if(e===null||t<=0n)return"Unavailable";const a=e-t,r=(a>=0n?a:-a)*10000n/t,n=(Number(r)/100).toFixed(2);return(a>0n?"+":a<0n?"-":"")+n+"% vs quote"}function Kt(e,t){if(e===null||t===null||t<=0n)return"Unavailable";const a=e-t,r=(a>=0n?a:-a)*10000n/t,n=(Number(r)/100).toFixed(2);return(a>0n?"+":a<0n?"-":"")+n+"% vs estimate"}const ea="qmswap.tradeHistory.v1",ta=500;async function aa(e,t,a,r,n){try{const i=String(t.recipient||"").toLowerCase();if(!_(i)){console.warn("Trade history record skipped: invalid wallet.");return}const s=`${ea}:${String(N)}:${i}`;let c=Date.now(),d="local-confirmation";if(e.blockNumber!==null&&e.blockNumber!==void 0)try{const b=await S.getBlock(e.blockNumber);b&&Number(b.timestamp)>0&&(c=Number(b.timestamp)*1e3,d="block")}catch(b){console.warn("Could not retrieve confirmation block timestamp:",b)}let u=String(t.fromKey||"Unknown"),f=18;try{u=h(t.fromKey).symbol||u,f=T(t.fromKey)}catch(b){console.warn("Input token metadata unavailable for history:",b)}const w=r&&r.amount!==null&&r.amount!==void 0?BigInt(r.amount):null,p=BigInt(t.expectedAmountOut??0n);let x=null;w!==null&&p>0n&&(x=String((w-p)*10000n/p));const A=BigInt(t.estimatedGasWei??0n);let L=null;n!=null&&A>0n&&(L=String((BigInt(n)-A)*10000n/A));const v={schemaVersion:1,chainId:String(N),wallet:i,hash:String(t.hash).toLowerCase(),status:a?"success":"failed",fromKey:String(t.fromKey||""),toKey:String(t.toKey||""),fromSymbol:u,outputSymbol:String(t.outputSymbol||t.toKey||"Unknown"),inputDecimals:f,outputDecimals:Number(t.outputDecimals??18),amountInRaw:String(t.amountIn??0n),expectedAmountOutRaw:String(p),minimumReceivedRaw:String(t.minimumReceived??0n),actualReceivedRaw:w!==null?String(w):null,actualOutputVerified:w!==null,actualGasFeeWei:n!=null?String(n):null,estimatedGasWei:String(A),actualOutputDeviationBps:x,gasEstimateDifferenceBps:L,blockNumber:e.blockNumber!==null&&e.blockNumber!==void 0?String(e.blockNumber):null,timestamp:c,timestampSource:d,venue:String(t.venue||"QWAP"),receiptVerified:!0};let g=[];try{const b=JSON.parse(localStorage.getItem(s)||"[]");Array.isArray(b)&&(g=b)}catch(b){console.warn("Existing trade history could not be parsed:",b)}const M=[v,...g.filter(b=>String(b.hash||"").toLowerCase()!==v.hash)].sort((b,E)=>Number(E.timestamp||0)-Number(b.timestamp||0)).slice(0,ta);localStorage.setItem(s,JSON.stringify(M)),console.info("Verified Swap transaction saved to trade history:",v.hash)}catch(i){console.warn("Could not save verified Swap transaction to history:",i)}}async function At(e,t){const a=Number(e.status)===1,r=o("swapReceiptPanel");r&&(r.hidden=!1),he(t.hash);const n=Xt(e);o("actualGasFee").textContent=n!==null?P(n,18,18)+" QMS":"Unavailable",o("gasEstimateDifference").textContent=Kt(n,t.estimatedGasWei),o("receiptBlock").textContent=e.blockNumber!==null&&e.blockNumber!==void 0?String(e.blockNumber):"Unavailable",o("receiptTxHash").textContent=t.hash;let i={amount:null,source:"Output transfer not verified"};if(a){i=Jt(e,t),o("receiptStatus").textContent="Confirmed",o("actualReceived").textContent=i.amount!==null?P(i.amount,t.outputDecimals,10)+" "+t.outputSymbol:"Unavailable from receipt logs",o("actualOutputDeviation").textContent=Zt(i.amount,t.expectedAmountOut);const c=i.amount!==null&&i.amount<t.minimumReceived;k(c?"Swap confirmed. Actual recipient transfer is below the displayed minimum. Check the token transfer behavior.":i.amount===null?"Swap confirmed on-chain. The output transfer amount could not be decoded from receipt logs.":"Swap confirmed. Actual output and network fee verified from the transaction receipt.",c?"error":"success")}else o("receiptStatus").textContent="Reverted",o("actualReceived").textContent="No successful output",o("actualOutputDeviation").textContent="Not applicable",k("Transaction reverted on-chain. The actual network fee is shown in the receipt panel.","error");await aa(e,t,a,i,n),Yt();const s=o("swapBtn");return s&&(s.textContent="Swap"),a}async function na(e,t){try{const a=await e.wait(1,3e4);if(a)return a}catch(a){if(a&&a.receipt)return a.receipt;console.warn("Transaction wait returned an error; checking QMS Testnet receipt:",a)}for(let a=0;a<8;a++){try{const r=await S.getTransactionReceipt(t.hash);if(r)return r}catch(r){console.warn("Receipt lookup attempt failed:",r)}await new Promise(r=>setTimeout(r,2500))}return null}async function ra(){const e=U;if(e){he(e.hash),et(e),k("Checking the existing transaction on QMS Testnet. No new swap will be submitted...");try{const t=await S.getTransactionReceipt(e.hash);if(!t){k("Transaction is still pending or not yet visible to the RPC. Its hash has been preserved. Press Check transaction again later.");return}if(await At(t,e),Number(t.status)===1)try{await ae(),await H(),k("Previous swap confirmed. Balances have been refreshed.","success")}catch(a){console.warn("Post-confirmation refresh failed:",a)}}catch(t){console.warn("Pending transaction reconciliation failed:",t),k("Could not retrieve the transaction receipt. The transaction hash is preserved; check again later.")}}}async function oa(){const e=await fetch("/deployments/qmswap-multipair-v6.json?ts="+Date.now(),{cache:"no-store"});if(!e.ok)throw new Error("V3 configuration not found. The interface has not switched to the new version.");if(m=await e.json(),Number(m.chainId)!==19480||!m.factory||!m.router||!m.wqms||!m.tokens)throw new Error("Deployment config is invalid.");Ke(),kt=new B(m.factory,_t,S),We=new B(m.router,Ce,S),yt=new B(re,Ze,S)}function oe(){const e=location.pathname.toLowerCase();return e.endsWith("/market.html")?"market":e.endsWith("/faucet.html")?"faucet":e.endsWith("/liquidity.html")?"liquidity":"swap"}function j(){if(window.okxwallet&&typeof window.okxwallet.request=="function")return window.okxwallet;const e=window.ethereum;if(e&&Array.isArray(e.providers)){const t=e.providers.find(a=>a&&a.isOKXWallet&&typeof a.request=="function");if(t)return t}return e&&typeof e.request=="function"?e:null}async function be(e=!0){if(!j())throw new Error("No compatible EVM wallet was found. Enable OKX Wallet and reload the page.");const t=await j().request({method:e?"eth_requestAccounts":"eth_accounts"});if(!t||!t.length){if(e)throw new Error("No account is selected in MetaMask.");return}ye=new nt(j());let a=await ye.getNetwork();if(a.chainId!==N){if(!e)throw new Error("Please switch MetaMask to QMS Testnet.");await $t(),ye=new nt(j()),a=await ye.getNetwork()}if(a.chainId!==N)throw new Error("MetaMask is not connected to chain ID 19480.");l=Y(t[0]),q=await ye.getSigner(l);const r=o("connectBtn");r&&(r.textContent=Te(l)),await ae(),oe()==="market"&&(fe!=null&&fe.onWalletChanged)&&await fe.onWalletChanged(l,q),oe()==="faucet"&&await ge(),k("Wallet connected: "+Te(l),"success")}async function ae(){if(!(!l||!m)){for(const e of ee())try{if(e==="QMS")ne.QMS=await S.getBalance(l);else{const t=new B(h(e).address,pe,S);ne[e]=await t.balanceOf(l)}}catch(t){console.warn("Balance read failed:",e,t)}K(),oe()==="faucet"&&await ge()}}function K(){var e,t,a,r;if(oe()==="swap"){const n=(e=o("fromSelect"))==null?void 0:e.value,i=(t=o("toSelect"))==null?void 0:t.value;o("fromBalance")&&(o("fromBalance").textContent=l?`Balance: ${P(ne[n]??0n,T(n))}`:"Balance: Connect wallet"),o("toBalance")&&(o("toBalance").textContent=l?`Balance: ${P(ne[i]??0n,T(i))}`:"Balance: Connect wallet")}else if(oe()==="liquidity"){const n=(a=o("tokenA"))==null?void 0:a.value,i=(r=o("tokenB"))==null?void 0:r.value;o("balanceA")&&(o("balanceA").textContent=l?`Balance: ${P(ne[n]??0n,T(n))}`:"Balance: Connect wallet"),o("balanceB")&&(o("balanceB").textContent=l?`Balance: ${P(ne[i]??0n,T(i))}`:"Balance: Connect wallet")}}async function ce(){if((!l||!q)&&await be(!0),!l||!q)throw new Error("Please connect your wallet first.");if((await q.provider.getNetwork()).chainId!==N)throw new Error("Please switch MetaMask to QMS Testnet.")}async function we(e,t,a=m.router){const r=new B(e,pe,q);if(BigInt(await r.allowance(l,a))>=t)return;k("Confirm the token approval in MetaMask...");const i=await r.approve(a,t);k("Waiting for approval: "+i.hash);const s=await i.wait();if(!s||s.status!==1)throw new Error("Token approval failed.")}function le(){var e;return BigInt(((e=o("slippage"))==null?void 0:e.value)||"50")}function tt(e){return e*(10000n-le())/10000n}async function sa(){o("connectBtn").addEventListener("click",()=>be(!0).catch(r=>k($(r),"error"))),o("importTokenBtn").addEventListener("click",it);const e=o("tokenImportModal"),t=()=>{e.hidden=!1,document.body.classList.add("token-import-modal-open"),o("openTokenImportModal").setAttribute("aria-expanded","true"),o("tokenAddressInput").focus()},a=()=>{e.hidden=!0,document.body.classList.remove("token-import-modal-open"),o("openTokenImportModal").setAttribute("aria-expanded","false"),o("openTokenImportModal").focus()};o("openTokenImportModal").addEventListener("click",t),o("closeTokenImportModal").addEventListener("click",a),o("tokenImportBackdrop").addEventListener("click",a),document.addEventListener("keydown",r=>{r.key==="Escape"&&!e.hidden&&a()}),o("tokenAddressInput").addEventListener("keydown",r=>{r.key==="Enter"&&it()}),o("fromSelect").addEventListener("change",async()=>{o("fromSelect").value===o("toSelect").value&&(o("toSelect").value=ee().find(r=>r!==o("fromSelect").value)),K(),await H()}),o("toSelect").addEventListener("change",async()=>{o("toSelect").value===o("fromSelect").value&&(o("fromSelect").value=ee().find(r=>r!==o("toSelect").value)),K(),await H()}),o("amountIn").addEventListener("input",H),o("slippage").addEventListener("change",H),o("flipBtn").addEventListener("click",async()=>{const r=o("fromSelect").value;o("fromSelect").value=o("toSelect").value,o("toSelect").value=r,K(),await H()}),o("refreshBtn").addEventListener("click",async()=>{await ae(),await H()}),o("swapBtn").addEventListener("click",ha),Bt(),K(),await H(),U&&(he(U.hash),et(U),k("A previous swap transaction is awaiting confirmation. Press Check transaction to verify it before submitting another swap."))}function ze(e){if(Object.prototype.hasOwnProperty.call(ue,e))return!0;const t=te[e];return t?t.source==="QPad"?!0:t.source==="Imported"&&Array.isArray(t.pools)&&t.pools.some(a=>a.venue==="QWAP"):!1}function Ae(e){return e==="QMS"?de:ze(e)?h(e).address:null}function Ct(e){const t=String(e||"").toLowerCase();return Object.entries((m==null?void 0:m.tokens)||{}).some(([a,r])=>a!=="QMS"&&String((r==null?void 0:r.address)||"").toLowerCase()===t)}function qe(e){const t=te[e];return(t==null?void 0:t.source)==="Imported"&&Array.isArray(t.pools)&&t.pools.some(a=>(a==null?void 0:a.venue)==="QMSwap")}function Bt(){const e=o("fromSelect"),t=o("toSelect");if(!e||!t)return;const a=ee("swap"),r=e.value,n=t.value,i=a.includes("QWAP_USDT")?"QWAP_USDT":a[0]||"",s=a.includes("QWAP_USDC")?"QWAP_USDC":a.find(c=>c!==i)||"";e.innerHTML=ve(a.includes(r)?r:i),t.innerHTML=ve(a.includes(n)?n:s),e.value=a.includes(r)?r:i,t.value=a.includes(n)?n:s,e.value===t.value&&(t.value=a.find(c=>c!==e.value)||"")}const ia=["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)"];function ca(e){return`IMPORTED_${Y(e).toLowerCase()}`}function da(e){return String(e??"").replace(/[\u0000-\u001F\u007F]/g,"").trim().slice(0,48)}function Et(e){return String(e??"").trim().replace(/[^a-zA-Z0-9._$-]/g,"").slice(0,16)}async function Mt(e){const t=await S.getCode(e);if(!t||t==="0x")throw new Error("The supplied address has no contract bytecode on QMS Testnet.");const a=new B(e,ia,S),[r,n,i]=await Promise.all([a.name(),a.symbol(),a.decimals()]),s=da(r),c=Et(n),d=Number(i);if(!s||!c)throw new Error("The contract does not expose valid ERC-20 name and symbol metadata.");if(!Number.isInteger(d)||d<0||d>36)throw new Error("The token decimals value is outside the supported range (0-36).");return{name:s,symbol:c,decimals:d}}function je(e){const t=Object.entries(e==="QWAP"?ue:(m==null?void 0:m.tokens)||{}),a=new Set;return t.map(([r,n])=>({key:r,address:n==null?void 0:n.address,symbol:(n==null?void 0:n.symbol)||r,displayName:(n==null?void 0:n.displayName)||r})).filter(r=>{if(!r.address||!_(r.address))return!1;const n=Be(r.address);return!n||a.has(n)?!1:(a.add(n),!0)})}async function Ve(e,t,a,r){const i=await new B(t,Ut,S).getPair(a,r.address);if(!i||i.toLowerCase()===Oe.toLowerCase())return null;const s=await S.getCode(i);if(!s||s==="0x")return null;const c=e==="QWAP"?["function token0() view returns(address)","function token1() view returns(address)","function getReserves() view returns(uint112,uint112,uint32)"]:["function token0() view returns(address)","function token1() view returns(address)","function getReserves() view returns(uint256,uint256)"],d=new B(i,c,S),[u,f,w]=await Promise.all([d.token0(),d.token1(),d.getReserves()]),p=a.toLowerCase(),x=r.address.toLowerCase(),A=u.toLowerCase(),L=f.toLowerCase();return!(A===p&&L===x||L===p&&A===x)||BigInt(w[0])<=0n||BigInt(w[1])<=0n?null:{venue:e,pairAddress:Y(i),baseKey:r.key,baseAddress:Y(r.address),baseSymbol:Et(r.symbol)||r.key}}async function la(e){const t=[];for(const r of je("QWAP"))r.address.toLowerCase()!==e.toLowerCase()&&t.push(Ve("QWAP",Re,e,r));for(const r of je("QMSwap"))r.address.toLowerCase()!==e.toLowerCase()&&t.push(Ve("QMSwap",m.factory,e,r));return(await Promise.allSettled(t)).filter(r=>r.status==="fulfilled"&&r.value).map(r=>r.value)}async function ua(e,t){const a=[];for(const r of(Array.isArray(t)?t:[]).slice(0,20)){const n=r==null?void 0:r.venue;if(n!=="QWAP"&&n!=="QMSwap"||!_(r.baseAddress)||!_(r.pairAddress))continue;const i=n==="QWAP"?Re:m.factory,s=je(n).find(c=>c.address.toLowerCase()===r.baseAddress.toLowerCase());if(s)try{const c=await Ve(n,i,e,s);c&&c.pairAddress.toLowerCase()===r.pairAddress.toLowerCase()&&a.push(c)}catch{}}return a}function Qt(e,t,a){const r=ca(e);return te[r]={address:Y(e),name:t.name,symbol:t.symbol,decimals:t.decimals,displayName:t.symbol,custom:!0,source:"Imported",pools:a,venues:[...new Set(a.map(n=>n.venue))]},Ke(),r}function pa(){const e=Object.values(te).filter(t=>(t==null?void 0:t.source)==="Imported").slice(0,gt).map(t=>({address:t.address,name:t.name,symbol:t.symbol,decimals:t.decimals,pools:t.pools}));try{localStorage.setItem(ht,JSON.stringify({version:1,chainId:Number(N),items:e}))}catch(t){console.warn("Imported token cache could not be saved:",t)}}async function ma(){let e;try{e=JSON.parse(localStorage.getItem(ht)||"null")}catch{return}if(!e||e.version!==1||Number(e.chainId)!==Number(N)||!Array.isArray(e.items))return;const t=e.items.slice(0,gt);let a=0;const r=Array.from({length:Math.min(3,t.length)},async()=>{for(;a<t.length;){const n=t[a++];if(!_(n==null?void 0:n.address))continue;const i=Y(n.address);if(!(xt(i)&&!Ct(i)))try{const s=await Mt(i),c=await ua(i,n.pools);c.length>0&&Qt(i,s,c)}catch(s){console.debug("Imported token restore skipped:",i,s)}}});await Promise.all(r),Ke()}async function it(){if(De)return;const e=o("tokenAddressInput"),t=o("tokenImportStatus"),a=o("importTokenBtn"),r=(e==null?void 0:e.value.trim())||"";try{if(De=!0,a&&(a.disabled=!0),!_(r))throw new Error("Enter a valid token contract address.");const n=Y(r);if(n.toLowerCase()===Oe.toLowerCase())throw new Error("The zero address cannot be imported.");if((await S.getNetwork()).chainId!==N)throw new Error("The configured RPC is not connected to QMS Testnet.");const s=xt(n),c=Object.values(te).some(p=>(p==null?void 0:p.source)==="Imported"&&String(p.address||"").toLowerCase()===n.toLowerCase());if(s&&(!Ct(n)||c)){t.textContent=`${s.symbol} is already available as ${s.displayName}.`;return}t.className="status",t.textContent="Checking contract metadata and searching QWAP and QMSwap pools...";const d=await Mt(n),u=await la(n);if(u.length===0)throw new Error("No active QWAP or QMSwap pool with non-zero reserves was found. The token was not added.");const f=Qt(n,d,u);pa(),Bt();const w=u.map(p=>`${p.venue} ${p.baseSymbol} (${p.pairAddress.slice(0,8)}...${p.pairAddress.slice(-6)})`).join("; ");if(e.value="",t.className="status success",t.textContent=`${d.name} (${d.symbol}) imported. Active pools: ${w}. Select ${d.symbol} in the swap list to request a quote.`,l)try{const p=new B(n,pe,S);ne[f]=BigInt(await p.balanceOf(l))}catch(p){console.warn("Imported token balance read failed:",n,p)}K(),await H()}catch(n){t.className="status error",t.textContent=$(n)}finally{De=!1,a&&(a.disabled=!1)}}async function fa(e,t,a,r){const n=new B(e,["function getPair(address,address) view returns(address)"],S),i=["function token0() view returns(address)","function token1() view returns(address)","function getReserves() view returns(uint256,uint256)"];let s=BigInt(a);const c=[];for(let f=0;f<t.length-1;f++){const w=t[f],p=t[f+1],x=await n.getPair(w,p);if(!x||x.toLowerCase()===Rt.toLowerCase())throw new Error("Route pair not found.");const A=new B(x,i,S),[L,v,g]=await Promise.all([A.token0(),A.token1(),A.getReserves()]),M=w.toLowerCase(),b=p.toLowerCase();let E,C;if(M===L.toLowerCase()&&b===v.toLowerCase())E=BigInt(g[0]),C=BigInt(g[1]);else if(M===v.toLowerCase()&&b===L.toLowerCase())E=BigInt(g[1]),C=BigInt(g[0]);else throw new Error("Pair token mismatch.");if(E<=0n||C<=0n)throw new Error("Pool reserves are empty.");if(s=s*C/E,s<=0n)throw new Error("Invalid spot output.");c.push(x)}const d=BigInt(r),u=s>d?(s-d)*10000n/s:0n;return{pairAddresses:c,executionShortfallBps:u,depthVerified:!0}}async function ct(e,t,a,r,n,i){const s=await fa(a,r,n,i);return{venue:e,routerAddress:t,factoryAddress:a,path:r,amountOut:BigInt(i),pairAddresses:s.pairAddresses,executionShortfallBps:s.executionShortfallBps,depthVerified:s.depthVerified}}let $e=null,dt=0;async function Lt(){if($e!==null&&Date.now()-dt<1e4)return $e;const e=await S.getFeeData();let t=e.gasPrice??e.maxFeePerGas??null;if(t===null||BigInt(t)<=0n){const a=await S.send("eth_gasPrice",[]);t=BigInt(a)}if(t=BigInt(t),t<=0n)throw new Error("QMS network gas price is unavailable.");return $e=t,dt=Date.now(),t}async function wa(e,t,a="QWAP"){var g,M,b;const r=BigInt(e);if(r<=0n)throw new Error("Estimated QMS gas cost is zero or invalid.");const n=10n**18n,i=10000n,s=a==="QMSwap";if(!s&&a!=="QWAP")throw new Error("Unsupported venue for gas conversion.");const c=s?(M=(g=m==null?void 0:m.tokens)==null?void 0:g.QMS)==null?void 0:M.address:de,d=s?t==="QMS"?c:(b=h(t))==null?void 0:b.address:Ae(t);if(!c||!d||!_(d))throw new Error("Output token cannot be used for gas conversion.");if(c.toLowerCase()===d.toLowerCase())return r;const u=s?m.factory:Re,f=new B(u,["function getPair(address,address) view returns(address)"],S),w=s?BigInt(m.feeBps??30):30n,p=i-w;if(p<=0n||p>=i)throw new Error("Invalid pool fee configuration.");const x=[[c,d]];if(!s){const E=[...Object.values(ue).map(y=>y.address),...Object.values(te).filter(y=>(y==null?void 0:y.source)==="QPad"||(y==null?void 0:y.source)==="Imported"&&Array.isArray(y.pools)&&y.pools.some(I=>(I==null?void 0:I.venue)==="QWAP")).map(y=>y.address)],C=new Set([`${c.toLowerCase()}>${d.toLowerCase()}`]);for(const y of E){if(!_(y))continue;const I=y.toLowerCase();if(I===c.toLowerCase()||I===d.toLowerCase())continue;const F=`${c.toLowerCase()}>${I}>${d.toLowerCase()}`;C.has(F)||(C.add(F),x.push([c,y,d]))}}async function A(E){let C=r*n;for(let y=0;y<E.length-1;y++){const I=E[y],F=E[y+1],R=await f.getPair(I,F);if(!R||R.toLowerCase()===Oe.toLowerCase())throw new Error("Gas conversion pool not found.");const O=s?["function token0() view returns(address)","function token1() view returns(address)","function getReserves() view returns(uint256,uint256)"]:["function token0() view returns(address)","function token1() view returns(address)","function getReserves() view returns(uint112,uint112,uint32)"],J=new B(R,O,S),[Q,D,X]=await Promise.all([J.token0(),J.token1(),J.getReserves()]);let Ee,Me;if(I.toLowerCase()===Q.toLowerCase()&&F.toLowerCase()===D.toLowerCase())Ee=BigInt(X[0]),Me=BigInt(X[1]);else if(I.toLowerCase()===D.toLowerCase()&&F.toLowerCase()===Q.toLowerCase())Ee=BigInt(X[1]),Me=BigInt(X[0]);else throw new Error("Gas conversion pool token mismatch.");if(Ee<=0n||Me<=0n)throw new Error("Gas conversion pool has empty reserves.");const Tt=C*p*Me*n,It=Ee*i*n+C*p;if(C=Tt/It,C<=0n)throw new Error("Gas conversion precision was insufficient.")}return(C+n-1n)/n}const L=await Promise.allSettled(x.map(E=>A(E)));let v=0n;for(const E of L)E.status==="fulfilled"&&E.value>v&&(v=E.value);if(v<=0n)throw new Error(`Unable to convert QMS gas into ${t}: no usable ${a} pool route was found.`);return v}async function Ue(e,t,a,r){if(e.gasStatus="wallet-not-connected",e.gasUnits=null,e.gasPriceWei=null,e.gasCostWei=null,e.gasCostOutputRaw=null,e.netOutput=null,!l||!q)return e;try{if((await q.provider.getNetwork()).chainId!==BigInt(N))return e.gasStatus="wrong-wallet-network",e;if((e.venue==="QWAP"||e.venue==="QMSwap")&&t!=="QMS"){const w=new B(h(t).address,pe,S),p=e.venue==="QWAP"?re:m.router;if(BigInt(await w.allowance(l,p))<BigInt(r))return e.gasStatus="approval-required",e}const i=BigInt(Math.floor(Date.now()/1e3)+1200);let s;if(e.venue==="QWAP-WRAP"){const w=new B(de,["function deposit() payable","function withdraw(uint256 amount)"],q);if(t==="QMS"&&a==="QWAP_WQMS")s=await w.deposit.estimateGas({value:r});else if(t==="QWAP_WQMS"&&a==="QMS")s=await w.withdraw.estimateGas(r);else throw new Error("Invalid QMS/WQMS wrapping route.")}else if(e.venue==="QWAP"){const w=new B(re,Ze,q);t==="QMS"?s=await w.swapExactETHForTokens.estimateGas(0n,e.path,l,i,{value:r}):a==="QMS"?s=await w.swapExactTokensForETH.estimateGas(r,0n,e.path,l,i):s=await w.swapExactTokensForTokens.estimateGas(r,0n,e.path,l,i)}else if(e.venue==="QMSwap"){const w=new B(m.router,Ce,q),p=t==="QMS"?m.tokens.QMS.address:h(t).address,x=a==="QMS"?m.tokens.QMS.address:h(a).address;t==="QMS"?s=await w.swapExactQMSForTokens.estimateGas(x,0n,i,l,{value:r}):a==="QMS"?s=await w.swapExactTokensForQMS.estimateGas(p,r,0n,i,l):s=await w.swapExactTokensForTokens.estimateGas(p,x,r,0n,i,l)}else throw new Error("Unsupported venue for gas estimation.");if(s=BigInt(s),s<=0n)throw new Error("Gas estimate returned zero.");const c=await Lt(),d=s*c;e.gasUnits=s,e.gasPriceWei=c,e.gasCostWei=d;let u;try{u=await wa(d,a,e.venue)}catch(w){return e.gasStatus="gas-conversion-unavailable",e.gasError=$(w),e}e.gasCostOutputRaw=u;const f=tt(e.amountOut);return e.minimumOutput=f,u>=f?(e.netOutput=0n,e.gasStatus="gas-exceeds-output",e):(e.netOutput=f-u,e.gasStatus="estimated",e)}catch(n){return e.gasStatus="estimate-failed",e.gasError=$(n),e}}async function Pt(e,t,a){var f,w,p,x,A,L;if(e==="QMS"&&t==="QWAP_WQMS"||e==="QWAP_WQMS"&&t==="QMS"){const v={venue:"QWAP-WRAP",routerAddress:de,path:null,amountOut:a,pairAddresses:[],executionShortfallBps:null,depthVerified:!0};return await Ue(v,e,t,a),v}const r=[];if((e==="QMS"||ze(e))&&(t==="QMS"||ze(t))){const v=Ae(e),g=Ae(t);if(v&&g&&v.toLowerCase()!==g.toLowerCase()){const M=[[v,g]],b=[de,...Object.values(ue).map(C=>C.address)],E=new Set([`${v.toLowerCase()}>${g.toLowerCase()}`]);for(const C of b){const y=C.toLowerCase();if(y===v.toLowerCase()||y===g.toLowerCase())continue;const I=`${v.toLowerCase()}>${y}>${g.toLowerCase()}`;E.has(I)||(E.add(I),M.push([v,C,g]))}for(const C of M)try{const y=await yt.getAmountsOut(a,C),I=BigInt(y[y.length-1]);if(I>0n){const F=await ct("QWAP",re,Re,C,a,I);await Ue(F,e,t,a),r.push(F)}}catch(y){console.debug("QWAP route unavailable:",y)}}}if((e==="QMS"||qe(e))&&(t==="QMS"||qe(t))){const v=e==="QMS"?(w=(f=m==null?void 0:m.tokens)==null?void 0:f.QMS)==null?void 0:w.address:(p=h(e))==null?void 0:p.address,g=t==="QMS"?(A=(x=m==null?void 0:m.tokens)==null?void 0:x.QMS)==null?void 0:A.address:(L=h(t))==null?void 0:L.address;if(v&&g&&v.toLowerCase()!==g.toLowerCase())try{const M=BigInt(await We.quoteOut(v,g,a));if(M>0n){const b=await ct("QMSwap",m.router,m.factory,[v,g],a,M);await Ue(b,e,t,a),r.push(b)}}catch(M){console.debug("QMSwap V6 route unavailable:",M)}}if(r.length===0)throw new Error("No verified QWAP or QMSwap route with available liquidity was found.");const s=500n,c=r.filter(v=>v.depthVerified===!0&&v.executionShortfallBps!==null&&v.executionShortfallBps!==void 0&&BigInt(v.executionShortfallBps)<=s);if(c.length===0){const v=r.reduce((M,b)=>!M||b.amountOut>M.amountOut?b:M,null);if(!v||v.executionShortfallBps===null||v.executionShortfallBps===void 0)throw new Error("No route passed liquidity and execution checks.");const g=(Number(BigInt(v.executionShortfallBps))/100).toFixed(2);throw new Error("Best available route exceeds the 5.00% execution-impact limit ("+g+"%). Try a smaller input amount.")}const d=c.filter(v=>v.gasStatus==="estimated");let u=c;if(d.length>0){if(u=d.filter(v=>v.netOutput>0n),u.length===0)throw new Error("Estimated network gas cost is greater than or equal to the output amount.");u.sort((v,g)=>v.netOutput===g.netOutput?0:v.netOutput>g.netOutput?-1:1)}else u.sort((v,g)=>v.amountOut===g.amountOut?0:v.amountOut>g.amountOut?-1:1);return u[0]}let Se=0,se=null,me=null;const va=3e4;function lt(e){const t=["connectBtn","fromSelect","toSelect","amountIn","slippage","flipBtn","refreshBtn"];if(e){if(me)return;me=new Map;for(const a of t){const r=o(a);r&&(me.set(a,r.disabled),r.disabled=!0)}return}if(me){for(const[a,r]of me.entries()){const n=o(a);n&&(n.disabled=r)}me=null}}function ut(e,t,a,r){var i,s;if(!e)throw new Error("No valid swap quote is available. Refresh the quote and try again.");if(e.requestId!==Se)throw new Error("Swap quote changed. Please review the latest quote.");if(Date.now()-e.createdAt>va)throw new Error("Swap quote expired. Refresh the quote before submitting.");if(e.fromKey!==t||e.toKey!==a||e.amountIn!==BigInt(r))throw new Error("Swap details changed after quoting. Please review the quote again.");if(e.slippageBps!==le())throw new Error("Slippage changed after quoting. Refresh the quote.");if(e.wallet!==String(l||"").toLowerCase())throw new Error("Connected wallet changed. Please refresh the quote.");if(e.chainId!==N)throw new Error("Invalid quote network. Please use QMS Testnet.");const n=e.route;if(!n||BigInt(n.amountOut)!==e.amountOut)throw new Error("Invalid route snapshot.");if(e.amountOut<=0n||e.minOut<=0n)throw new Error("Invalid output amount. Refresh the quote.");if(e.minOut!==tt(e.amountOut))throw new Error("Minimum received changed after quoting.");if(n.venue==="QWAP"){if(!n.routerAddress||n.routerAddress.toLowerCase()!==re.toLowerCase())throw new Error("Quote router does not match the QWAP execution router.");if(n.depthVerified!==!0||n.executionShortfallBps===null||n.executionShortfallBps===void 0||BigInt(n.executionShortfallBps)>500n)throw new Error("Route did not pass the liquidity safety check.");const c=Ae(t),d=Ae(a);if(!Array.isArray(n.path)||n.path.length<2||!c||!d||n.path[0].toLowerCase()!==c.toLowerCase()||n.path[n.path.length-1].toLowerCase()!==d.toLowerCase())throw new Error("Route path does not match the selected trading pair.")}else if(n.venue==="QMSwap"){if(!n.routerAddress||n.routerAddress.toLowerCase()!==m.router.toLowerCase()||!n.factoryAddress||n.factoryAddress.toLowerCase()!==m.factory.toLowerCase())throw new Error("Quote router or factory does not match QMSwap V6.");if(n.depthVerified!==!0||n.executionShortfallBps===null||n.executionShortfallBps===void 0||BigInt(n.executionShortfallBps)>500n)throw new Error("QMSwap V6 route did not pass the liquidity safety check.");const c=t==="QMS"?m.tokens.QMS.address:qe(t)?(i=h(t))==null?void 0:i.address:null,d=a==="QMS"?m.tokens.QMS.address:qe(a)?(s=h(a))==null?void 0:s.address:null;if(!Array.isArray(n.path)||n.path.length!==2||!c||!d||n.path[0].toLowerCase()!==c.toLowerCase()||n.path[1].toLowerCase()!==d.toLowerCase()||!Array.isArray(n.pairAddresses)||n.pairAddresses.length!==1)throw new Error("QMSwap V6 direct route does not match the selected token contracts.")}else if(n.venue==="QWAP-WRAP"){if(!n.routerAddress||n.routerAddress.toLowerCase()!==de.toLowerCase())throw new Error("Invalid QMS/WQMS wrapping contract.");if(!(t==="QMS"&&a==="QWAP_WQMS"||t==="QWAP_WQMS"&&a==="QMS")||n.amountOut!==e.amountIn)throw new Error("Invalid QMS/WQMS wrapping quote.")}else throw new Error("Unsupported execution venue.")}async function H(){const e=++Se;if(Pe=0n,se=null,!o("amountIn"))return null;const t=o("fromSelect").value,a=o("toSelect").value,r=o("amountIn").value.trim();if(o("amountOut").value="",o("minReceived").textContent="--",o("estimatedNetworkFee").textContent=l?"Estimating...":"Connect wallet",o("netOutput").textContent="--",t===a)return o("estimatedNetworkFee").textContent="Unavailable",o("status").textContent="Choose two different tokens.",null;if(!r)return o("estimatedNetworkFee").textContent=l?"--":"Connect wallet",o("status").textContent="Enter an amount to get a quote.",null;try{const n=Z(r,t);if(n<=0n)return o("status").textContent="Enter an amount greater than zero.",null;const i=await Pt(t,a,n);if(e!==Se)return null;const s=BigInt(i.amountOut);if(s<=0n)throw new Error("The route returned an invalid output amount.");Pe=s,o("amountOut").value=P(s,T(a),10);const c=tt(s);o("minReceived").textContent=P(c,T(a),10)+" "+(h(a).symbol||a);const d={...i,path:Array.isArray(i.path)?[...i.path]:null,pairAddresses:Array.isArray(i.pairAddresses)?[...i.pairAddresses]:[]};return d.path&&Object.freeze(d.path),Object.freeze(d.pairAddresses),Object.freeze(d),se=Object.freeze({requestId:e,createdAt:Date.now(),wallet:String(l||"").toLowerCase(),chainId:N,fromKey:t,toKey:a,amountIn:n,amountOut:s,minOut:c,slippageBps:le(),route:d}),i.gasStatus==="estimated"?(o("estimatedNetworkFee").textContent=P(i.gasCostWei,18,18)+" QMS",o("netOutput").textContent=P(i.netOutput,T(a),10)+" "+(h(a).symbol||a),o("status").textContent="Quote ready. Route selected by estimated net output. Approval fees are separate."):i.gasStatus==="approval-required"?(o("estimatedNetworkFee").textContent="Approval required",o("netOutput").textContent="Available after approval",o("status").textContent="Quote ready. Approve the input token to estimate swap gas."):i.gasStatus==="wallet-not-connected"?(o("estimatedNetworkFee").textContent="Connect wallet",o("netOutput").textContent="Connect wallet",o("status").textContent="Quote ready. Connect your wallet to estimate network gas."):i.gasStatus==="gas-conversion-unavailable"?(o("estimatedNetworkFee").textContent=P(i.gasCostWei,18,18)+" QMS",o("netOutput").textContent="Unavailable",o("status").textContent="Swap gas is estimated in QMS, but conversion to the output token is unavailable."):i.gasStatus==="wrong-wallet-network"?(o("estimatedNetworkFee").textContent="Wrong network",o("netOutput").textContent="Unavailable",o("status").textContent="Switch your wallet to QMS Testnet."):i.gasStatus==="gas-exceeds-output"?(o("estimatedNetworkFee").textContent=P(i.gasCostWei,18,18)+" QMS",o("netOutput").textContent="Gas exceeds output",o("status").textContent="The estimated network fee exceeds the output amount."):(o("estimatedNetworkFee").textContent="Unavailable",o("netOutput").textContent="Not estimated",o("status").textContent="Gas estimation failed. Swap execution will remain disabled until gas can be verified."),se}catch(n){return e!==Se||(Pe=0n,se=null,o("amountOut").value="",o("minReceived").textContent="--",o("estimatedNetworkFee").textContent="Unavailable",o("netOutput").textContent="Not estimated",o("status").textContent=$(n)),null}}async function ha(){if(z)return;if(U){z=!0;const t=o("swapBtn");t&&(t.disabled=!0);try{await ra()}finally{z=!1,t&&(t.disabled=!1,t.textContent=U?"Check transaction":"Swap")}return}z=!0;const e=o("swapBtn");e&&(e.disabled=!0),o("txLink")&&(o("txLink").hidden=!0),lt(!0),se=null,++Se;try{await ce();const t=o("fromSelect").value,a=o("toSelect").value,r=o("amountIn").value.trim();if(!r)throw new Error("Enter an amount before swapping.");const n=Z(r,t);if(t===a||n<=0n)throw new Error("Invalid amount or trading pair.");k("Checking the best available route...");let i=await Pt(t,a,n);if(i.venue!=="QWAP"&&i.venue!=="QMSwap"&&i.venue!=="QWAP-WRAP")throw new Error("Unsupported swap venue. Legacy routing is disabled.");i.venue==="QWAP"&&t!=="QMS"?await we(h(t).address,n,re):i.venue==="QMSwap"&&t!=="QMS"&&await we(h(t).address,n,m.router),await ce();const s=j();if(!s)throw new Error("Wallet provider is no longer available.");const c=await s.request({method:"eth_accounts"});if(!c||!c.length)throw new Error("No wallet account is currently connected.");if(Y(c[0]).toLowerCase()!==l.toLowerCase())throw new Error("Wallet account changed. Reconnect and refresh the quote.");k("Refreshing quote and estimating swap gas...");const u=await H();ut(u,t,a,n);const f=u.route,w=u.amountOut,p=u.minOut;if(f.gasStatus!=="estimated"&&f.gasStatus!=="gas-conversion-unavailable")throw new Error("Swap gas could not be verified. Refresh the quote or check your wallet before submitting.");const x=BigInt(f.gasUnits??0n),A=BigInt(f.gasPriceWei??0n);if(x<=0n||A<=0n)throw new Error("A valid swap gas estimate is required before execution.");if(BigInt(f.gasCostWei??0n)<=0n)throw new Error("Estimated network fee is invalid.");k("Checking token balance, allowance and QMS gas balance...");let L=null,v;if(t==="QMS"?v=BigInt(await S.getBalance(l)):(L=new B(h(t).address,pe,S),v=BigInt(await L.balanceOf(l))),v<n)throw new Error("Insufficient "+(h(t).symbol||t)+" balance for this swap.");if((f.venue==="QWAP"||f.venue==="QMSwap")&&t!=="QMS"){const Q=f.venue==="QWAP"?re:m.router;if(BigInt(await L.allowance(l,Q))<n)throw new Error(f.venue+" Router allowance is insufficient. Approve the input token and retry.")}const g=BigInt(await Lt()),M=g>A?g:A,b=(x*M*120n+99n)/100n,E=BigInt(await S.getBalance(l)),C=b+(t==="QMS"?n:0n);if(E<C)throw new Error("Insufficient QMS for the input amount and estimated network gas. Required approximately "+P(C,18,8)+" QMS, including a 20% gas buffer.");const y=o("fromSelect").value,I=o("toSelect").value,F=Z(o("amountIn").value.trim(),y);ut(u,y,I,F),await ce();const R=BigInt(Math.floor(Date.now()/1e3)+1200);Pe=w;let O;if(f.venue==="QWAP-WRAP"){const Q=new B(de,["function deposit() payable","function withdraw(uint256 amount)"],q);if(t==="QMS"&&a==="QWAP_WQMS")await Q.deposit.staticCall({value:n}),k("Preflight passed. Confirm wrapping QMS into WQMS in your wallet..."),O=await Q.deposit({value:n});else if(t==="QWAP_WQMS"&&a==="QMS")await Q.withdraw.staticCall(n),k("Preflight passed. Confirm unwrapping WQMS into QMS in your wallet..."),O=await Q.withdraw(n);else throw new Error("Invalid QMS/WQMS wrapping route.")}else if(f.venue==="QWAP"){const Q=new B(re,Ze,q),D=[...f.path];t==="QMS"?(await Q.swapExactETHForTokens.staticCall(p,D,l,R,{value:n}),k("Preflight passed. Confirm the QWAP swap in your wallet..."),O=await Q.swapExactETHForTokens(p,D,l,R,{value:n})):a==="QMS"?(await Q.swapExactTokensForETH.staticCall(n,p,D,l,R),k("Preflight passed. Confirm the QWAP swap in your wallet..."),O=await Q.swapExactTokensForETH(n,p,D,l,R)):(await Q.swapExactTokensForTokens.staticCall(n,p,D,l,R),k("Preflight passed. Confirm the QWAP swap in your wallet..."),O=await Q.swapExactTokensForTokens(n,p,D,l,R))}else if(f.venue==="QMSwap"){const Q=new B(m.router,Ce,q),D=h(t).address,X=h(a).address;t==="QMS"?(await Q.swapExactQMSForTokens.staticCall(X,p,R,l,{value:n}),k("Preflight passed. Confirm the QMSwap V6 swap in your wallet..."),O=await Q.swapExactQMSForTokens(X,p,R,l,{value:n})):a==="QMS"?(await Q.swapExactTokensForQMS.staticCall(D,n,p,R,l),k("Preflight passed. Confirm the QMSwap V6 swap in your wallet..."),O=await Q.swapExactTokensForQMS(D,n,p,R,l)):(await Q.swapExactTokensForTokens.staticCall(D,X,n,p,R,l),k("Preflight passed. Confirm the QMSwap V6 swap in your wallet..."),O=await Q.swapExactTokensForTokens(D,X,n,p,R,l))}else throw new Error("Unsupported swap venue.");if(!O||!O.hash)throw new Error("Wallet did not return a valid transaction.");k("Transaction submitted: "+O.hash+". Waiting for confirmation..."),U={hash:O.hash,submittedAt:Date.now(),fromKey:t,toKey:a,amountIn:n,expectedAmountOut:w,minimumReceived:p,estimatedGasWei:BigInt(f.gasCostWei),outputAddress:h(a).address,recipient:l,outputDecimals:T(a),outputSymbol:h(a).symbol||a,venue:f.venue},St(U),he(O.hash),et(U);const J=await na(O,U);if(!J){k("Transaction submitted but still pending. The hash is preserved. Press Check transaction to query the receipt; no duplicate swap will be sent.");return}if(await At(J,U),!J||Number(J.status)!==1)throw new Error("Swap transaction failed on-chain.");he(O.hash),k("Swap successful at block "+J.blockNumber+".","success"),o("amountIn").value="",o("amountOut").value="",se=null;try{await ae(),await H()}catch(Q){console.warn("Post-swap refresh failed:",Q),k("Swap confirmed, but the balance refresh failed. Use Refresh to update balances.","success")}}catch(t){se=null,k("Swap failed: "+$(t),"error")}finally{z=!1,lt(!1),e&&(e.disabled=!1,e.textContent=U?"Check transaction":"Swap")}}async function ga(){o("connectBtn").addEventListener("click",async()=>{try{await be(!0),await V()}catch(e){k($(e),"error")}}),o("tokenA").addEventListener("change",async()=>{o("tokenA").value===o("tokenB").value&&(o("tokenB").value=ee().find(e=>e!==o("tokenA").value)),o("amountA").value="",o("amountB").value="",K(),await G("")}),o("tokenB").addEventListener("change",async()=>{o("tokenB").value===o("tokenA").value&&(o("tokenA").value=ee().find(e=>e!==o("tokenB").value)),o("amountA").value="",o("amountB").value="",K(),await G("")}),o("amountA").addEventListener("input",()=>{Ge="A",G("A")}),o("amountB").addEventListener("input",()=>{Ge="B",G("B")}),o("slippage").addEventListener("change",async()=>{await G(""),await V()}),o("refreshBtn").addEventListener("click",async()=>{await ae(),await G(""),await V()}),o("refreshRemoveBtn").addEventListener("click",V),o("addBtn").addEventListener("click",ba),o("removePool").addEventListener("change",async()=>{o("removeLpAmount").value="",await V()}),o("removeLpAmount").addEventListener("input",V),o("removeMaxBtn").addEventListener("click",async()=>{if(!l){W("Connect your wallet to view your LP balance.","error");return}ie||await V();const e=(ie==null?void 0:ie.lpBalance)||0n;o("removeLpAmount").value=Ye(e,18).replace(/\.?0+$/,""),await V()}),o("removeBtn").addEventListener("click",ka),K(),await G(""),await V()}async function at(e,t){const a=h(e),r=h(t),n=await kt.getPair(a.address,r.address);if(!n||n.toLowerCase()===Oe.toLowerCase())throw new Error("Pool not found: "+e+"/"+t);const i=new B(n,bt,S),[s,c]=await Promise.all([i.token0(),i.getReserves()]),d=BigInt(c[0]),u=BigInt(c[1]),f=String(s).toLowerCase()===a.address.toLowerCase();return{address:n,pair:i,reserveA:f?d:u,reserveB:f?u:d}}let _e=null,pt=0,Ge="A",ie=null;function Fe(e){const t=String(e).match(/^(\d+)(?:\.(\d+))?$/);if(!t)throw new Error("Reference price is invalid.");const a=((t[2]||"")+"00000000").slice(0,8);return BigInt(t[1])*100000000n+BigInt(a)}async function mt(){if(_e&&Date.now()-pt<3e4)return _e;const e=encodeURIComponent(JSON.stringify(["ETHUSDT","BTCUSDT","BNBUSDT"])),t=[`https://data-api.binance.vision/api/v3/ticker/price?symbols=${e}`,`https://api.binance.com/api/v3/ticker/price?symbols=${e}`];let a=null,r=null;for(const s of t)try{const c=await fetch(s,{cache:"no-store"});if(!c.ok)throw new Error(`HTTP ${c.status}`);const d=await c.json();if(!Array.isArray(d))throw new Error("Price data has an invalid format.");a=d;break}catch(c){r=c}if(!a)throw o("priceSource")&&(o("priceSource").textContent="Unable to retrieve reference prices"),new Error("Unable to retrieve Binance Spot prices. A safe ratio cannot be calculated for an empty pool. "+((r==null?void 0:r.message)||""));const n=new Map(a.map(s=>[s.symbol,s.price])),i={QMS:100000000n,USDT:100000000n,USDC:100000000n,ETH:Fe(n.get("ETHUSDT")),BTC:Fe(n.get("BTCUSDT")),BNB:Fe(n.get("BNBUSDT"))};for(const s of["ETH","BTC","BNB"])if(i[s]<=0n)throw new Error(`Price of ${s} is invalid.`);return _e=i,pt=Date.now(),i}function ft(e,t,a,r){const n=BigInt(T(t)),i=BigInt(T(a)),s=e*r[t]*10n**i/(r[a]*10n**n);if(s<=0n)throw new Error("The amount is too small to calculate the corresponding token amount.");return s}function wt(e,t){let a=Ye(e,T(t));return a.includes(".")&&(a=a.replace(/0+$/,"").replace(/\.$/,"")),a||"0"}async function G(e){Le=0n;const t=o("tokenA").value,a=o("tokenB").value;if(t===a){o("poolInfo").textContent="Choose two different tokens.";return}try{const r=await at(t,a);o("poolInfo").textContent=Te(r.address),o("reservesInfo").textContent=`${P(r.reserveA,T(t),8)} ${t} / ${P(r.reserveB,T(a),8)} ${a}`;const n=r.reserveA>0n&&r.reserveB>0n;if(o("priceSource").textContent=n?"Current pool reserve ratio":"Binance reference price; QMS is assumed to equal 1 USD",e==="A"){const c=Z(o("amountA").value,t);if(o("amountB").value="",c>0n){let d;if(n)d=c*r.reserveB/r.reserveA;else{const u=await mt();d=ft(c,t,a,u)}if(d<=0n)throw new Error("The calculated corresponding token amount is zero.");o("amountB").value=wt(d,a)}}else if(e==="B"){const c=Z(o("amountB").value,a);if(o("amountA").value="",c>0n){let d;if(n)d=c*r.reserveA/r.reserveB;else{const u=await mt();d=ft(c,a,t,u)}if(d<=0n)throw new Error("The calculated corresponding token amount is zero.");o("amountA").value=wt(d,t)}}const i=Z(o("amountA").value,t),s=Z(o("amountB").value,a);i>0n&&s>0n?(Le=BigInt(await We.previewLiquidity(h(t).address,h(a).address,i,s)),o("sharesInfo").textContent=Le>0n?P(Le,18,8)+" LP (estimated)":"The amount is too small or the pool is invalid."):o("sharesInfo").textContent="Enter one amount; the other token amount is calculated automatically"}catch{o("poolInfo").textContent="Unable to read the pool.",o("reservesInfo").textContent="--",o("sharesInfo").textContent="--"}}async function ba(){if(!z){z=!0,o("addBtn").disabled=!0,o("txLink").hidden=!0;try{await ce();const e=o("tokenA").value,t=o("tokenB").value;if(e===t)throw new Error("Please select two different assets.");await G(Ge);const a=Z(o("amountA").value.trim(),e),r=Z(o("amountB").value.trim(),t);if(a<=0n||r<=0n)throw new Error("Enter an amount greater than zero for both assets.");const n=BigInt(await We.previewLiquidity(h(e).address,h(t).address,a,r));if(n<=0n)throw new Error("The amount is too small to receive LP shares.");const i=n*(10000n-le())/10000n,s=BigInt(Math.floor(Date.now()/1e3)+1200),c=new B(m.router,Ce,q);let d;e==="QMS"?(await we(h(t).address,r),await c.addLiquidityNative.staticCall(h(t).address,r,i,s,l,{value:a}),k("Confirm Add Liquidity in MetaMask..."),d=await c.addLiquidityNative(h(t).address,r,i,s,l,{value:a})):t==="QMS"?(await we(h(e).address,a),await c.addLiquidityNative.staticCall(h(e).address,a,i,s,l,{value:r}),k("Confirm Add Liquidity in MetaMask..."),d=await c.addLiquidityNative(h(e).address,a,i,s,l,{value:r})):(await we(h(e).address,a),await we(h(t).address,r),await c.addLiquidity.staticCall(h(e).address,h(t).address,a,r,i,s,l),k("Confirm Add Liquidity in MetaMask..."),d=await c.addLiquidity(h(e).address,h(t).address,a,r,i,s,l)),k("Transaction submitted: "+d.hash+". Waiting for confirmation...");const u=await d.wait();if(!u||u.status!==1)throw new Error("Add Liquidity failed.");he(d.hash),k(`Liquidity added to ${e}/${t} at block ${u.blockNumber}.`,"success"),await ae(),await G("")}catch(e){k("Failed to add liquidity: "+$(e),"error")}finally{z=!1,o("addBtn").disabled=!1}}}function W(e,t=""){const a=o("removeStatus");a&&(a.textContent=e,a.className=("status "+t).trim())}async function V(){var r;const e=((r=m==null?void 0:m.features)==null?void 0:r.removeLiquidity)===!0,t=o("removeBtn");if(!t)return;o("removeFeatureNotice").hidden=e,t.disabled=!0;const a=o("removePool").value;if(!a){ie=null,o("removePoolAddress").textContent="—",o("removeLpBalance").textContent=l?"No pool selected":"Connect wallet to view balance",o("removeEstimateA").textContent="—",o("removeEstimateB").textContent="—",o("removeMinA").textContent="—",o("removeMinB").textContent="—",W("Choose a pool and enter an LP amount.");return}try{const[n,i]=a.split("/"),s=await at(n,i),[c,d]=await Promise.all([s.pair.totalSupply(),l?s.pair.balanceOf(l):Promise.resolve(0n)]);ie={...s,keyA:n,keyB:i,supply:BigInt(c),lpBalance:BigInt(d)},o("removePoolAddress").textContent=Te(s.address),o("removeLpBalance").textContent=l?P(BigInt(d),18,8)+" LP available":"Connect wallet to view balance";let u=0n;const f=o("removeLpAmount").value.trim();if(f)try{u=Je(f,18)}catch{throw new Error("Enter a valid LP amount with up to 18 decimal places.")}let w=0n,p=0n;u>0n&&BigInt(c)>0n&&(w=u*s.reserveA/BigInt(c),p=u*s.reserveB/BigInt(c));const x=w*(10000n-le())/10000n,A=p*(10000n-le())/10000n;o("removeEstimateA").textContent=P(w,T(n),8)+" "+n,o("removeEstimateB").textContent=P(p,T(i),8)+" "+i,o("removeMinA").textContent=P(x,T(n),8)+" "+n,o("removeMinB").textContent=P(A,T(i),8)+" "+i,e?l?u<=0n?W("Enter the LP amount you want to remove."):u>BigInt(d)?W("The entered amount exceeds your LP balance.","error"):w<=0n||p<=0n?W("The entered amount is too small to return both assets.","error"):W("Review the estimates and minimum received amounts."):W("Connect your wallet to remove liquidity."):W("Read-only preview. Transactions are disabled until compatible contracts are deployed."),t.disabled=!e||!l||u<=0n||u>BigInt(d)||w<=0n||p<=0n}catch(n){ie=null,o("removeEstimateA").textContent="—",o("removeEstimateB").textContent="—",o("removeMinA").textContent="—",o("removeMinB").textContent="—",W($(n),"error")}}async function ka(){var e;if(!z){if(((e=m==null?void 0:m.features)==null?void 0:e.removeLiquidity)!==!0){W("Remove Liquidity is disabled until the updated contracts are deployed.","error");return}z=!0,o("removeBtn").disabled=!0,o("removeTxLink").hidden=!0;try{await ce();const[t,a]=o("removePool").value.split("/");if(!t||!a)throw new Error("Choose a pool first.");const r=Je(o("removeLpAmount").value.trim(),18);if(r<=0n)throw new Error("Enter an LP amount greater than zero.");const n=await at(t,a),[i,s]=await Promise.all([n.pair.balanceOf(l),n.pair.totalSupply()]);if(r>BigInt(i))throw new Error("The LP amount exceeds your wallet balance.");if(BigInt(s)<=0n)throw new Error("The pool has no LP supply.");const c=r*n.reserveA/BigInt(s),d=r*n.reserveB/BigInt(s);if(c<=0n||d<=0n)throw new Error("The LP amount is too small to return both assets.");const u=le(),f=c*(10000n-u)/10000n,w=d*(10000n-u)/10000n,p=BigInt(Math.floor(Date.now()/1e3)+1200),x=new B(n.address,bt,q);BigInt(await x.allowance(l,m.router))<r&&(W("Confirm LP token approval in your wallet..."),await(await x.approve(m.router,r)).wait());const L=new B(m.router,Ce,q);let v;if(t==="QMS"||a==="QMS"){const b=t==="QMS"?a:t,E=t==="QMS"?w:f,C=t==="QMS"?f:w;await L.removeLiquidityNative.staticCall(h(b).address,r,E,C,p,l),W("Confirm Remove Liquidity in your wallet..."),v=await L.removeLiquidityNative(h(b).address,r,E,C,p,l)}else await L.removeLiquidity.staticCall(h(t).address,h(a).address,r,f,w,p,l),W("Confirm Remove Liquidity in your wallet..."),v=await L.removeLiquidity(h(t).address,h(a).address,r,f,w,p,l);W("Transaction submitted: "+v.hash+". Waiting for confirmation...");const g=await v.wait();if(!g||g.status!==1)throw new Error("Remove Liquidity failed.");const M=o("removeTxLink");M.href=`${Xe}/tx/${v.hash}`,M.textContent="View transaction on QMSScan",M.hidden=!1,o("removeLpAmount").value="",W(`Liquidity removed from ${t}/${a} at block ${g.blockNumber}.`,"success"),await ae(),await G("")}catch(t){W("Failed to remove liquidity: "+$(t),"error")}finally{z=!1,await V()}}}async function ya(e,t){var s;const a=h(e),r=a==null?void 0:a.address,n=document.querySelector(`[data-faucet-key="${e}"]`),i=n==null?void 0:n.querySelector(".contract-copy-status");if(!r){i&&(i.textContent="Contract address is unavailable.");return}try{let c=!1;if((s=navigator.clipboard)!=null&&s.writeText)try{await navigator.clipboard.writeText(r),c=!0}catch{}if(!c){const d=document.createElement("textarea");d.value=r,d.setAttribute("readonly",""),d.style.position="fixed",d.style.opacity="0",document.body.appendChild(d),d.select(),c=document.execCommand("copy"),d.remove()}if(!c)throw new Error("Clipboard access was denied.");t.classList.add("copied"),t.title="Copied",t.setAttribute("aria-label","Contract address copied"),i&&(i.textContent="Contract address copied. Paste it into Swap > Import Token."),setTimeout(()=>{t.isConnected&&(t.classList.remove("copied"),t.title="Copy contract address",t.setAttribute("aria-label","Copy contract address"))},1800)}catch{i&&(i.textContent="Copy failed. Select and copy the contract address manually.")}}function xa(){o("connectBtn").addEventListener("click",()=>be(!0).catch(t=>k($(t),"error"))),o("refreshBtn").addEventListener("click",async()=>{await ae(),await ge()});const e=ee().filter(t=>t!=="QMS");o("faucetGrid").innerHTML=e.map(t=>`
    <article class="faucet-card" data-faucet-key="${t}">
      <div class="token-icon">${t.slice(0,1)}</div>
      <h3>${h(t).displayName}</h3>
      <div class="faucet-contract">
        <div class="faucet-contract-header">
          <div class="faucet-contract-label">Token contract</div>
          <button class="secondary-btn faucet-copy-btn"
                  type="button"
                  title="Copy contract address"
                  aria-label="Copy contract address"
                  data-copy-contract="${t}">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="8" y="8" width="12" height="13" rx="2"></rect>
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
        </div>
        <div class="faucet-contract-row">
          <code class="faucet-contract-address">${h(t).address}</code>
        </div>
        <div class="contract-copy-status" aria-live="polite"></div>
      </div>
      <div class="faucet-amount">Amount: --</div>
      <div class="faucet-balance">Balance: --</div>
      <div class="faucet-cooldown">Claim available</div>
      <button class="primary-btn claim-btn" data-claim="${t}">Faucet ${h(t).displayName}</button>
      <div class="claim-status" role="status"></div>
    </article>
  `).join(""),document.querySelectorAll("[data-claim]").forEach(t=>{t.addEventListener("click",()=>Sa(t.dataset.claim,t))}),document.querySelectorAll("[data-copy-contract]").forEach(t=>{t.addEventListener("click",()=>ya(t.dataset.copyContract,t))}),ge()}async function ge(){if(!m||oe()!=="faucet")return;const e=ee().filter(a=>a!=="QMS");let t=BigInt(Math.floor(Date.now()/1e3));try{const a=await S.getBlock("latest");a&&(t=BigInt(a.timestamp))}catch{}for(const a of e){const r=document.querySelector(`[data-faucet-key="${a}"]`);if(!r)continue;const n=r.querySelector(".faucet-amount"),i=r.querySelector(".faucet-balance"),s=r.querySelector(".faucet-cooldown"),c=r.querySelector(".claim-btn");try{const d=new B(h(a).address,pe,S),u=BigInt(await d.faucetAmount()),f=await d.owner().catch(()=>""),w=await d.adminFaucetAmount().catch(()=>null),x=!!(l&&w!==null&&f&&l.toLowerCase()===f.toLowerCase())?BigInt(w):u,A=BigInt(l?await d.nextClaimAt(l):0n);if(n.textContent="Amount per claim: "+P(x,T(a),8)+" "+a,i.textContent=l?"Balance: "+P(ne[a]??await d.balanceOf(l),T(a),8)+" "+a:"Balance: Connect wallet",!l)s.textContent="Connect your wallet to receive tokens.",c.disabled=!1;else if(A>t){const L=Math.ceil(Number(A-t)/60);s.textContent=`You can claim again in approximately ${L} minutes.`,c.disabled=!0}else s.textContent="Available to claim now.",c.disabled=!1}catch(d){n.textContent="Unable to load faucet configuration.",s.textContent=$(d),c.disabled=!0}}}async function Sa(e,t){const a=document.querySelector(`[data-faucet-key="${e}"]`),r=a==null?void 0:a.querySelector(".claim-status");t.disabled=!0;try{await ce();const n=new B(h(e).address,pe,q),i=await n.owner().catch(()=>""),c=!!(await n.adminFaucetAmount().catch(()=>null)!==null&&i&&l&&l.toLowerCase()===i.toLowerCase()),d=BigInt(c?0n:await n.nextClaimAt(l)),u=await S.getBlock("latest"),f=BigInt((u==null?void 0:u.timestamp)??Math.floor(Date.now()/1e3));if(d>f)throw new Error("The next claim is not available yet.");r.textContent="Confirm the transaction in MetaMask...";const w=await n.faucet();r.textContent="Transaction submitted: "+w.hash+". Waiting for confirmation...";const p=await w.wait();if(!p||p.status!==1)throw new Error("Faucet transaction failed.");r.textContent="Tokens claimed successfully.",await ae(),await ge()}catch(n){r.textContent="Faucet failed: "+$(n)}finally{t.disabled=!1,await ge()}}async function Aa(){var t;const e=oe();try{if(await oa(),e==="swap"&&await ma(),e==="swap"?Ht():e==="liquidity"?jt():e==="market"?await Ft():Vt(),(t=j())!=null&&t.on&&(j().on("accountsChanged",()=>location.reload()),j().on("chainChanged",()=>location.reload())),j()){const a=await j().request({method:"eth_accounts"});if(a!=null&&a.length)try{await be(!1)}catch(r){k($(r),"error")}}}catch(a){o("app").innerHTML=`
      <main class="load-error">
        <h1>QMSwap is not ready</h1>
        <p>${String($(a)).replace(/</g,"&lt;")}</p>
        <p>Check the V3 deployment configuration before opening the interface.</p>
      </main>`}}Aa();
