# Deploy / Resume Checklist

## Branch
Work from: `chore/safe-deep-clean`

## What changed on this branch
- repo junk removed (`node_modules`, `dist`, temp/backup/env-helper files)
- baseline README added and improved
- unused client-side Supabase module removed
- Firebase-first subscription model mapped and partially implemented
- Stripe webhook rewritten to target Firestore instead of Supabase
- tier lookup updated to prefer Firestore, with Stripe/email fallback
- auth tier fetch updated to send both Firebase UID and email
- encoding/comment cleanup performed in several UI files
- architecture / cleanup / dependency / refactor docs added

## Before deploying
### Verify Vercel env vars
- `ODDS_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
Use one of these Firebase Admin setups:
- `FIREBASE_SERVICE_ACCOUNT` *(full JSON service account)*

OR
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Deployment sequence
1. Push `chore/safe-deep-clean`
2. Create preview deploy in Vercel
3. Verify env vars exist in the target Vercel project
4. Test preview app before touching production

## Preview test checklist
### Auth
- sign in works
- existing subscriber can log in
- free user can log in

### Tier / access
- free user still sees free gating
- pro user resolves as pro
- no obvious tier flicker or downgrade bug on refresh

### Billing flow
- checkout button still opens Stripe
- successful return path still shows success state
- canceled return path still behaves correctly

### Webhook / Firestore
- Stripe webhook writes subscription state into Firestore for test user
- user tier resolves from Firestore after webhook update
- Stripe/email fallback still works if Firestore record is absent

## Only after preview passes
- consider removing `@supabase/supabase-js` from `package.json`
- review whether any remaining Supabase server env vars can be removed
- start the `useOdds.js` refactor from `USEODDS_REFACTOR_MAP.md`

## If something fails
- do not merge immediately
- compare failing path against `PHASE_1B_NOTES.md`
- keep Firebase Auth untouched
- fall back to Stripe/email tier path while debugging
