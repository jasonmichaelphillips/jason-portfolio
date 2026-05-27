/* MSTR dashboard — loads live data before rendering charts */

const COLORS = {
  gold: '#F7931A',
  goldSoft: 'rgba(247,147,26,0.12)',
  goldLine: 'rgba(247,147,26,0.55)',
  white: '#f3f6fb',
  whiteSoft: 'rgba(255,255,255,0.18)',
  blue: '#5ea0ff',
  green: '#28d07a',
  red: '#ff5a6e',
  gridDim: 'rgba(255,255,255,0.06)',
  gridText: 'rgba(255,255,255,0.55)',
};

Chart.defaults.color = COLORS.gridText;
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.borderColor = COLORS.gridDim;

const fmtMoney = (n, d = 2) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: d });
const fmtBn = (n) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return '$' + (n / 1e9).toFixed(2) + 'B';
};
const btcReserveValue = (mnav, btc, btcHeld) =>
  mnav?.btcReserve ?? (btc && btcHeld ? btc * btcHeld : null);
const fmtPct = (n, signed = true) => {
  const s = signed && n >= 0 ? '+' : '';
  return s + n.toFixed(1) + '%';
};

function getApiUrl() {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  ) {
    return 'http://localhost:3000/api/finance';
  }
  // Always use HTTPS in production to ensure data integrity
  return `https://jasonmichaelphillips.com/api/finance`;
}

