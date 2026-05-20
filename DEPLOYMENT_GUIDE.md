# ServerByt Deployment Guide for Splitmaro API

## Prerequisites
- ServerByt VPS/Hosting with SSH access (Ubuntu 20.04+)
- Your domain registered and ready to point to ServerByt
- PostgreSQL database running (local or managed)

---

## Step-by-Step Deployment Commands

### 1. SSH into Your Server
```bash
ssh root@your_server_ip
# or
ssh user@your_server_ip
```

---

### 2. Update System & Install Node.js (v20+)
```bash
sudo apt update
sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm
node -v
npm -v
```

---

### 3. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 -v
```

---

### 4. Create App Directory & Upload Code
```bash
mkdir -p /var/www/splitmaro-api
cd /var/www/splitmaro-api

# Option A: Git clone (if you have a GitHub repo)
git clone https://github.com/youruser/vibhag.git .
cd splitmaro-api

# Option B: Upload via SFTP/FTP
# Use FileZilla or scp to upload your splitmaro-api folder to /var/www/splitmaro-api/
```

---

### 5. Create .env File on Server
```bash
nano /var/www/splitmaro-api/.env
```

**Paste the following** (update with your values):
```
DATABASE_URL=postgresql://user:password@localhost:5432/vibhag
JWT_SECRET=your-super-secret-jwt-key-change-me
PORT=3000
NODE_ENV=production
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

**Save & Exit:** Press `Ctrl+X`, then `Y`, then `Enter`.

---

### 6. Install Dependencies & Setup Database
```bash
cd /var/www/splitmaro-api
npm install
npx prisma generate
npx prisma migrate deploy
```

---

### 7. Start App with PM2
```bash
pm2 start npm --name "splitmaro-api" -- start
pm2 save
pm2 startup
```

**Verify it's running:**
```bash
pm2 list
pm2 logs splitmaro-api
```

---

### 8. Install & Configure Nginx (Reverse Proxy)
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Create Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/splitmaro-api
```

**Paste the following:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/splitmaro-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 9. Setup SSL (HTTPS) with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

**Auto-renew SSL:**
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

### 10. Point Your Domain to ServerByt
- Go to your domain registrar (GoDaddy, Namecheap, etc.)
- Update DNS `A` record to point to your ServerByt IP
- Update `CNAME` (if needed) or `A` records as instructed by ServerByt

**Wait 5-30 minutes for DNS propagation.**

---

## 11. Test Your Deployment

**From your local machine:**
```bash
curl https://api.yourdomain.com/auth/login
# Should return something (not a connection error)
```

**In your React Native app, update:**
```javascript
// lib/api.ts
const API_URL = 'https://api.yourdomain.com';
// Rebuild and redeploy your app
```

---

## Monitoring & Maintenance

**View logs:**
```bash
pm2 logs splitmaro-api
```

**Restart app:**
```bash
pm2 restart splitmaro-api
```

**Reload Nginx:**
```bash
sudo systemctl reload nginx
```

**Check SSL expiry:**
```bash
sudo certbot certificates
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `lsof -i :3000` then `kill -9 <PID>` |
| Nginx not connecting to app | Check PM2 is running: `pm2 list` |
| SSL certificate fails | Ensure DNS is set correctly, wait 5 min, retry certbot |
| Database connection error | Verify `DATABASE_URL` in `.env`, check PostgreSQL is running |

---

## Next: Update Your Mobile App

Once deployed and tested:

1. **Update `.env` in your React Native project:**
   ```
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com
   ```

2. **Rebuild your app:**
   ```bash
   cd /Users/dineshruhela/Work/vibhag
   npm run build  # or eas build (if using Expo)
   ```

3. **Deploy to app stores or test with Expo Go.**

---

**Need help with any step?** Let me know!
