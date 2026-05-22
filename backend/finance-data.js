/**
 * Shared finance payload builder for Cloudflare Worker and local Express server.
 */

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; MSTR-Dashboard/1.0)' };

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

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function annualizedVol(dailyReturns) {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

function betaVsBtc(mstrReturns, btcReturns) {
  const n = Math.min(mstrReturns.length, btcReturns.length);
  if (n < 20) return null;
  const m = mstrReturns.slice(-n);
  const b = btcReturns.slice(-n);
  const meanM = m.reduce((a, x) => a + x, 0) / n;
  const meanB = b.reduce((a, x) => a + x, 0) / n;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (m[i] - meanM) * (b[i] - meanB);
    varB += (b[i] - meanB) ** 2;
  }
  return varB === 0 ? null : cov / varB;
}

function fibLevels(high, low) {
  const diff = high - low;
  const ratios = [
    { label: '23.6%', pct: 0.236 },
    { label: '38.2%', pct: 0.382 },
    { label: '50.0%', pct: 0.5 },
    { label: '61.8%', pct: 0.618 },
    { label: '78.6%', pct: 0.786 },
  ];
  return ratios.map((r) => ({
    label: r.label,
    pct: r.pct,
    value: Math.round(low + diff * r.pct),
  }));
}

async function fetchChart(symbol, range = '2y') {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Yahoo chart ${symbol}: ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);
  return result;
}

function buildAlignedSeries(mstrResult, btcResult) {
  const mstrQuotes = mstrResult.indicators.quote[0];
  const btcQuotes = btcResult.indicators.quote[0];
  const aligned = [];

  for (let i = 0; i < mstrResult.timestamp.length; i++) {
    const mstrPrice = mstrQuotes.close[i];
    if (mstrPrice == null) continue;

    const mstrTime = mstrResult.timestamp[i];
    let closestBtcIdx = 0;
    let minDiff = Infinity;
    for (let j = 0; j < btcResult.timestamp.length; j++) {
      const diff = Math.abs(btcResult.timestamp[j] - mstrTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestBtcIdx = j;
      }
    }

    const btcPrice = btcQuotes.close[closestBtcIdx];
    if (btcPrice == null) continue;

    aligned.push({
      date: new Date(mstrTime * 1000).toISOString().split('T')[0],
      mstr: parseFloat(mstrPrice.toFixed(2)),
      btc: parseFloat(btcPrice.toFixed(2)),
    });
  }

  return aligned;
}

