/* MSTR dashboard interactions */

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
  gridText: 'rgba(255,255,255,0.55)'
};

Chart.defaults.color = COLORS.gridText;
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.borderColor = COLORS.gridDim;

const fmtMoney = (n,d=2) => '$'+n.toLocaleString('en-US',{maximumFractionDigits:d});
const fmtBn = (n) => '$'+(n/1e9).toFixed(2)+'B';
const fmtCompact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return '$'+(n/1e9).toFixed(2)+'B';
  if (a >= 1e6) return '$'+(n/1e6).toFixed(1)+'M';
  if (a >= 1e3) return '$'+(n/1e3).toFixed(1)+'K';
  return '$'+n.toFixed(0);
};

/* ============== METRICS GRID ============== */
const metrics = [
  {label:'Price',          value:'$187.59', sub:'+4.31% (after-hours)'},
  {label:'Market cap (diluted)', value:'$62.6B', sub:'333.9M diluted shares'},
  {label:'Reported market cap', value:'$55.73B', sub:'basic share count'},
  {label:'52-week range',  value:'$104.17 – $457.22', sub:'Drawdown −59% from high'},
  {label:'Volume',         value:'15.7M', sub:'avg 19.8M'},
  {label:'TTM EPS',        value:'−$36.99', sub:'BTC mark-to-market'},
  {label:'BTC reference',  value:'$80,395', sub:'−36% from 52w high'},
  {label:'BTC held',       value:'818,334', sub:'$65.79B fair value'},
  {label:'Long-term debt', value:'$8.17B',  sub:'convertible notes'},
  {label:'Cash',           value:'$2.21B',  sub:'Q1 2026'},
  {label:'Total assets',   value:'$54.27B', sub:'Q1 2026'},
  {label:'Annualized vol', value:'69%',     sub:'beta 1.30 vs BTC'}
];
{
  const grid = document.getElementById('metrics-grid');
  metrics.forEach(m => {
    const el = document.createElement('div');
    el.className = 'metric';
    el.innerHTML = `<div class="metric-label">${m.label}</div>
                    <div class="metric-value">${m.value}</div>
                    <div class="metric-sub">${m.sub}</div>`;
    grid.appendChild(el);
  });
}

/* update slider fill */
function paintSliders(){
  document.querySelectorAll('input[type="range"]').forEach(s=>{
    const min=+s.min, max=+s.max, val=+s.value;
    const pct = ((val-min)/(max-min))*100;
    s.style.setProperty('--p', pct+'%');
  });
}

/* ============== REL CHART (MSTR vs BTC normalized) ============== */
{
  const baseM = ALIGNED[0].mstr;
  const baseB = ALIGNED[0].btc;
  const labels = ALIGNED.map(d=>d.date);
  const mstrIdx = ALIGNED.map(d => (d.mstr/baseM)*100);
  const btcIdx = ALIGNED.map(d => (d.btc/baseB)*100);
  const ctx = document.getElementById('relChart');
  new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'MSTR (rebased)', data:mstrIdx, borderColor:COLORS.gold, backgroundColor:'rgba(247,147,26,0.06)', borderWidth:2, pointRadius:0, tension:0.15, fill:true},
        {label:'BTC (rebased)',  data:btcIdx,  borderColor:COLORS.white, backgroundColor:'rgba(255,255,255,0.02)', borderWidth:1.6, pointRadius:0, tension:0.15, borderDash:[]},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{position:'top', align:'end', labels:{color:COLORS.white, usePointStyle:true, boxWidth:8}},
        tooltip:{backgroundColor:'rgba(10,16,32,0.95)', borderColor:COLORS.gold, borderWidth:1,
          callbacks:{ label:(c)=> `${c.dataset.label}: ${c.parsed.y.toFixed(1)}` }}
      },
      scales:{
        x:{type:'time', time:{unit:'month', displayFormats:{month:'MMM yy'}}, grid:{color:COLORS.gridDim}, ticks:{maxTicksLimit:10}},
        y:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>v}}
      }
    }
  });
}

