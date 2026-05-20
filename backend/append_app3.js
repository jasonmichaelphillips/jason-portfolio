const fs = require('fs');
let code = fs.readFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', 'utf8');
code = code.replace(
  "const mp = document.getElementById('mstrPrice'); if(mp) mp.value = CURR_PRICE;",
  "const mp = document.getElementById('mstrPrice'); if(mp) mp.value = CURR_PRICE;\n     document.querySelectorAll('.dynPrice').forEach(el => el.textContent = '$'+CURR_PRICE.toLocaleString('en-US',{maximumFractionDigits:2}));"
);
fs.writeFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', code);
