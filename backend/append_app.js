const fs = require('fs');
let code = fs.readFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', 'utf8');
code = code.replace(
  "const hd = document.getElementById('heroDate'); if(hd) hd.textContent = \"Medium-term investment dashboard \\u2014 \" + new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});",
  "const hd = document.getElementById('heroDate'); if(hd) hd.textContent = \"Medium-term investment dashboard \\u2014 \" + new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});\n     document.querySelectorAll('#metricsDate').forEach(el => el.textContent = new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}));"
);
fs.writeFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', code);
