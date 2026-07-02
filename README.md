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
| Free | Board with 3 sportsbooks, props preview, bet tracker, watchlist, **Parlay Builder** |
| Pro ($12.99/mo) | Daily Pro Report, **Arbitrage & Low-Hold Scanner**, full edge board, steam tracker, all sportsbooks, unlimited props, EV/Kelly calculators |

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