/* ============== DILUTION CHART ============== */
{
  const ctx = document.getElementById('dilutionChart');
  new Chart(ctx,{
    type:'bar',
    data:{
      labels: SHARES.map(s=>s.q),
      datasets:[{
        label:'Diluted shares (M)',
        data: SHARES.map(s=>s.shares),
        backgroundColor: SHARES.map((_,i)=> i===0||i===SHARES.length-1 ? COLORS.gold : 'rgba(247,147,26,0.45)'),
        borderRadius:8, borderSkipped:false,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'rgba(10,16,32,0.95)', borderColor:COLORS.gold, borderWidth:1,
          callbacks:{label:c=>`${c.parsed.y.toFixed(1)}M shares`}}
      },
      scales:{
        x:{grid:{display:false}},
        y:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>v+'M'}, beginAtZero:false, suggestedMin:200}
      }
    }
  });
}

/* ============== mNAV CALCULATOR ============== */
function fmtMnavTag(r){
  if (r > 1.4) return 'Premium re-expanding';
  if (r > 1.1) return 'Modest premium';
  if (r > 0.95) return 'Near 1× — slight premium';
  if (r > 0.85) return 'Discount to NAV';
  return 'Deep discount to NAV';
}

const mnavInputs = {
  btcPrice: document.getElementById('btcPrice'),
  btcHeld: document.getElementById('btcHeld'),
  ltDebt: document.getElementById('ltDebt'),
  dilShares: document.getElementById('dilShares'),
  mstrPrice: document.getElementById('mstrPrice')
};

let mnavBarChart;
function recomputeMnav(){
  const btcP = +mnavInputs.btcPrice.value;
  const btcN = +mnavInputs.btcHeld.value;
  const debt = +mnavInputs.ltDebt.value * 1e9;
  const sh   = +mnavInputs.dilShares.value * 1e6;
  const px   = +mnavInputs.mstrPrice.value;

  const btcValue = btcP * btcN;          // gross BTC value
  const navNet   = btcValue - debt;      // simplified — exclude software & cash
  const navPS    = navNet / sh;
  const mktCap   = px * sh;
  const mnavR    = mktCap / navNet;

  document.getElementById('btcPriceVal').textContent = fmtMoney(btcP,0);
  document.getElementById('btcHeldVal').textContent  = btcN.toLocaleString();
  document.getElementById('ltDebtVal').textContent   = '$'+(+mnavInputs.ltDebt.value).toFixed(2)+'B';
  document.getElementById('dilSharesVal').textContent= (+mnavInputs.dilShares.value).toFixed(1);
  document.getElementById('mstrPriceVal').textContent= fmtMoney(px,2);

  document.getElementById('outBtcValue').textContent = fmtBn(btcValue);
  document.getElementById('outNav').textContent       = fmtBn(navNet);
  document.getElementById('outNavPerShare').textContent = fmtMoney(navPS,2);
  document.getElementById('outMnav').innerHTML = mnavR.toFixed(3)+'<span class="ot-suffix">x</span>';
  document.getElementById('outMnavTag').textContent = fmtMnavTag(mnavR);

  paintSliders();

  // bar chart: market cap vs NAV (in $B)
  const data = {
    labels:['Market cap','NAV (BTC − debt)'],
    datasets:[{
      label:'Value',
      data:[mktCap/1e9, navNet/1e9],
      backgroundColor:[COLORS.gold, 'rgba(94,160,255,0.7)'],
      borderRadius:8, borderSkipped:false,
    }]
  };
  if (!mnavBarChart){
    mnavBarChart = new Chart(document.getElementById('mnavBar'),{
      type:'bar',
      data,
      options:{
        indexAxis:'y',
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:c=>'$'+c.parsed.x.toFixed(2)+'B'}}
        },
        scales:{
          x:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>'$'+v+'B'}},
          y:{grid:{display:false}}
        }
      }
    });
  } else {
    mnavBarChart.data.datasets[0].data = [mktCap/1e9, navNet/1e9];
    mnavBarChart.update('none');
  }
}
Object.values(mnavInputs).forEach(el => el.addEventListener('input', recomputeMnav));
recomputeMnav();

