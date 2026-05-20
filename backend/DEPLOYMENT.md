# Deployment Guide for MSTR Dashboard Backend

## Quick Summary
The backend API fetches live MSTR and BTC data from Yahoo Finance and serves it via `/api/finance` endpoint. The frontend automatically detects where it's running and calls the appropriate URL.

**You're using Cloudflare Workers** - serverless deployment with zero maintenance!

## Cloudflare Workers Deployment (Recommended for you)

### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
```
This will open a browser and ask for permission to manage your Cloudflare account.

### Step 3: Configure wrangler.toml
Edit `/backend/wrangler.toml` and update:
```toml
account_id = "your_cloudflare_account_id"  # From https://dash.cloudflare.com/profile
zone_id = "your_cloudflare_zone_id"        # From your domain settings
route = "https://jasonmichaelphillips.com/api/finance"
```

**To find these IDs:**
- Go to https://dash.cloudflare.com/
- Select your domain
- Right sidebar shows "Zone ID"
- Account ID is in your profile

### Step 4: Deploy
```bash
cd backend
npm install
wrangler publish
```

### Step 5: Test
Visit: `https://jasonmichaelphillips.com/api/finance`

You should see live JSON data with MSTR and BTC prices.

## How It Works
- Worker runs globally on Cloudflare's edge network
- Automatically caches responses for 10 minutes
- Zero cold starts, instant responses
- Scales to any traffic automatically
- **Free tier includes 100,000 requests/day**

---

## Alternative: Local Development (Testing)

```bash
cd backend
npm install
npm start  # or: node server.js
# Runs on http://localhost:3000
```

## How Frontend Works
- Detects if accessed via `localhost` → uses `http://localhost:3000/api/finance`
- Detects if accessed via domain → uses `https://jasonmichaelphillips.com/api/finance`
- Falls back to static data if API is unavailable

## Troubleshooting

**"wrangler: command not found"**
```bash
npm install -g wrangler
```

**"Invalid API token"**
- Run `wrangler logout` then `wrangler login` again
- Make sure you're logged into the right Cloudflare account

**"Zone not found"**
- Check your zone_id in wrangler.toml matches your domain
- Verify the domain is active on Cloudflare

**Still see old data after deploy?**
- Clear browser cache: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Cache is 10 minutes, so wait and refresh

**API returns error**
```javascript
// Test in browser console
fetch('/api/finance').then(r => r.json()).then(console.log)
```
Check browser DevTools Network tab for errors.

