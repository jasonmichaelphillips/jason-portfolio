# Cloudflare Workers Quick Start

## Setup (5 minutes)

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Find Your IDs
1. Go to https://dash.cloudflare.com/
2. Click your domain
3. Right sidebar → Zone ID (copy it)
4. Top right profile icon → copy Account ID

### 3. Update wrangler.toml
```toml
name = "mstr-finance-api"
type = "javascript"
account_id = "PASTE_ACCOUNT_ID_HERE"
workers_dev = true
route = "https://jasonmichaelphillips.com/api/finance"
zone_id = "PASTE_ZONE_ID_HERE"

[build]
command = "npm install"
```

### 4. Deploy
```bash
cd backend
npm install
wrangler publish
```

### 5. Test
Visit: https://jasonmichaelphillips.com/api/finance

You should see JSON with MSTR and BTC prices ✅

## That's it!
Your API is now live on Cloudflare's global network, serving data from the edge.

## Local Testing (optional)
```bash
npm run dev
```
Opens http://localhost:8787/api/finance
