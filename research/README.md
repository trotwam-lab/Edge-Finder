# EdgeFinder Research Layer

Sport-agnostic scaffolding for the research/publish pipeline:

```
sports_registry.json  ->  SportAdapter  ->  RefreshEngine  ->  PublishGate
```

Every sport is described by one registry entry with four slots — schedule,
availability, form, freshness — plus a cadence (`daily` / `weekly` / `event`)
that picks which adapter class runs it. The engine never knows what sport it's
running; it only knows cadence, slots, and gates.

**Adding a sport = adding a registry entry.** No new engine code unless the
sport introduces a brand-new availability primitive (rare — there are five:
confirmed lineups, injury report, confirmed XI, withdrawal watch, weigh-in
watch).

## Files

- `base_adapter.py` — enums, registry dataclasses, the `SportAdapter` ABC,
  the three cadence-family adapters, and the registry loader. The fetch
  methods are intentionally `NotImplementedError` stubs: gate logic and the
  stake policy are real, the data clients get wired next.
- `sports_registry.json` — the registry. Eight sports today (MLB, KBO, NBA,
  NFL, EPL soccer, MMA, tennis, golf). Source refs point at this repo's
  existing `/api/*` routes and Odds API sport keys (`src/constants.js`)
  where they exist.

## Smoke test

```
python3 research/base_adapter.py
```

Prints every registered sport with its cadence, availability primitive, and
publish gate. Requires Python 3.10+ (uses `X | None` annotations), no
third-party deps.

## Stake policy (uniform across sports)

| Gate | Meaning | Stake |
|---|---|---|
| `open` | gate event happened, thesis held | full |
| `pending` | gate event not yet happened | half, labeled "pending gate" |
| `flagged` | gate event changed the thesis | zero — edge void |
| `degraded` | gate check couldn't run (source down) | half + disclaimer |

This directory is research tooling only — it is not part of the Vite build or
the Vercel serverless bundle.
