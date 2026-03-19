# Edge-Finder Architecture

## Current live architecture
- Frontend: React + Vite
- API: Vercel serverless routes in `/api`
- Identity: Firebase Auth
- User data: Firestore
- Billing: Stripe
- Odds / scores / injuries / props: upstream APIs behind `/api/*` routes

## Current direction
This repo is being standardised around the working Firebase login/subscriber flow.

## Ownership boundaries
### Firebase Auth
- user sign-up / sign-in
- stable user identity (`uid`)

### Firestore
- synced user data
- target datastore for subscription status
- bet-tracker persistence

### Stripe
- checkout sessions
- subscription billing events
- fallback subscription lookup during migration

### Vercel API routes
- shield secrets from client
- proxy / normalize sportsbook and sports-data calls
- handle Stripe checkout + webhook logic

## Key files
- `src/AuthGate.jsx` — auth state + tier loading
- `src/firebase.js` — Firebase client setup + tier helper
- `src/hooks/useCloudBets.js` — Firestore-backed bet sync
- `src/hooks/useOdds.js` — major client-side orchestration hook
- `api/create-checkout.js` — Stripe checkout creation
- `api/user-tier.js` — tier lookup (Firestore first, Stripe fallback)
- `api/stripe-webhook.js` — Stripe event handling
- `api/_firebaseAdmin.js` — Firebase Admin / Firestore server helper

## Known debt
- `src/hooks/useOdds.js` is oversized and mixes fetch, merge, polling, cache, and history logic
- `src/App.jsx` is still a large orchestration component
- bundle size is too large and needs code-splitting later
- CI / lint / test baseline still missing
