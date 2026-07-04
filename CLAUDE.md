# Edge-Finder — agent notes

## Deploying
- Production is Vercel, git-connected: pushing `main` auto-deploys
  `www.edgefinderdaily.com` (also `edgefinder-betting.vercel.app`).
- "Deploy" means fast-forward `main` to the reviewed branch and push.
- After pushing main, verify the deployment via the Vercel MCP connector
  (`list_deployments` / `get_deployment_build_logs` for the project) and
  report build status to the user. If the connector's tool calls are
  blocked pending approval, ask the user to approve the Vercel connector
  rather than skipping verification.
- The app is a PWA: already-open clients only pick up a deploy after
  accepting the in-app update prompt or a full reload.

## Build / checks
- `npm run build` (vite) is the only baseline; there is no lint or test
  setup yet (see ARCHITECTURE.md "Known debt").

## Architecture pointers
- See ARCHITECTURE.md for ownership boundaries (Firebase Auth, Firestore,
  Stripe, Vercel API routes) and key files.
- Bets state lives in `src/App.jsx` via `useCloudBets` and is passed into
  `BetTracker`; closing-line auto-capture runs app-wide in
  `src/hooks/useClosingLineCapture.js`. Every bet mutation must stamp
  `updatedAt` (epoch ms) or the cloud/archive merge in
  `src/hooks/useCloudBets.js` may resolve conflicts against the edit.
- The Games tab fetches the static `SPORTS` map plus any in-season
  game-market sports discovered from `/api/sports`, so it always covers
  what the edges scan (`api/edges.js`) covers.
