# Deployment Guide — DigitalOcean App Platform

## Prerequisites

- GitHub account with the repo pushed
- DigitalOcean account ([sign up](https://cloud.digitalocean.com/registrations/new))

---

## Step 1: Create a PostgreSQL Database

1. Go to **Databases** in the DigitalOcean console
2. Click **Create Database Cluster**
3. Choose **PostgreSQL 15**
4. Select **Basic** plan ($15/month)
5. Choose a region close to your users
6. Name: `smb-dashboard-db`
7. Click **Create**
8. Wait ~5 minutes for provisioning
9. Copy the **Connection String** from the Overview tab

---

## Step 2: Push Code to GitHub

```bash
cd smb-dashboard-server
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/smb-dashboard-server.git
git push -u origin main
```

---

## Step 3: Create the App

1. Go to **Apps** → **Create App**
2. Choose **GitHub** as source
3. Select your repository and branch (`main`)
4. DigitalOcean will auto-detect the Dockerfile

---

## Step 4: Configure Environment Variables

Add these in the App's **Settings** → **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5001` |
| `DATABASE_URL` | *(connection string from Step 1)* |
| `JWT_SECRET` | *(generate a random 64-char string)* |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |

Add API keys for any integrations you want to enable.

---

## Step 5: Deploy

1. Click **Next** through the review steps
2. Choose **Basic** plan ($12/month)
3. Click **Create Resources**
4. Wait 2-3 minutes for deployment
5. Your API is live at the provided URL!

---

## Step 6: Verify

```bash
curl https://your-app.ondigitalocean.app/health
```

---

## Auto-Deploy

Every push to `main` will automatically redeploy the app.

---

## Scaling

- **Vertical**: Upgrade instance size in App Settings
- **Horizontal**: Add more instances (App Platform handles load balancing)
- **Database**: Upgrade to a larger plan as data grows

---

## Estimated Monthly Costs

| Service | Cost |
|---------|------|
| App Platform (Basic) | $12–25 |
| PostgreSQL (Basic) | $15 |
| **Total** | **$27–40** |
