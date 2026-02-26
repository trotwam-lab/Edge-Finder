# CLAUDE.md - Edge-Finder

## Project Overview

**Edge-Finder** is an industry-leading sports arbitrage and edge-detection platform. It analyzes real-time odds from multiple sportsbooks, tracks line movement persistently, monitors injuries, and surfaces profitable edges for every game.

- **Repository**: trotwam-lab/Edge-Finder
- **Status**: Active development — core platform built

## Repository Structure

```
Edge-Finder/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
├── public/
└── src/
    ├── app/
    │   ├── layout.tsx              # Root layout with ThemeProvider
    │   ├── page.tsx                # Dashboard (main page)
    │   ├── globals.css             # Tailwind + custom styles
    │   ├── edge-finder/page.tsx    # Edge detection + arb calculator
    │   ├── line-movement/page.tsx  # Persistent line tracking
    │   ├── injuries/page.tsx       # Real-time injury tracker
    │   ├── games/page.tsx          # All games browser
    │   ├── games/[id]/page.tsx     # Individual game details
    │   ├── settings/page.tsx       # Theme + subscription settings
    │   └── api/
    │       ├── odds/route.ts           # Odds API integration
    │       ├── edges/route.ts          # Edge detection engine
    │       ├── line-movement/route.ts  # Line movement recording
    │       ├── injuries/route.ts       # Injury data aggregation
    │       └── webhooks/stripe/route.ts # Stripe webhook handler
    ├── components/
    │   ├── layout/     # Header, ThemeToggle
    │   ├── ui/         # Card, Badge, Spinner (shared)
    │   ├── dashboard/  # StatsOverview, GameCard
    │   ├── edges/      # EdgeCard, EdgeFinder, ArbitrageCalculator
    │   ├── line-movement/ # LineMovementTracker, LineChart
    │   ├── injuries/   # InjuryTracker
    │   └── games/      # GameDetails, PropsView
    ├── hooks/          # useOdds, useEdges, useLineMovement, useInjuries
    ├── lib/
    │   ├── odds-api.ts        # The Odds API client with caching
    │   ├── edge-calculator.ts # Arbitrage, +EV, steam, RLM detection
    │   ├── line-storage.ts    # Persistent line movement storage
    │   ├── injuries.ts        # ESPN injury aggregation
    │   ├── stripe.ts          # Payment plans & webhook helpers
    │   ├── sports-config.ts   # Sport definitions
    │   └── format.ts          # Display formatting utilities
    ├── types/index.ts         # All TypeScript interfaces
    └── context/ThemeContext.tsx # Dark/light/system theme
```

## Development Setup

- **Language**: TypeScript
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with dark mode (`class` strategy)
- **Package manager**: npm
- **Runtime**: Node.js 18+

## Common Commands

| Task         | Command           |
|--------------|-------------------|
| Install deps | `npm install`     |
| Build        | `npm run build`   |
| Dev server   | `npm run dev`     |
| Lint         | `npm run lint`    |
| Type check   | `npm run type-check` |
| Start prod   | `npm start`       |

## Architecture

### Entry Points
- `src/app/layout.tsx` — Root layout, theme provider, header
- `src/app/page.tsx` — Dashboard landing page

### Key Modules
- **Edge Calculator** (`lib/edge-calculator.ts`): Detects arbitrage, +EV, steam moves, reverse line movement, and injury edges
- **Odds API Client** (`lib/odds-api.ts`): Wraps The Odds API with caching and retry logic
- **Line Storage** (`lib/line-storage.ts`): Persists line movement to disk (not session-limited)
- **Injury Aggregator** (`lib/injuries.ts`): Fetches from ESPN with impact rating calculation
- **Stripe Integration** (`lib/stripe.ts` + `api/webhooks/stripe`): Subscription management with signature verification

### Data Flow
1. Odds API → cached in memory (1 min TTL) → served via `/api/odds`
2. Line snapshots recorded on each fetch → persisted to `./data/line-history/`
3. Edge calculator runs across all games, combining odds + line movement + injuries
4. Injury data fetched from ESPN with 5-min cache, rated by position impact

### External Services
- **The Odds API** — odds and scores data
- **ESPN API** — injury reports
- **Stripe** — payment processing

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `ODDS_API_KEY` — from https://the-odds-api.com
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Conventions for AI Assistants

### General

- Read existing code before proposing changes. Never modify files you haven't read.
- Keep changes minimal and focused on the task at hand. Avoid unrelated refactors.
- Do not add features, abstractions, or error handling beyond what is requested.
- Do not introduce security vulnerabilities (command injection, XSS, SQL injection, etc.).

### Code Style

- Follow whatever linting/formatting configuration is established in the project.
- Match the style of surrounding code when making changes.
- Do not add comments, docstrings, or type annotations to code you didn't change.

### Git

- Write clear, concise commit messages that describe the "why" not the "what".
- Commit only the files relevant to the change.
- Do not commit secrets, credentials, or environment files.

### Testing

- When tests exist, run them after making changes to verify nothing is broken.
- Add tests for new functionality when a testing framework is in place.

### Dependencies

- Do not add new dependencies without a clear need.
- Prefer well-maintained, widely-used packages when dependencies are necessary.
