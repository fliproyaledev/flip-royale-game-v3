# Oracle Backend - Add "Get All Users" Endpoint

## File to Create in Oracle Repo

You need to add this file to your **flip-royale-oracle-v2** repository:

### File Path:
```
pages/api/users/all.ts
```

### Code:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

const ORACLE_SECRET = process.env.ORACLE_SECRET;

/**
 * GET /api/users/all
 * Returns all users from the USERS hash in KV
 * Used by cron jobs for batch operations (e.g., daily round settlement)
 * Requires ORACLE_SECRET authentication
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  const providedSecret = authHeader?.replace('Bearer ', '');
  
  if (providedSecret !== ORACLE_SECRET) {
    console.error('[Oracle] Unauthorized attempt to get all users');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Oracle] Fetching all users from KV...');
    
    // Fetch all users from USERS hash
    const allUsersObj = (await kv.hgetall('USERS')) || {};
    const users = Object.values(allUsersObj);
    
    console.log(`[Oracle] Found ${users.length} users`);
    
    return res.status(200).json({
      ok: true,
      users,
      count: users.length
    });
    
  } catch (error: any) {
    console.error('[Oracle] Get All Users Error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
}
```

## Steps to Deploy

1. **Add the file** to your Oracle repo at `pages/api/users/all.ts`
2. **Commit and push** to GitHub
3. **Wait for Vercel** to automatically deploy the changes
4. **Test the endpoint** (optional):
   ```bash
   curl -H "Authorization: Bearer YOUR_ORACLE_SECRET" \
        https://flip-royale-oracle-v2.vercel.app/api/users/all
   ```

## Why This is Needed

The daily round settlement cron job (`/api/cron/settle-rounds`) needs to iterate through all users to:
- Calculate points from completed Active Round picks
- Move Next Round picks → Active Round
- Clear Next Round slots
- Save history entries

Previously, this used direct KV access (`loadUsers()`), but your system has migrated to the Oracle API pattern where all KV operations go through the Oracle backend.

This endpoint provides the list of all users so the cron job can process them one by one using the existing `updateUser()` function.

## Security

- Protected by `ORACLE_SECRET` authentication (Bearer token)
- Only returns data, does not modify anything
- Used exclusively by backend cron jobs (not exposed to frontend)

## What Happens After

Once this endpoint is deployed, your refactored `settle-rounds.ts` will:
1. Call `/api/users/all` to get all users
2. Loop through each user
3. Calculate points and update rounds
4. Call `/api/users/update` for each user to save changes

This completes the migration from direct KV access to the Oracle API architecture.
