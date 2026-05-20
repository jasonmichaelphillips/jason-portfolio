# Deployment Guide for MSTR Dashboard Backend

## Quick Summary
The backend server fetches live MSTR and BTC data from Yahoo Finance and serves it via `/api/finance` endpoint. The frontend automatically detects where it's running and calls the appropriate URL.

## Local Development (Already Working)
```bash
cd backend
npm install
node server.js
# Runs on http://localhost:3000
```

## Production Deployment

### Option 1: Direct Node.js Deployment (Simplest)
If your hosting supports Node.js directly:

1. **Upload backend folder** to your server
2. **Create .env file** (copy from .env.example):
   ```
   PORT=3000
   ```
3. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
4. **Start with PM2** (recommended for auto-restart):
   ```bash
   npm install -g pm2
   pm2 start server.js --name "finance-api"
   pm2 startup
   pm2 save
   ```

### Option 2: Using Apache/Nginx Proxy
If your web server is Apache or Nginx:

1. Run backend on internal port (e.g., 3001):
   ```bash
   PORT=3001 node server.js
   ```

2. **For Apache**, add to .htaccess:
   ```apache
   RewriteEngine On
   RewriteRule ^api/finance$ http://localhost:3001/api/finance [P]
   ```

3. **For Nginx**, add to your server block:
   ```nginx
   location /api/finance {
       proxy_pass http://localhost:3001/api/finance;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

### Option 3: cPanel/Shared Hosting
1. Use Node.js application manager (if available)
2. Point to `backend/server.js`
3. Set environment variables in the panel
4. Backend will be accessible at your domain

## Testing
After deployment, test from your browser console:
```javascript
fetch('/api/finance').then(r => r.json()).then(console.log)
```

## What Your Frontend Does
- Detects if accessed via `localhost` → uses `http://localhost:3000/api/finance`
- Detects if accessed via domain → uses `https://jasonmichaelphillips.com/api/finance`
- Falls back to static data if API is unavailable

## Troubleshooting
- **CORS errors**: The backend includes CORS middleware, so cross-origin requests should work
- **503 errors**: Backend server isn't running - restart it
- **Stale data**: Cache headers are set to refresh every 10 seconds
- **Rate limiting**: Yahoo Finance may rate limit too many rapid requests
