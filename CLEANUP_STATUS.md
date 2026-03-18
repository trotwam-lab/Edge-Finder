# Cleanup Status

## Done on `chore/safe-deep-clean`
- Removed committed repo clutter (`node_modules`, `dist`, temp files, backup files, env helper files)
- Added a baseline `README.md`
- Removed unused client-side Supabase module (`src/lib/supabase.js`)
- Mapped the Firebase-first subscription cleanup path in `PHASE_1B_NOTES.md`
- Reworked subscription flow toward Firebase/Firestore:
  - `api/_firebaseAdmin.js`
  - `api/stripe-webhook.js`
  - `api/user-tier.js`
  - `src/firebase.js`
  - `src/AuthGate.jsx`
- Cleaned obvious encoding/comment artifacts in UI files
- Tightened stale/misleading comments in auth and Firestore-sync code

## Not deployed yet
These changes are still branch-only and should not be deployed until Vercel env vars are verified.

## Still pending
- Verify Vercel env vars for Firebase Admin
- Test webhook -> Firestore subscription updates
- Remove remaining server-side Supabase dependency from `package.json` only after deploy verification
- Larger refactors (`useOdds.js`, `App.jsx`)
- Bundle size reduction / code splitting
- CI / lint / test baseline
