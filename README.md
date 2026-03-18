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

## Required environment variables
The exact production values should be managed outside the repo.

### Frontend
- `VITE_SUPABASE_URL` *(legacy / verify before use)*
- `VITE_SUPABASE_ANON_KEY` *(legacy / verify before use)*

### Serverless / Vercel
- `ODDS_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` *(legacy / verify before use)*
- `SUPABASE_SERVICE_ROLE_KEY` *(legacy / verify before use)*

## Notes
- This repo is being standardised around the currently working Firebase login/subscriber flow.
- Legacy Supabase paths should be reviewed before adding new feature work.
- Build output (`dist/`) and dependencies (`node_modules/`) should never be committed.