function paintSliders() {
  document.querySelectorAll('input[type="range"]').forEach((s) => {
    const min = +s.min;
    const max = +s.max;
    const val = +s.value;
    const pct = ((val - min) / (max - min)) * 100;
    s.style.setProperty('--p', pct + '%');
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setBadgeChange(el, pct) {
  if (!el) return;
  el.textContent = fmtPct(pct);
  el.className = 'badge ' + (pct >= 0 ? 'badge-up' : 'badge-down');
}

function getAnalystTargets(data) {
  if (data?.analysts?.targets?.length) return data.analysts.targets;
  if (typeof TARGETS !== 'undefined' && TARGETS.length) return TARGETS;
  return [];
}

function fmtMnavTag(r) {
  if (r > 1.4) return 'Premium re-expanding';
  if (r > 1.1) return 'Modest premium';
  if (r > 0.95) return 'Near 1× — slight premium';
  if (r > 0.85) return 'Discount to NAV';
  return 'Deep discount to NAV';
}

function ma(arr, n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= n) sum -= arr[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

/* ============== BOOT ============== */
(async function boot() {
  let data = null;
  try {
    const res = await fetch(getApiUrl());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
    if (!data.aligned?.length) throw new Error('Empty series');
  } catch (e) {
    console.warn('Live API unavailable:', e);
  }

  if (!data) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<div style="background:#ff5a6e;color:#fff;padding:12px;text-align:center">Unable to load market data. Start the API: <code>cd backend && npm start</code></div>'
    );
    return;
  }

  window.FINANCE_DATA = data;
  window.ALIGNED = data.aligned;
  window.LIVE_CURRENT = data.current;
  window.ANALYST_TARGETS = getAnalystTargets(data);

  try {
    initDashboard(data);
  } catch (err) {
    console.error('Dashboard init failed:', err);
  }
  try {
    initCharts(data);
  } catch (err) {
    console.error('Charts init failed:', err);
  }
})();

/* ============== DOM UPDATES ============== */
function initDashboard(data) {
  const { current, meta, company, technicals, mnav } = data;
  const price = current.mstr;
  const btc = current.btc;
  const shares = company.shares;
  const debtB = company.debt / 1e9;

  setText('heroMstrPrice', fmtMoney(price));
  setBadgeChange(document.getElementById('heroMstrChange'), current.mstrChangePct);
  setText(
    'heroDate',
    'Medium-term investment dashboard — ' +
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  );
  setText('heroBtcHeld', company.btcHeld.toLocaleString('en-US') + ' BTC');

  if (mnav.ratio != null) {
    setText('heroMnavRatio', mnav.ratio.toFixed(2));
    setText('heroMnavNote', fmtMnavTag(mnav.ratio));
  }

  const dd = technicals.drawdownPct;
  setHtml('heroDrawdown', (dd >= 0 ? '+' : '−') + Math.abs(Math.round(dd)));
  setText('hero52wHigh', fmtMoney(meta.fiftyTwoWeekHigh, 2));

  const analystTargets = getAnalystTargets(data);
  if (analystTargets.length) {
    const c = data.analysts?.consensus;
    const avg = c?.average ?? analystTargets.reduce((s, t) => s + t.target, 0) / analystTargets.length;
    const upside = ((avg - price) / price) * 100;
    setText('heroAnalystAvg', fmtMoney(avg, 0));
    setText('heroAnalystNote', fmtPct(upside) + ' upside · ' + analystTargets.length + ' analysts');
    updateAnalystSection(price, data.analysts, analystTargets);
  }

  setText('btcHeldDisplay', company.btcHeld.toLocaleString('en-US'));
  const btcReserve = btcReserveValue(mnav, btc, company.btcHeld);
  setText('btcFairValueLabel', 'BTC reserve @ ' + fmtMoney(btc, 0));
  setText('btcFairValue', fmtBn(btcReserve));
  setText('btcNetDebt', fmtBn(mnav.navNet));
  setText('btcYtdGrowth', company.btcYieldYtd != null ? '+' + company.btcYieldYtd + '%' : '—');
  setText('btcAsOf', company.asOfDate || current.date);

  document.querySelectorAll('#metricsDate').forEach((el) => {
    el.textContent = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });
  setText('footerDate', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  document.querySelectorAll('.dynPrice').forEach((el) => {
    el.textContent = fmtMoney(price);
  });

  setText('lvl52High', fmtMoney(meta.fiftyTwoWeekHigh));
  setText('lvl52Low', fmtMoney(meta.fiftyTwoWeekLow));
  setText('lvlMa20', technicals.ma20 != null ? fmtMoney(technicals.ma20) : '—');
  setText('lvlMa50', technicals.ma50 != null ? fmtMoney(technicals.ma50) : '—');
  setText('lvlMa200', technicals.ma200 != null ? fmtMoney(technicals.ma200) : '—');
  setText('lvlRsi', technicals.rsi14 != null ? String(technicals.rsi14) : '—');
  setText('lvlBeta', technicals.betaVsBtc != null ? String(technicals.betaVsBtc) : '—');
  setText('lvlVol', technicals.annualizedVol != null ? technicals.annualizedVol + '%' : '—');

  const btcSlider = document.getElementById('btcPrice');
  const mstrSlider = document.getElementById('mstrPrice');
  const heldSlider = document.getElementById('btcHeld');
  const debtSlider = document.getElementById('ltDebt');
  const sharesSlider = document.getElementById('dilShares');
  if (btcSlider) btcSlider.value = Math.round(btc);
  if (mstrSlider) mstrSlider.value = price;
  if (heldSlider) heldSlider.value = company.btcHeld;
  if (debtSlider) debtSlider.value = debtB;
  if (sharesSlider) sharesSlider.value = (shares / 1e6).toFixed(1);

  window.FWD_BTC = company.btcHeld;
  window.FWD_DEBT = company.debt;
  window.FWD_PREF = company.pref ?? 0;
  window.FWD_CASH = company.cash ?? 0;
  window.FWD_SHARES = shares;

  if (data.fetchedAt) {
    const fresh = new Date(data.fetchedAt);
    setText(
      'dataFreshness',
      'Updated ' +
        fresh.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
    );
  }

  renderMetrics(data);
  setupMnavCalculator();
  setupScenarios(price);
}

function updateAnalystSection(price, analysts, targets) {
  const sorted = [...targets].sort((a, b) => a.target - b.target);
  const c = analysts?.consensus;
  const avg = c?.average ?? sorted.reduce((s, t) => s + t.target, 0) / sorted.length;
  const med =
    c?.median ??
    (sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)].target
      : (sorted[sorted.length / 2 - 1].target + sorted[sorted.length / 2].target) / 2);
  const high = c?.high ?? sorted[sorted.length - 1]?.target;
  const low = c?.low ?? sorted[0]?.target;
  const highFirm = c?.highFirm ?? sorted[sorted.length - 1]?.firm;
  const lowFirm = c?.lowFirm ?? sorted[0]?.firm;
  const pct = (t) => fmtPct(((t - price) / price) * 100);

  setText('consAvg', fmtMoney(avg, 0));
  setText('consAvgPct', pct(avg));
  setText('consMedian', fmtMoney(med, 0));
  setText('consMedianPct', pct(med));
  setText('consHigh', fmtMoney(high, 0));
  setText('consHighFirm', highFirm || '—');
  setText('consLow', fmtMoney(low, 0));
  setText('consLowFirm', lowFirm || '—');

  const sub = document.getElementById('analystSub');
  if (sub) {
    const parts = [];
    if (c?.recommendation) parts.push(c.recommendation);
    parts.push(`${c?.analystCount ?? targets.length} analysts`);
    if (c?.bullishPct != null) parts.push(c.bullishPct + '% bullish');
    const source = analysts?.source === 'yahoo' ? 'Yahoo Finance' : 'cached';
    
    const dateStr = analysts?.fetchedAt 
      ? ' · ' + new Date(analysts.fetchedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) 
      : '';

    sub.textContent = `Live targets via ${source}${dateStr}. Consensus: `;
    const strong = document.createElement('strong');
    strong.textContent = parts.join(' · ');
    sub.appendChild(strong);
  }
}

function renderMetrics(data) {
  const grid = document.getElementById('metrics-grid');
  if (!grid) return;
  const { current, meta, company, technicals, mnav } = data;
  const price = current.mstr;
  const btc = current.btc;
  const shares = company.shares;
  const mktCap = mnav.marketCap ?? price * shares;

  const metrics = [
    { label: 'Price', value: fmtMoney(price), sub: 'Live · Yahoo Finance' },
    { label: 'Day change', value: fmtPct(current.mstrChangePct), sub: 'vs prior close' },
    { label: 'Market cap', value: fmtBn(mktCap), sub: (shares / 1e6).toFixed(1) + 'M shares' },
    {
      label: '52-week range',
      value: fmtMoney(meta.fiftyTwoWeekLow, 0) + ' – ' + fmtMoney(meta.fiftyTwoWeekHigh, 0),
      sub: 'Drawdown ' + Math.round(technicals.drawdownPct) + '% from high',
    },
    {
      label: 'Volume',
      value: meta.volume != null ? (meta.volume / 1e6).toFixed(1) + 'M' : '—',
      sub: meta.averageVolume != null ? 'avg ' + (meta.averageVolume / 1e6).toFixed(1) + 'M' : '—',
    },
    { label: 'BTC reference', value: fmtMoney(btc, 0), sub: 'Live price' },
    {
      label: 'BTC held',
      value: company.btcHeld.toLocaleString('en-US'),
      sub: fmtBn(btcReserveValue(mnav, btc, company.btcHeld)) + ' BTC reserve',
    },
    { label: 'Long-term debt', value: fmtBn(company.debt), sub: 'Strategy disclosure' },
    { label: 'Cash', value: fmtBn(company.cash), sub: company.asOfDate ? 'as of ' + company.asOfDate : '' },
    { label: 'mNAV ratio', value: mnav.ratio != null ? mnav.ratio.toFixed(2) + '×' : '—', sub: 'EV / BTC reserve (Strategy)' },
    {
      label: 'NAV / share',
      value: mnav.navPerShare != null ? fmtMoney(mnav.navPerShare) : '—',
      sub: 'BTC − debt, per share',
    },
    {
      label: 'Annualized vol',
      value: technicals.annualizedVol != null ? technicals.annualizedVol + '%' : '—',
      sub:
        technicals.betaVsBtc != null ? 'beta ' + technicals.betaVsBtc + ' vs BTC' : '252 trading days',
    },
  ];

  grid.innerHTML = '';
  metrics.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'metric';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'metric-label';
    labelEl.textContent = m.label;
    const valueEl = document.createElement('div');
    valueEl.className = 'metric-value';
    valueEl.textContent = m.value;
    const subEl = document.createElement('div');
    subEl.className = 'metric-sub';
    subEl.textContent = m.sub;

    el.append(labelEl, valueEl, subEl);
    grid.appendChild(el);
  });
}