async function fetchStrategyTreasury() {
  try {
    const res = await fetch('https://www.strategy.com/', { headers: UA });
    if (!res.ok) throw new Error(`Strategy.com: ${res.status}`);
    const html = await res.text();
    const idx = html.indexOf('btcTrackerData');
    if (idx < 0) throw new Error('btcTrackerData not found');

    const start = html.indexOf('[', idx);
    let depth = 0;
    let end = start;
    for (let i = start; i < html.length; i++) {
      if (html[i] === '[') depth++;
      if (html[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    const entries = JSON.parse(html.slice(start, end));
    const latest =
      entries.find((e) => e.latest) ||
      entries.sort((a, b) => (a.as_of_date < b.as_of_date ? 1 : -1))[0];

    return {
      btcHeld: latest.btc_holdings,
      debt: latest.debt,
      cash: latest.cash,
      basicShares: latest.basic_shares_outstanding,
      btcYieldYtd: latest.btc_yield_ytd,
      btcGainYtd: latest.btc_gain_ytd,
      pref: latest.pref,
      asOfDate: latest.as_of_date,
      history: entries.map((e) => ({
        date: e.as_of_date,
        btcHeld: e.btc_holdings,
        basicSharesM: parseFloat((e.basic_shares_outstanding / 1e6).toFixed(1)),
      })),
    };
  } catch (err) {
    console.error('Strategy treasury fetch failed:', err.message);
    return null;
  }
}

export async function buildFinancePayload() {
  const [mstrResult, btcResult, treasury] = await Promise.all([
    fetchChart('MSTR', '2y'),
    fetchChart('BTC-USD', '2y'),
    fetchStrategyTreasury(),
  ]);

  const aligned = buildAlignedSeries(mstrResult, btcResult);
  const meta = mstrResult.meta || {};
  const btcMeta = btcResult.meta || {};

  const mstrPrice =
    meta.regularMarketPrice ??
    (aligned.length ? aligned[aligned.length - 1].mstr : 0);
  const btcPrice =
    btcMeta.regularMarketPrice ??
    (aligned.length ? aligned[aligned.length - 1].btc : 0);
  const prevClose = meta.chartPreviousClose ?? mstrPrice;
  const mstrChangePct = prevClose
    ? ((mstrPrice - prevClose) / prevClose) * 100
    : 0;

  const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? Math.max(...aligned.map((d) => d.mstr));
  const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? Math.min(...aligned.map((d) => d.mstr));
  const drawdownPct = fiftyTwoWeekHigh
    ? ((mstrPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100
    : 0;

  const closes = aligned.map((d) => d.mstr);
  const ma20 = ma(closes, 20);
  const ma50 = ma(closes, 50);
  const ma200 = ma(closes, 200);
  const last = closes.length - 1;

  const mstrReturns = [];
  const btcReturns = [];
  for (let i = 1; i < aligned.length; i++) {
    mstrReturns.push(Math.log(aligned[i].mstr / aligned[i - 1].mstr));
    btcReturns.push(Math.log(aligned[i].btc / aligned[i - 1].btc));
  }

  const lookback = 252;
  const recentMstr = mstrReturns.slice(-lookback);
  const recentBtc = btcReturns.slice(-lookback);

  const peakForFib = Math.max(...closes.slice(-400));
  const lowForFib = Math.min(...closes.slice(-120));
  const fibs = fibLevels(peakForFib, lowForFib);

  const btcHeld = treasury?.btcHeld ?? 818334;
  const debt = treasury?.debt ?? 8.17e9;
  const cash = treasury?.cash ?? 2.21e9;
  const pref = treasury?.pref ?? 0;
  const shares = treasury?.basicShares ?? 333.9e6;
  const marketCap = mstrPrice * shares;
  const btcReserve = btcPrice * btcHeld;
  // Strategy.com definition: mNAV = Enterprise Value / BTC Reserve
  // EV = market cap + debt + preferred − cash
  const enterpriseValue = marketCap + debt + pref - cash;
  const mnavRatio = btcReserve > 0 ? enterpriseValue / btcReserve : null;
  const navNet = btcReserve - debt;
  const navPerShare = shares > 0 ? navNet / shares : null;

  const eighteenMonthsAgo = new Date();
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const cutoff = eighteenMonthsAgo.toISOString().split('T')[0];
  const aligned18m = aligned.filter((d) => d.date >= cutoff);

  return {
    aligned,
    aligned18m: aligned18m.length ? aligned18m : aligned,
    current: {
      mstr: parseFloat(mstrPrice.toFixed(2)),
      btc: parseFloat(btcPrice.toFixed(2)),
      mstrChangePct: parseFloat(mstrChangePct.toFixed(2)),
      date: aligned.length ? aligned[aligned.length - 1].date : new Date().toISOString().split('T')[0],
    },
    meta: {
      fiftyTwoWeekHigh: parseFloat(fiftyTwoWeekHigh.toFixed(2)),
      fiftyTwoWeekLow: parseFloat(fiftyTwoWeekLow.toFixed(2)),
      volume: meta.regularMarketVolume ?? null,
      averageVolume: meta.averageDailyVolume10Day ?? null,
      marketCap,
    },
    company: {
      btcHeld,
      debt,
      cash,
      pref,
      shares,
      btcYieldYtd: treasury?.btcYieldYtd ?? null,
      btcGainYtd: treasury?.btcGainYtd ?? null,
      asOfDate: treasury?.asOfDate ?? null,
      treasuryHistory: treasury?.history ?? [],
    },
    technicals: {
      ma20: ma20[last] != null ? parseFloat(ma20[last].toFixed(2)) : null,
      ma50: ma50[last] != null ? parseFloat(ma50[last].toFixed(2)) : null,
      ma200: ma200[last] != null ? parseFloat(ma200[last].toFixed(2)) : null,
      rsi14: rsi(closes) != null ? parseFloat(rsi(closes).toFixed(1)) : null,
      betaVsBtc: betaVsBtc(recentMstr, recentBtc) != null
        ? parseFloat(betaVsBtc(recentMstr, recentBtc).toFixed(2))
        : null,
      annualizedVol:
        annualizedVol(recentMstr) != null
          ? parseFloat(annualizedVol(recentMstr).toFixed(0))
          : null,
      drawdownPct: parseFloat(drawdownPct.toFixed(1)),
      fibPeak: parseFloat(peakForFib.toFixed(2)),
      fibLow: parseFloat(lowForFib.toFixed(2)),
      fibs,
    },
    mnav: {
      ratio: mnavRatio != null ? parseFloat(mnavRatio.toFixed(2)) : null,
      btcReserve,
      enterpriseValue,
      navNet,
      navPerShare: navPerShare != null ? parseFloat(navPerShare.toFixed(2)) : null,
      marketCap,
      method: 'strategy',
    },
    fetchedAt: new Date().toISOString(),
  };
}
