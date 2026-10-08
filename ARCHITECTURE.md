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

## Research layer (scaffolding)
- `research/` holds the sport-adapter architecture for the research/publish pipeline: a JSON sport registry (`research/sports_registry.json`) builds cadence-family adapters (`research/base_adapter.py`) that expose schedule/availability/form slots and a publish gate with a uniform stake policy
- adding a sport = adding a registry entry; see `research/README.md`
- Python tooling only — not part of the Vite build or Vercel functions

- `api/verified-bets.js` + `api/_ledger.js` — verified bet ledger: market-checked, server-timestamped, hash-chained; closes fed from the edge scan, results from final scores
- `src/utils/ledger.js` — chain hashing/verification and record stats, shared by server and browser
- `src/utils/grading.js` — deterministic bet grading from final scores (shared, unit tested)
- `src/hooks/useVerifiedLedger.js` — auto-verifies new board bets, re-checks the chain in the browser, carries results into the tracker
- `api/_oddsFeed.js` — the one upstream odds fetch shared by `/api/odds` and verification
- `api/_http.js` — CORS allowlist + per-IP rate limit for every public route
- `api/_sharedCache.js` — cross-instance Firestore cache for odds/props upstream calls
- `api/revoke-sessions.js` — "sign out of all devices"
- `src/utils/bets.js` — bet dates, CLV, grading and settlement (unit tested)
- `src/utils/storage.js` — throw-safe localStorage helpers; resets never touch bets
- `src/components/welcome/` — signed-out landing page sections

## Known debt
- `src/hooks/useOdds.js` is oversized and mixes fetch, merge, polling, cache, and history logic
- `src/App.jsx` and `src/components/BetTracker.jsx` are still large components; most styling is inline
- bundle: the signed-in app (`App.jsx`) and Firestore are split out of the landing-page path (`src/main.jsx`, `vite.config.js`); recharts is still a large chunk, loaded only by the Tracker and game details

## Rendering performance
- `useOdds` exposes `nextRefreshAt` (a timestamp), not a ticking countdown — anything that shows seconds uses `useNow` (`src/hooks/useNow.js`) in a small leaf component so the board doesn't re-render every second
- `GameCard` is memoized; pass it stable callbacks (`useCallback`) or it re-renders with every parent update
