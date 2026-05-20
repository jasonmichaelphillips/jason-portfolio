const fs = require('fs');
let code = fs.readFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', 'utf8');
code = code.replace(
  "document.querySelectorAll('#metricsDate').forEach(el => el.textContent = new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}));",
  "document.querySelectorAll('#metricsDate').forEach(el => el.textContent = new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}));\n     const fd = document.getElementById('footerDate'); if(fd) fd.textContent = new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});"
);
fs.writeFileSync('/Users/jason/jason-portfolio/StrategyDashboard/app.js', code);