/* ============== CHARTS (after live data) ============== */
function initCharts(data) {
  const series = data.aligned18m?.length ? data.aligned18m : data.aligned;
  const fibs = (data.technicals.fibs || []).map((f) => ({
    label: f.label,
    value: f.value,
    color:
      f.pct >= 0.786
        ? 'rgba(255,90,110,0.95)'
        : f.pct >= 0.618
          ? 'rgba(247,147,26,0.85)'
          : f.pct >= 0.5
            ? 'rgba(255,255,255,0.45)'
            : f.pct >= 0.382
              ? 'rgba(94,160,255,0.7)'
              : 'rgba(40,208,122,0.7)',
  }));

  if (series.length && document.getElementById('relChartSub')) {
    const start = series[0].date;
    document.getElementById('relChartSub').textContent =
      'Both rebased to 100 at ' +
      new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  initRelChart(series);
  initDilutionChart(data);
  initTechChart(data.aligned, fibs);
  initScenChart();
  initAnalystChart(data);
}

function initRelChart(ALIGNED) {
  const baseM = ALIGNED[0].mstr;
  const baseB = ALIGNED[0].btc;
  const labels = ALIGNED.map((d) => d.date);
  const mstrIdx = ALIGNED.map((d) => (d.mstr / baseM) * 100);
  const btcIdx = ALIGNED.map((d) => (d.btc / baseB) * 100);
  const ctx = document.getElementById('relChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'MSTR (rebased)',
          data: mstrIdx,
          borderColor: COLORS.gold,
          backgroundColor: 'rgba(247,147,26,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
          fill: true,
        },
        {
          label: 'BTC (rebased)',
          data: btcIdx,
          borderColor: COLORS.white,
          backgroundColor: 'rgba(255,255,255,0.02)',
          borderWidth: 1.6,
          pointRadius: 0,
          tension: 0.15,
        },
      ],
    },
    options: chartLineOptions(),
  });
}

