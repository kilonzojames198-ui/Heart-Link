# 💖 HeartLink

Global dating app — Express · SQLite · EJS · Stripe · Admin Panel.

## Quick Start

```bash
npm install
npm run dev
```
Open **http://localhost:3000**

---

## Admin Access

The admin account is created automatically on first boot.

| Field    | Value                                |
|----------|--------------------------------------|
| URL      | http://localhost:3000/admin          |
| Email    | admin@heartlink.app                  |
| Password | Admin@2026!                          |

> Change these in `.env` before deploying:
> ```
> ADMIN_EMAIL=your@email.com
> ADMIN_PASSWORD=YourStrongPassword!
> ```

---

## Login Bug Fix (Why it wasn't logging in)

The issue was the SQLite database resets on every Render deploy because
the filesystem is ephemeral. **Fix:** Add a persistent disk on Render.

### Render Setup
1. Deploy the app → Web Service
2. Build: `npm install` · Start: `npm start`
3. **Environment → Add:**
   ```
   NODE_ENV=production
   SESSION_SECRET=long_random_string_here
   DB_PATH=/data/heartlink.db
   ADMIN_EMAIL=admin@heartlink.app
   ADMIN_PASSWORD=Admin@2026!
   ```
4. **Disks → Add Disk:**
   - Name: `heartlink-data`
   - Mount Path: `/data`
   - Size: 1 GB

The DB file at `/data/heartlink.db` now survives redeploys.
Registered users will never be wiped again.

---

## Testing Payments Locally

```bash
# 1. Register → Profile → Upgrade 💳
# 2. On the status page click "Simulate Confirmation"
# OR via terminal:
curl -X POST http://localhost:3000/payment/test-confirm/1
```

## Real Stripe Payments
Add to `.env`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
APP_URL=https://your-app.onrender.com
```

---

## Admin Panel Features
- 📊 Dashboard — users, matches, messages, revenue stats
- 👥 Users — search, suspend, restore, delete
- 💳 Payments — all transactions + total revenue
- 🚩 Reports — view and resolve user reports
