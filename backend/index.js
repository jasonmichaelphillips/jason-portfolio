/**
 * Cloudflare Worker - MSTR/BTC Finance API
 * Fetches live financial data from Yahoo Finance
 */

export default {
  async fetch(request, env, ctx) {
    // Only handle GET requests to /api/finance
    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.pathname.includes('/api/finance')) {
      return new Response('Not Found', { status: 404 });
    }

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    try {
      const headers = { 'User-Agent': 'Mozilla/5.0' };
      
      // Fetch MSTR and BTC data from Yahoo Finance
      const [mstrRes, btcRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/MSTR?range=1y&interval=1d', { headers }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/BTC-USD?range=1y&interval=1d', { headers })
      ]);
      
      const mstrData = await mstrRes.json();
      const btcData = await btcRes.json();
      
      const mstrResult = mstrData.chart.result[0];
      const btcResult = btcData.chart.result[0];
      
      const mstrQuotes = mstrResult.indicators.quote[0];
      const btcQuotes = btcResult.indicators.quote[0];
      
      const aligned = [];
      const mstrLen = mstrResult.timestamp.length;
      
      // Use MSTR's timestamps as the base (trading days only)
      for (let i = 0; i < mstrLen; i++) {
        const mstrPrice = mstrQuotes.close[i];
        if (mstrPrice === null) continue;
        
        // Find closest BTC timestamp (BTC trades 24/7)
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
        if (btcPrice === null) continue;
        
        aligned.push({
          timestamp: mstrTime,
          date: new Date(mstrTime * 1000).toISOString().split('T')[0],
          mstr: parseFloat(mstrPrice.toFixed(2)),
          btc: parseFloat(btcPrice.toFixed(2))
        });
      }
      
      // Get current prices (last valid entries)
      const current = aligned.length > 0 ? aligned[aligned.length - 1] : {};
      
      const response = {
        aligned: aligned,
        current: {
          mstr: current.mstr || 0,
          btc: current.btc || 0,
          date: current.date || new Date().toISOString().split('T')[0]
        }
      };
      
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'max-age=600', // Cache for 10 minutes
        }
      });
      
    } catch (error) {
      console.error('Error fetching data:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch financial data',
          details: error.message 
        }), 
        { 
          status: 500,
          headers: corsHeaders 
        }
      );
    }
  }
};