function initDilutionChart(data) {
  const history = data.company.treasuryHistory || [];
  let labels;
  let values;
  if (history.length >= 2) {
    labels = history.map((h) => h.date);
    values = history.map((h) => h.basicSharesM);
  } else if (typeof SHARES !== 'undefined') {
    labels = SHARES.map((s) => s.q);
    values = SHARES.map((s) => s.shares);
  } else {
    return;
  }
  const ctx = document.getElementById('dilutionChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Shares (M)',
          data: values,
          backgroundColor: values.map((_, i) =>
            i === 0 || i === values.length - 1 ? COLORS.gold : 'rgba(247,147,26,0.45)'
          ),
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,16,32,0.95)',
          borderColor: COLORS.gold,
          borderWidth: 1,
          callbacks: { label: (c) => c.parsed.y.toFixed(1) + 'M shares' },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: COLORS.gridDim },
          ticks: { callback: (v) => v + 'M' },
          beginAtZero: false,
        },
      },
    },
  });
}

function initTechChart(ALIGNED, fibs) {
  const closes = ALIGNED.map((d) => d.mstr);
  const dates = ALIGNED.map((d) => d.date);
  const ma50 = ma(closes, 50);
  const ma200 = ma(closes, 200);

  const fibPlugin = {
    id: 'fibLines',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales: { y } } = chart;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1;
      ctx.font = "11px 'JetBrains Mono', monospace";
      fibs.forEach((f) => {
        const yp = y.getPixelForValue(f.value);
        if (yp < chartArea.top || yp > chartArea.bottom) return;
        ctx.strokeStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, yp);
        ctx.lineTo(chartArea.right, yp);
        ctx.stroke();
        ctx.fillStyle = f.color;
        ctx.fillText(`${f.label}  $${f.value}`, chartArea.left + 8, yp - 4);
      });
      ctx.restore();
    },
  };

  const ctx = document.getElementById('techChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'MSTR close',
          data: closes,
          borderColor: COLORS.gold,
          backgroundColor: 'rgba(247,147,26,0.05)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.1,
        },
        {
          label: 'MA50',
          data: ma50,
          borderColor: 'rgba(94,160,255,0.85)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'MA200',
          data: ma200,
          borderColor: 'rgba(255,255,255,0.7)',
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [2, 3],
        },
      ],
    },
    options: {
      ...chartLineOptions(),
      plugins: {
        ...chartLineOptions().plugins,
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: COLORS.white, usePointStyle: true, boxWidth: 8 },
        },
      },
    },
    plugins: [fibPlugin],
  });
}

function chartLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { color: COLORS.white, usePointStyle: true, boxWidth: 8 },
      },
      tooltip: {
        backgroundColor: 'rgba(10,16,32,0.95)',
        borderColor: COLORS.gold,
        borderWidth: 1,
        callbacks: {
          label: (c) =>
            c.parsed.y != null ? `${c.dataset.label}: ${c.parsed.y.toFixed(1)}` : null,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'month', displayFormats: { month: 'MMM yy' } },
        grid: { color: COLORS.gridDim },
        ticks: { maxTicksLimit: 10 },
      },
      y: { grid: { color: COLORS.gridDim } },
    },
  };
}

/* ============== mNAV CALCULATOR ============== */
let mnavBarChart;