/* ============== TECHNICALS CHART ============== */
{
  // build MA50 / MA200 from MSTR series
  const closes = ALIGNED.map(d => d.mstr);
  const dates = ALIGNED.map(d => d.date);
  function ma(arr, n){
    const out=[]; let sum=0;
    for (let i=0;i<arr.length;i++){
      sum += arr[i];
      if (i>=n) sum -= arr[i-n];
      out.push(i>=n-1 ? sum/n : null);
    }
    return out;
  }
  const ma50 = ma(closes,50);
  const ma200 = ma(closes,200);

  // Fib lines plugin
  const fibs = [
    {label:'23.6%', value:387, color:'rgba(40,208,122,0.7)'},
    {label:'38.2%', value:334, color:'rgba(94,160,255,0.7)'},
    {label:'50.0%', value:290, color:'rgba(255,255,255,0.45)'},
    {label:'61.8%', value:247, color:'rgba(247,147,26,0.85)'},
    {label:'78.6%', value:185, color:'rgba(255,90,110,0.95)'},
  ];
  const fibPlugin = {
    id:'fibLines',
    afterDatasetsDraw(chart){
      const {ctx, chartArea, scales:{y}} = chart;
      ctx.save();
      ctx.setLineDash([6,5]);
      ctx.lineWidth = 1;
      ctx.font = "11px 'JetBrains Mono', monospace";
      fibs.forEach(f => {
        const yp = y.getPixelForValue(f.value);
        if (yp < chartArea.top || yp > chartArea.bottom) return;
        ctx.strokeStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, yp);
        ctx.lineTo(chartArea.right, yp);
        ctx.stroke();
        ctx.fillStyle = f.color;
        ctx.fillText(`${f.label}  $${f.value}`, chartArea.left+8, yp-4);
      });
      ctx.restore();
    }
  };

  new Chart(document.getElementById('techChart'),{
    type:'line',
    data:{
      labels:dates,
      datasets:[
        {label:'MSTR close', data:closes, borderColor:COLORS.gold, backgroundColor:'rgba(247,147,26,0.05)', borderWidth:2, pointRadius:0, fill:true, tension:0.1},
        {label:'MA50',       data:ma50,   borderColor:'rgba(94,160,255,0.85)', borderWidth:1.5, pointRadius:0, tension:0.1, fill:false},
        {label:'MA200',      data:ma200,  borderColor:'rgba(255,255,255,0.7)', borderWidth:1.5, pointRadius:0, tension:0.1, borderDash:[2,3], fill:false},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{position:'top', align:'end', labels:{color:COLORS.white, usePointStyle:true, boxWidth:8}},
        tooltip:{backgroundColor:'rgba(10,16,32,0.95)', borderColor:COLORS.gold, borderWidth:1,
          callbacks:{label:c=> c.parsed.y!=null ? `${c.dataset.label}: $${c.parsed.y.toFixed(2)}` : null}}
      },
      scales:{
        x:{type:'time', time:{unit:'month', displayFormats:{month:'MMM yy'}}, grid:{color:COLORS.gridDim}, ticks:{maxTicksLimit:10}},
        y:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>'$'+v}}
      }
    },
    plugins:[fibPlugin]
  });
}

/* ============== SCENARIOS ============== */
const SCEN_PRESETS = {
  bear:{btc:60000,  mnav:0.9, label:'Bear'},
  base:{btc:100000, mnav:1.2, label:'Base'},
  bull:{btc:150000, mnav:1.5, label:'Bull'},
  sky: {btc:200000, mnav:1.8, label:'Blue Sky'}
};
const SCEN_PRESET_TARGETS = { bear:103, base:245, bull:477, sky:777 };
const FWD_SHARES = 360e6;
const FWD_DEBT = 8.2e9;
const FWD_BTC = 818334;
const CURR_PRICE = 187.59;

const scenBtc = document.getElementById('scenBtc');
const scenMnav = document.getElementById('scenMnav');
let scenChart;

function recomputeScen(){
  const btcP = +scenBtc.value;
  const mnav = +scenMnav.value;
  const btcVal = btcP * FWD_BTC;
  const navNet = btcVal - FWD_DEBT;
  const navPS = navNet / FWD_SHARES;
  const target = navPS * mnav;
  const ret = ((target - CURR_PRICE)/CURR_PRICE)*100;

  document.getElementById('scenBtcVal').textContent = fmtMoney(btcP,0);
  document.getElementById('scenMnavVal').textContent = mnav.toFixed(2)+'x';
  document.getElementById('scenBtcVal2').textContent = fmtBn(btcVal);
  document.getElementById('scenNavPS').textContent = fmtMoney(navPS,0);
  document.getElementById('scenTarget').textContent = fmtMoney(target,0);
  const tag = document.getElementById('scenReturn');
  tag.textContent = (ret>=0?'+':'')+ret.toFixed(1)+'% from $187.59';
  tag.className = 'ot-tag '+(ret>=0?'up':'down');
  paintSliders();
}
[scenBtc, scenMnav].forEach(el=>el.addEventListener('input', ()=>{
  // unselect preset radios when user moves a slider
  document.querySelectorAll('input[name="preset"]').forEach(r=>r.checked=false);
  recomputeScen();
}));
document.querySelectorAll('input[name="preset"]').forEach(r=>{
  r.addEventListener('change', e=>{
    const p = SCEN_PRESETS[e.target.value];
    scenBtc.value = p.btc;
    scenMnav.value = p.mnav;
    recomputeScen();
  });
});
recomputeScen();

