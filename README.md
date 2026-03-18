# Edge-Finder

Edge-Finder is a Vite/React sports betting dashboard with Vercel serverless API routes, Firebase authentication, Firestore-backed user data, and Stripe-powered Pro subscriptions.

## Current stack
- Frontend: React + Vite
- API: Vercel serverless functions in `/api`
- Auth: Firebase Auth
- User data: Firestore
- Billing: Stripe

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Required environment variables
The exact production values should be managed outside the repo.

### Serverless / Vercel
- `ODDS_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

### Required for the Firebase-first subscription branch
Use one of these setups:

#### Preferred (matches current Vercel setup)
- `FIREBASE_SERVICE_ACCOUNT` *(full JSON service account)*

#### Alternate
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Repo status
This repository is being cleaned up on the `chore/safe-deep-clean` branch.

See also:
- `CLEANUP_STATUS.md`
- `ARCHITECTURE.md`
- `PHASE_1B_NOTES.md`
- `USEODDS_REFACTOR_MAP.md`
- `DEPENDENCY_CLEANUP_PLAN.md`

## Notes
- This repo is being standardised around the currently working Firebase login/subscriber flow.
- Do not deploy the Firebase-first subscription changes until Vercel env vars are verified.
- Build output (`dist/`) and dependencies (`node_modules/`) should never be committed.