function setupMnavCalculator() {
  const mnavInputs = {
    btcPrice: document.getElementById('btcPrice'),
    btcHeld: document.getElementById('btcHeld'),
    ltDebt: document.getElementById('ltDebt'),
    dilShares: document.getElementById('dilShares'),
    mstrPrice: document.getElementById('mstrPrice'),
  };

  window.recomputeMnav = function recomputeMnav() {
    const btcP = +mnavInputs.btcPrice.value;
    const btcN = +mnavInputs.btcHeld.value;
    const debt = +mnavInputs.ltDebt.value * 1e9;
    const sh = +mnavInputs.dilShares.value * 1e6;
    const px = +mnavInputs.mstrPrice.value;
    const pref = window.FWD_PREF ?? 0;
    const cash = window.FWD_CASH ?? 0;

    const btcReserve = btcP * btcN;
    const mktCap = px * sh;
    const enterpriseValue = mktCap + debt + pref - cash;
    const navNet = btcReserve - debt;
    const navPS = navNet / sh;
    const mnavR = btcReserve > 0 ? enterpriseValue / btcReserve : 0;

    setText('btcPriceVal', fmtMoney(btcP, 0));
    setText('btcHeldVal', btcN.toLocaleString());
    setText('ltDebtVal', '$' + (+mnavInputs.ltDebt.value).toFixed(2) + 'B');
    setText('dilSharesVal', (+mnavInputs.dilShares.value).toFixed(1));
    setText('mstrPriceVal', fmtMoney(px, 2));
    setText('outBtcValue', fmtBn(btcReserve));
    setText('outNav', fmtBn(enterpriseValue));
    setText('outNavPerShare', fmtMoney(navPS, 2));
    setHtml('outMnav', mnavR.toFixed(3) + '<span class="ot-suffix">x</span>');
    setText('outMnavTag', fmtMnavTag(mnavR));

    paintSliders();

    const barData = {
      labels: ['Enterprise value', 'BTC reserve'],
      datasets: [
        {
          label: 'Value',
          data: [enterpriseValue / 1e9, btcReserve / 1e9],
          backgroundColor: [COLORS.gold, 'rgba(94,160,255,0.7)'],
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };
    if (!mnavBarChart) {
      mnavBarChart = new Chart(document.getElementById('mnavBar'), {
        type: 'bar',
        data: barData,
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => '$' + c.parsed.x.toFixed(2) + 'B' } },
          },
          scales: {
            x: { grid: { color: COLORS.gridDim }, ticks: { callback: (v) => '$' + v + 'B' } },
            y: { grid: { display: false } },
          },
        },
      });
    } else {
      mnavBarChart.data.datasets[0].data = [enterpriseValue / 1e9, btcReserve / 1e9];
      mnavBarChart.update('none');
    }
  };

  Object.values(mnavInputs).forEach((el) => {
    if (el) el.addEventListener('input', window.recomputeMnav);
  });
  window.recomputeMnav();
}

/* ============== SCENARIOS ============== */
const SCEN_PRESETS = {
  bear: { btc: 60000, mnav: 0.9 },
  base: { btc: 100000, mnav: 1.2 },
  bull: { btc: 150000, mnav: 1.5 },
  sky: { btc: 200000, mnav: 1.8 },
};

let scenChart;

function scenTargetPrice(btcP, mnavR) {
  const btcReserve = btcP * window.FWD_BTC;
  const enterpriseValue = mnavR * btcReserve;
  const marketCap = enterpriseValue - window.FWD_DEBT - window.FWD_PREF + window.FWD_CASH;
  return marketCap / window.FWD_SHARES;
}

function setupScenarios(initialPrice) {
  const scenBtc = document.getElementById('scenBtc');
  const scenMnav = document.getElementById('scenMnav');

  window.recomputeScen = function recomputeScen() {
    const price = window.LIVE_CURRENT?.mstr ?? initialPrice;
    const btcP = +scenBtc.value;
    const mnav = +scenMnav.value;
    const btcReserve = btcP * window.FWD_BTC;
    const enterpriseValue = mnav * btcReserve;
    const marketCap = enterpriseValue - window.FWD_DEBT - window.FWD_PREF + window.FWD_CASH;
    const navNet = btcReserve - window.FWD_DEBT;
    const navPS = navNet / window.FWD_SHARES;
    const target = marketCap / window.FWD_SHARES;
    const ret = ((target - price) / price) * 100;

    setText('scenBtcVal', fmtMoney(btcP, 0));
    setText('scenMnavVal', mnav.toFixed(2) + 'x');
    setText('scenBtcVal2', fmtBn(btcReserve));
    setText('scenNavPS', fmtMoney(navPS, 0));
    setText('scenTarget', fmtMoney(target, 0));
    const tag = document.getElementById('scenReturn');
    tag.textContent = fmtPct(ret) + ' from ' + fmtMoney(price);
    tag.className = 'ot-tag ' + (ret >= 0 ? 'up' : 'down');
    paintSliders();
  };

  [scenBtc, scenMnav].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      document.querySelectorAll('input[name="preset"]').forEach((r) => (r.checked = false));
      window.recomputeScen();
    });
  });
  document.querySelectorAll('input[name="preset"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      const p = SCEN_PRESETS[e.target.value];
      scenBtc.value = p.btc;
      scenMnav.value = p.mnav;
      window.recomputeScen();
    });
  });
  window.recomputeScen();
}

