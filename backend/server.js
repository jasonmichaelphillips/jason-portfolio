require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const API_KEY = process.env.YOUTUBE_API_KEY;
const PORT = 3000;

app.get('/api/videos', async (req, res) => {
    try {
        const channelId = 'UCgR5VYHYy-u_HIiimcYQOMA';
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=12&type=video`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching videos' });
    }
});

app.get('/api/finance', async (req, res) => {
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        
        // Fetch MSTR and BTC data
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
            
            const ts = mstrResult.timestamp[i];
            
            // Find closest BTC price
            let btcPrice = btcQuotes.close[btcQuotes.close.length - 1]; // fallback
            // Try to find matching timestamp in BTC data (BTC trades 24/7, so find same day)
            for(let j = 0; j < btcResult.timestamp.length; j++) {
                // if within same day (approx 86400s)
                if(Math.abs(btcResult.timestamp[j] - ts) < 86400) {
                    if(btcQuotes.close[j] !== null) {
                        btcPrice = btcQuotes.close[j];
                    }
                }
            }
            
            // Format date to YYYY-MM-DD
            const d = new Date(ts * 1000);
            const dateStr = d.toISOString().split('T')[0];
            
            aligned.push({
                date: dateStr,
                mstr: mstrPrice,
                btc: btcPrice
            });
        }
        
        const currentMstr = mstrResult.meta.regularMarketPrice;
        const currentBtc = btcResult.meta.regularMarketPrice;
        
        res.json({
            aligned,
            current: {
                mstr: currentMstr,
                btc: currentBtc
            }
        });
        
    } catch (error) {
        console.error('Error fetching finance data:', error);
        res.status(500).json({ error: 'Error fetching finance data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});