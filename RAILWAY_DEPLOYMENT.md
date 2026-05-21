# Railway Deployment Guide for Splitmaro API

Deploy your Node.js/Express backend to Railway (free tier) and use your ServerByt domain via CNAME.

---

## Step 1: Create Railway Account
1. Go to https://railway.app
2. Click **"Start Free"**
3. Sign up with GitHub (easiest)
4. Authorize Railway to access your GitHub account

---

## Step 2: Create a New Project in Railway
1. Click **"Create New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for your repo (if you have `vibhag` on GitHub)
   - If not on GitHub yet, see **Appendix: Push to GitHub** below
4. Select the repo and authorize

---

## Step 3: Add PostgreSQL Database
1. In your Railway project, click **"+ Add"**
2. Select **"PostgreSQL"**
3. Railway creates a managed PostgreSQL instance automatically
4. Copy the connection string (you'll need it in next step)

---

## Step 4: Configure Environment Variables
In Railway Dashboard:

1. Click on your **Node.js service**
2. Go to **"Variables"** tab
3. Add these variables:

```
DATABASE_URL=<paste PostgreSQL connection string from Step 3>
JWT_SECRET=your-super-secret-jwt-key-change-me
NODE_ENV=production
PORT=3000
```

**For EXPO_PUBLIC_API_URL**, add:
```
EXPO_PUBLIC_API_URL=https://api.dineshruhela.com
```

Save variables.

---

## Step 5: Configure Build & Deploy Settings
1. Go to **"Settings"** tab in your Node.js service
2. Set **Start Command**: `npm start`
3. Set **Build Command**: `npm install && npx prisma generate`
4. Save

---

## Step 6: Deploy
1. Click **"Deploy"** (or it auto-deploys on GitHub push)
2. Wait for build to finish (2-5 minutes)
3. Once deployed, Railway gives you a URL like: `https://splitmaro-api-prod-xyz.railway.app`
4. Test it: `curl https://splitmaro-api-prod-xyz.railway.app/auth/login`

---

## Step 7: Connect Your Domain (dineshruhela.com)
1. In Railway, go to **"Settings"** → **"Domains"**
2. Click **"+ Add Domain"**
3. Enter: `api.dineshruhela.com`
4. Railway shows you a CNAME target (e.g., `cname.railway.internal`)

---

## Step 8: Add CNAME Record in ServerByt cPanel
1. Log into ServerByt cPanel: https://cpanel.dineshruhela.com
2. Go to **"Zone Editor"** or **"DNS"**
3. Create a new CNAME record:
   - **Name**: `api`
   - **Type**: `CNAME`
   - **Target**: (paste the Railway CNAME from Step 7)
4. Save

**Wait 5-15 minutes for DNS propagation.**

Test:
```bash
curl https://api.dineshruhela.com/auth/login
```

---

## Step 9: Update Your Mobile App
Once `api.dineshruhela.com` is live:

1. Update `.env` in your React Native project:
```
EXPO_PUBLIC_API_URL=https://api.dineshruhela.com
```

2. Rebuild your app:
```bash
cd /Users/dineshruhela/Work/vibhag
npm run build
# or
eas build
```

3. Redeploy to Expo Go or app stores

---

## Monitoring & Logs
- In Railway Dashboard, click your service
- Go to **"Logs"** to see real-time output
- Use `pm2 logs` equivalent via Railway's log viewer

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check Railway logs; likely missing env vars or Prisma error |
| Database connection error | Verify `DATABASE_URL` matches PostgreSQL instance |
| Domain not resolving | Wait 15 min for DNS, or check CNAME record in cPanel |
| Cold start (slow first request) | Normal on free tier; auto-scales on paid |

---

## Appendix: Push Your Code to GitHub (If Not Already)

### If you don't have a GitHub repo yet:

1. **Create GitHub repo:**
   - Go to https://github.com/new
   - Name: `vibhag` (or your choice)
   - Public or Private (private recommended)
   - Create repo

2. **Push local code to GitHub:**
```bash
cd /Users/dineshruhela/Work/vibhag
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vibhag.git
git push -u origin main
```

3. **Then follow Railway deployment steps** using your new GitHub repo.

---

## Next Steps
- Deploy, test, and monitor in Railway
- Once stable, consider upgrading to **Railway paid tier** ($5/month) for better uptime
- Monitor your mobile app's sync and API calls

**All set?** Let me know if you hit any issues during Railway setup!
