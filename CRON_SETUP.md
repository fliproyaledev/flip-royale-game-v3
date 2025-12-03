# Cron Job Setup Guide

## Overview
The game uses Vercel Cron Jobs to automatically settle rounds every day at **UTC 00:00**.

## How It Works

### 1. Automatic Round Settlement (UTC 00:00)
- **Trigger:** Vercel Cron Job runs daily at midnight UTC
- **Endpoint:** `/api/cron/settle-rounds`
- **Process:**
  1. ✅ Calculates final points for all active cards
  2. ✅ Locks prices at UTC 00:00 (pClose)
  3. ✅ Credits bankPoints to all users
  4. ✅ Moves "Next Round" picks → "Active Round"
  5. ✅ Clears "Next Round" slots
  6. ✅ Increments global round counter
  7. ✅ Saves history & stats

### 2. Finalizing Window (00:00 - 00:05 UTC)
- During this 5-minute window, the UI shows **"Finalizing..."** message
- Users cannot:
  - View active cards (settlement in progress)
  - Select next round picks (locked during calculation)
- After 00:05, everything returns to normal

## Environment Variables Required

### Vercel Dashboard → Settings → Environment Variables

Add this variable to **both Production and Preview**:

```
CRON_SECRET=<your-secret-key>
```

**Security:**
- Use a strong random string (32+ characters)
- Same secret must be used in both frontend and any manual cron triggers
- Never commit this to git!

### Example:
```bash
# Generate a secure random secret (run locally):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Vercel Cron Configuration

The cron job is defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/settle-rounds",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Schedule Format:** `0 0 * * *` = Every day at 00:00 UTC

## Manual Testing

You can manually trigger the cron endpoint:

```bash
# Replace <YOUR_SECRET> with your CRON_SECRET value
curl "https://your-app.vercel.app/api/cron/settle-rounds?key=<YOUR_SECRET>"
```

**Expected Response:**
```json
{
  "ok": true,
  "date": "2025-12-03",
  "newGlobalRound": 42,
  "settledCount": 150,
  "globalStats": {
    "totalPlayers": 150,
    "totalPointsDistributed": 45000,
    "topPlayer": {
      "username": "CryptoKing",
      "points": 2500
    }
  }
}
```

## Troubleshooting

### Cron not running?
1. Check Vercel Logs → Functions tab
2. Verify `CRON_SECRET` is set in Vercel env vars
3. Ensure `vercel.json` is committed and deployed

### Getting "Unauthorized" error?
- The secret in Vercel env vars must match exactly
- Check for trailing spaces or quotes

### Users not seeing new round?
- Frontend auto-refreshes data every 10 seconds after UTC 00:00
- Users may need to refresh browser if they were offline during settlement

## Architecture

```
┌─────────────────┐
│  Vercel Cron    │  (Runs at UTC 00:00)
│   Scheduler     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ /api/cron/settle-rounds │
│                         │
│  1. Load all users      │
│  2. Calculate points    │
│  3. Update Redis KV     │
│  4. Move rounds         │
│  5. Increment counter   │
└─────────────────────────┘
```

## Frontend Integration

The frontend (`pages/index.tsx`) automatically:
- Detects UTC 00:00-00:05 window
- Shows "Finalizing..." UI
- Polls for fresh data every 10 seconds
- Reloads user state after settlement

No manual intervention needed! 🎉
