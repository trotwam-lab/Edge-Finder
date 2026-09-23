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

## Checks
| Command | What it does |
|---------|--------------|
| `npm run lint` | ESLint (React hooks rules included) |
| `npm test` | Vitest unit tests (`src/**/*.test.js`, `api/**/*.test.js`) |
| `npm run test:rules` | Firestore security rules against the emulator (needs Java) |
| `npm run check` | lint + tests + build — run before pushing |

GitHub Actions runs lint, tests, build and the rules check on every PR.

## Firestore security rules
`firestore.rules` is **not** deployed by merging to `main` or by Vercel. After changing it, deploy with
`firebase deploy --only firestore:rules` (or paste it into the Firebase console → Firestore → Rules).
The `users/{uid}` document holds subscription fields and is read-only to clients; only the Stripe
webhook (Admin SDK) writes it. Bets live in `users/{uid}/data/bets` and `users/{uid}/bets_snapshots/*`.

## API protections
- Browser cross-origin access is limited to EdgeFinder's domains, Vercel previews and localhost (`api/_http.js`; add more with `ALLOWED_ORIGINS`).
- Every public route has a per-IP rate limit.
- `/api/odds` and `/api/props` share upstream responses across serverless instances through the Firestore `api_cache` collection (Admin SDK only; skipped when Admin credentials are missing).

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