function initScenChart() {
  const labels = ['Bear', 'Base', 'Bull', 'Blue Sky'];
  const keys = ['bear', 'base', 'bull', 'sky'];
  const data = keys.map((k) => scenTargetPrice(SCEN_PRESETS[k].btc, SCEN_PRESETS[k].mnav));
  const colors = [
    'rgba(255,90,110,0.75)',
    'rgba(247,147,26,0.85)',
    'rgba(40,208,122,0.85)',
    'rgba(94,160,255,0.9)',
  ];

  const currLine = {
    id: 'currLine',
    afterDatasetsDraw(chart) {
      const price = window.LIVE_CURRENT?.mstr ?? 0;
      const { ctx, chartArea, scales: { x } } = chart;
      const xp = x.getPixelForValue(price);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(xp, chartArea.top);
      ctx.lineTo(xp, chartArea.bottom);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillText('Now ' + fmtMoney(price), xp + 6, chartArea.top + 14);
      ctx.restore();
    },
  };

  const ctx = document.getElementById('scenChart');
  if (!ctx) return;
  scenChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Target', data, backgroundColor: colors, borderRadius: 8, borderSkipped: false }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => '$' + c.parsed.x } } },
      scales: {
        x: { grid: { color: COLORS.gridDim }, ticks: { callback: (v) => '$' + v } },
        y: { grid: { display: false } },
      },
    },
    plugins: [currLine],
  });
}

/* ============== ANALYSTS ============== */
function initAnalystChart(data) {
  const targets = getAnalystTargets(data || window.FINANCE_DATA);
  if (!targets.length) return;
  const sorted = [...targets].sort((a, b) => b.target - a.target);
  const c = data?.analysts?.consensus;
  const avgT = c?.average ?? sorted.reduce((s, t) => s + t.target, 0) / sorted.length;
  const price = window.LIVE_CURRENT?.mstr ?? 0;

  const colors = sorted.map((t) =>
    t.target >= avgT * 1.2
      ? 'rgba(40,208,122,0.85)'
      : t.target < price
        ? 'rgba(255,90,110,0.75)'
        : 'rgba(247,147,26,0.80)'
  );

  const refLines = {
    id: 'refLines',
    afterDatasetsDraw(chart) {
      const p = window.LIVE_CURRENT?.mstr ?? 0;
      const { ctx, chartArea, scales: { x } } = chart;
      [
        { v: p, c: 'rgba(255,255,255,0.75)', l: 'Now ' + fmtMoney(p) },
        { v: avgT, c: 'rgba(247,147,26,0.85)', l: 'Avg $' + Math.round(avgT) },
      ].forEach((o) => {
        const xp = x.getPixelForValue(o.v);
        ctx.save();
        ctx.strokeStyle = o.c;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xp, chartArea.top);
        ctx.lineTo(xp, chartArea.bottom);
        ctx.stroke();
        ctx.fillStyle = o.c;
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText(o.l, xp + 6, chartArea.top + 14);
        ctx.restore();
      });
    },
  };

  const ctx = document.getElementById('analystChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map((t) => t.firm),
      datasets: [
        {
          label: 'Target',
          data: sorted.map((t) => t.target),
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const t = sorted[items[0].dataIndex];
              return t.firm + (t.date ? ' · ' + t.date : '');
            },
            label: (c) => {
              const t = sorted[c.dataIndex];
              const parts = ['Target: $' + c.parsed.x];
              if (t.rating) parts.push(t.rating);
              if (t.action) parts.push(t.action);
              return parts;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: COLORS.gridDim }, ticks: { callback: (v) => '$' + v } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } },
      },
    },
    plugins: [refLines],
  });
}
