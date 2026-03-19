# Dependency Cleanup Plan

## Current goal
Do not remove runtime dependencies blindly. This repo has active branch-only cleanup work and has not yet been re-verified in Vercel.

## Likely removable later
### `@supabase/supabase-js`
Reason:
- client-side Supabase module has already been removed
- subscription flow has been reworked toward Firebase/Firestore on this branch
- this package should only be removed after deploy verification confirms nothing server-side still depends on Supabase

## Required now
### `firebase`
Used by client auth and Firestore access.

### `firebase-admin`
Used by serverless subscription / webhook flow on this branch.

### `stripe`
Used by checkout and webhook routes.

### `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
Core app/build dependencies.

### `lucide-react`, `recharts`, `vite-plugin-pwa`
In active use by the frontend/PWA build.

## Later engineering cleanup
After deploy verification, consider:
- adding `lint` and test scripts
- reviewing deprecated transitive packages via `npm audit` and dependency tree inspection
- reducing client bundle size with code-splitting before major dependency expansion

## Rule
No dependency removals that affect auth, billing, or deploy behavior until the Firebase-first branch has been verified in Vercel.
