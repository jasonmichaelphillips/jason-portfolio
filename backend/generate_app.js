const fs = require('fs');
let code = fs.readFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', 'utf8');

const prefix = `(async function initDashboard() {
  try {
    const res = await fetch('http://localhost:3000/api/finance');
    const liveData = await res.json();
    if (liveData.aligned && liveData.aligned.length > 0) {
      ALIGNED = liveData.aligned;
      window.LIVE_CURRENT = liveData.current;
    }
  } catch(e) {
    console.log("Failed to fetch live data", e);
  }
  
  const CURR_PRICE = window.LIVE_CURRENT ? window.LIVE_CURRENT.mstr : 187.59;
  const CURR_BTC = window.LIVE_CURRENT ? window.LIVE_CURRENT.btc : 80400;

  if (window.LIVE_CURRENT) {
     const btcN = 818334;
     const debt = 8.17e9;
     const sh = 333.9e6;
     const btcValue = CURR_BTC * btcN;
     const navNet = btcValue - debt;
     const mktCap = CURR_PRICE * sh;
     const mnavR = mktCap / navNet;
     
     const e1 = document.getElementById('heroMstrPrice'); if(e1) e1.textContent = '$' + CURR_PRICE.toLocaleString('en-US',{maximumFractionDigits:2});
     const e2 = document.getElementById('heroMnavRatio'); if(e2) e2.textContent = mnavR.toFixed(2);
     const e3 = document.getElementById('btcFairValueLabel'); if(e3) e3.textContent = 'Fair value @ $' + CURR_BTC.toLocaleString('en-US',{maximumFractionDigits:0});
     const e4 = document.getElementById('btcFairValue'); if(e4) e4.textContent = '$' + (btcValue/1e9).toFixed(2) + 'B';
     const e5 = document.getElementById('btcNetDebt'); if(e5) e5.textContent = '$' + (navNet/1e9).toFixed(2) + 'B';
     
     const bp = document.getElementById('btcPrice'); if(bp) bp.value = CURR_BTC;
     const mp = document.getElementById('mstrPrice'); if(mp) mp.value = CURR_PRICE;
     const hd = document.getElementById('heroDate'); if(hd) hd.textContent = "Medium-term investment dashboard \u2014 " + new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  }
`;

// Modify metrics
code = code.replace(
  "const metrics = [",
  "const metrics = [\n  {label:'Price',          value:fmtMoney(CURR_PRICE), sub:'live quote'},\n  {label:'BTC reference',  value:fmtMoney(CURR_BTC, 0), sub:'live quote'},"
);
code = code.replace("{label:'Price',          value:'$187.59', sub:'+4.31% (after-hours)'},", "");
code = code.replace("{label:'BTC reference',  value:'$80,395', sub:'−36% from 52w high'},", "");
code = code.replace("const CURR_PRICE = 187.59;", "");

code = prefix + "\n" + code + "\n})();\n";
fs.writeFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', code);
console.log('app.js patched cleanly');
