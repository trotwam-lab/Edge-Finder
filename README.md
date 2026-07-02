# EdgeFinder

EdgeFinder is a live sports-betting intelligence dashboard: it compares odds across sportsbooks in real time to surface the best number, line moves, +EV edges, player props, arbitrage opportunities, and a personal bet tracker with CLV grading.

## Stack
- Frontend: React + Vite (`/src`)
- API: Vercel serverless functions (`/api`)
- Auth: Firebase Auth
- User data: Firestore
- Billing: Stripe (Pro subscriptions)
- iOS shell: Capacitor

## Product tiers
| Tier | What you get |
|------|--------------|
| Free | Board with 3 sportsbooks, props preview, bet tracker, watchlist, **Parlay Builder**, **Yesterday's Receipts** (the fully public, auto-graded record of yesterday's edges vs their closing lines) |
| Pro ($12.99/mo) | Today's live edge board, Daily Pro Report, **Arbitrage & Low-Hold Scanner**, steam tracker, all sportsbooks, unlimited props, EV/Kelly calculators |

The receipts pipeline snapshots each day's flagged edges (Firestore collection `edge_receipts`, one doc per ET date) as a side effect of the `/api/edges` scan, keeps observing their no-vig consensus until game start, and `/api/edge-receipts` serves the graded record publicly — it is the product's proof-of-work and requires the Firebase Admin env vars below.

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
The exact production values should be managed outside the repo (Vercel env settings).

### Serverless / Vercel
- `ODDS_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

### Firebase (subscription tier checks)
Use one of these setups:

#### Preferred (matches current Vercel setup)
- `FIREBASE_SERVICE_ACCOUNT` *(full JSON service account)*

#### Alternate
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## More docs
- `ARCHITECTURE.md` — how the pieces fit together
- `BUSINESS_PLAN.md` — pricing/tier strategy
- `IOS_APP_NOTES.md` — Capacitor/iOS packaging notes

## Notes
- Build output (`dist/`) and dependencies (`node_modules/`) should never be committed.
