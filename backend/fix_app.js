const fs = require('fs');
let code = fs.readFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', 'utf8');

// Replace the problematic fmtMoney calls in the prefix block with an inline helper, or redefine them early.
code = code.replace(
  "const e1 = document.getElementById('heroMstrPrice'); if(e1) e1.textContent = fmtMoney(CURR_PRICE, 2);",
  "const e1 = document.getElementById('heroMstrPrice'); if(e1) e1.textContent = '$'+CURR_PRICE.toLocaleString('en-US',{maximumFractionDigits:2});"
);

code = code.replace(
  "const e3 = document.getElementById('btcFairValueLabel'); if(e3) e3.textContent = 'Fair value @ ' + fmtMoney(CURR_BTC, 0);",
  "const e3 = document.getElementById('btcFairValueLabel'); if(e3) e3.textContent = 'Fair value @ $' + CURR_BTC.toLocaleString('en-US',{maximumFractionDigits:0});"
);

code = code.replace(
  "const e4 = document.getElementById('btcFairValue'); if(e4) e4.textContent = fmtBn(btcValue);",
  "const e4 = document.getElementById('btcFairValue'); if(e4) e4.textContent = '$'+(btcValue/1e9).toFixed(2)+'B';"
);

code = code.replace(
  "const e5 = document.getElementById('btcNetDebt'); if(e5) e5.textContent = fmtBn(navNet);",
  "const e5 = document.getElementById('btcNetDebt'); if(e5) e5.textContent = '$'+(navNet/1e9).toFixed(2)+'B';"
);

fs.writeFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', code);
console.log('Fixed early function calls');
