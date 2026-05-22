/**
 * Live analyst targets from Yahoo Finance (upgrade/downgrade history + consensus).
 */

const UA = 'Mozilla/5.0 (compatible; MSTR-Dashboard/1.0)';

function storeCookies(response, jar) {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  for (const cookie of cookies) {
    const pair = cookie.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq), pair);
  }
}

function cookieHeader(jar) {
  return [...jar.values()].join('; ');
}

function median(sorted) {
  const n = sorted.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function recommendationLabel(trend) {
  if (!trend?.length) return null;
  const current = trend.find((t) => t.period === '0m') || trend[0];
  const bullish = (current.strongBuy || 0) + (current.buy || 0);
  const total =
    bullish +
    (current.hold || 0) +
    (current.sell || 0) +
    (current.strongSell || 0);
  if (!total) return null;
  const pct = Math.round((bullish / total) * 100);
  let label = 'Hold';
  if (pct >= 70) label = 'Strong Buy';
  else if (pct >= 50) label = 'Buy';
  else if (pct <= 30) label = 'Sell';
  return { label, analystCount: total, bullishPct: pct };
}

export async function fetchYahooAnalysts(symbol = 'MSTR') {
  const jar = new Map();

  const bootstrap = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } });
  storeCookies(bootstrap, jar);

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookieHeader(jar) },
  });
  storeCookies(crumbRes, jar);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb) throw new Error('Yahoo crumb empty');

  const modules = 'financialData,upgradeDowngradeHistory,recommendationTrend';
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}` +
    `?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: cookieHeader(jar) },
  });
  if (!res.ok) throw new Error(`Yahoo analysts ${symbol}: ${res.status}`);

  const data = await res.json();
  const result = data?.quoteSummary?.result?.[0];
  if (!result) throw new Error('Yahoo analysts: empty result');

  const financial = result.financialData || {};
  const history = result.upgradeDowngradeHistory?.history || [];
  const rec = recommendationLabel(result.recommendationTrend?.trend);

  const byFirm = new Map();
  for (const row of history) {
    const target = row.currentPriceTarget;
    if (target == null || !Number.isFinite(target)) continue;
    const prev = byFirm.get(row.firm);
    if (!prev || row.epochGradeDate > prev.epochGradeDate) {
      byFirm.set(row.firm, row);
    }
  }

  const targets = [...byFirm.values()]
    .map((row) => ({
      firm: row.firm,
      analyst: row.firm,
      target: Math.round(row.currentPriceTarget * 100) / 100,
      date: new Date(row.epochGradeDate * 1000).toISOString().split('T')[0],
      action: row.priceTargetAction || row.action,
      rating: row.toGrade,
      priorTarget: row.priorPriceTarget ?? null,
    }))
    .sort((a, b) => b.target - a.target);

  const targetValues = targets.map((t) => t.target).sort((a, b) => a - b);
  const highRow = targets[0];
  const lowRow = targets[targets.length - 1];

  const consensus = {
    average: financial.targetMeanPrice?.raw ?? null,
    median: financial.targetMedianPrice?.raw ?? median(targetValues),
    high: financial.targetHighPrice?.raw ?? highRow?.target ?? null,
    low: financial.targetLowPrice?.raw ?? lowRow?.target ?? null,
    highFirm: highRow?.firm ?? null,
    lowFirm: lowRow?.firm ?? null,
    analystCount: rec?.analystCount ?? targets.length,
    recommendation: rec?.label ?? null,
    bullishPct: rec?.bullishPct ?? null,
  };

  return {
    source: 'yahoo',
    fetchedAt: new Date().toISOString(),
    targets,
    consensus,
  };
}