/* preset comparison chart */
{
  const labels = ['Bear','Base','Bull','Blue Sky'];
  const data   = [SCEN_PRESET_TARGETS.bear, SCEN_PRESET_TARGETS.base, SCEN_PRESET_TARGETS.bull, SCEN_PRESET_TARGETS.sky];
  const colors = ['rgba(255,90,110,0.75)','rgba(247,147,26,0.85)','rgba(40,208,122,0.85)','rgba(94,160,255,0.9)'];
  const currLine = {
    id:'currLine',
    afterDatasetsDraw(chart){
      const {ctx, chartArea, scales:{x}} = chart;
      const xp = x.getPixelForValue(CURR_PRICE);
      ctx.save();
      ctx.strokeStyle='rgba(255,255,255,0.7)';
      ctx.setLineDash([4,4]);
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.moveTo(xp, chartArea.top);
      ctx.lineTo(xp, chartArea.bottom);
      ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.font="11px 'JetBrains Mono', monospace";
      ctx.fillText(`Now $${CURR_PRICE}`, xp+6, chartArea.top+14);
      ctx.restore();
    }
  };
  new Chart(document.getElementById('scenChart'),{
    type:'bar',
    data:{labels,datasets:[{label:'Target',data,backgroundColor:colors,borderRadius:8,borderSkipped:false}]},
    options:{
      indexAxis:'y',
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>'$'+c.parsed.x}}
      },
      scales:{
        x:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>'$'+v}, suggestedMax:850},
        y:{grid:{display:false}}
      }
    },
    plugins:[currLine]
  });
}

/* ============== ANALYST CHART ============== */
{
  // sort by target descending for bar chart aesthetics
  const sorted = [...TARGETS].sort((a,b)=>b.target-a.target);
  const avgT = 331;
  const colors = sorted.map(t => t.target >= avgT*1.2 ? 'rgba(40,208,122,0.85)'
                              : t.target < CURR_PRICE  ? 'rgba(255,90,110,0.75)'
                              : 'rgba(247,147,26,0.80)');
  const refLines = {
    id:'refLines',
    afterDatasetsDraw(chart){
      const {ctx, chartArea, scales:{x}} = chart;
      [{v:CURR_PRICE,c:'rgba(255,255,255,0.75)',l:`Now $${CURR_PRICE}`},
       {v:avgT, c:'rgba(247,147,26,0.85)', l:`Avg $${avgT}`}].forEach(o=>{
        const xp = x.getPixelForValue(o.v);
        ctx.save();
        ctx.strokeStyle = o.c;
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.moveTo(xp, chartArea.top);
        ctx.lineTo(xp, chartArea.bottom);
        ctx.stroke();
        ctx.fillStyle=o.c;
        ctx.font="11px 'JetBrains Mono', monospace";
        ctx.fillText(o.l, xp+6, chartArea.top+14);
        ctx.restore();
      });
    }
  };
  new Chart(document.getElementById('analystChart'),{
    type:'bar',
    data:{
      labels: sorted.map(t=>t.firm),
      datasets:[{
        label:'Target',
        data: sorted.map(t=>t.target),
        backgroundColor:colors,
        borderRadius:6, borderSkipped:false,
      }]
    },
    options:{
      indexAxis:'y',
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            title:(items)=>{
              const t = sorted[items[0].dataIndex];
              return `${t.firm} · ${t.analyst}`;
            },
            label:(c)=>`Target: $${c.parsed.x}`
          }
        }
      },
      scales:{
        x:{grid:{color:COLORS.gridDim}, ticks:{callback:v=>'$'+v}, suggestedMax:600},
        y:{grid:{display:false}, ticks:{font:{size:12}}}
      }
    },
    plugins:[refLines]
  });
}

/* time scale needs adapter — use raw labels (strings) instead */
