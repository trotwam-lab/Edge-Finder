# useOdds.js Refactor Map

## Why this file is the next big refactor target
`src/hooks/useOdds.js` currently mixes too many responsibilities in one place:
- localStorage-backed persistence helpers
- refresh scheduling / countdown logic
- odds fetching
- scores fetching
- injuries fetching
- player props fetching
- sport rotation logic
- game merge logic
- opening-line capture
- line-history tracking
- injury normalization
- connection / error state

## Safe future split
### 1. `usePersistentState.js`
Move the generic localStorage helper out of `useOdds.js`.

### 2. `odds-fetchers.js`
Extract plain fetch helpers:
- `fetchOdds`
- `fetchScores`
- `fetchInjuries`
- `fetchPlayerProps`

### 3. `sports-rotation.js`
Extract `getSportsToFetch()` and rotation logic.

### 4. `odds-normalizers.js`
Extract pure data transforms:
- merge scores into games
- build injury lookup map
- merge refreshed games into existing set

### 5. `line-history.js`
Extract opening-line capture and game-line history append logic.

### 6. `useOdds.js`
Keep only hook orchestration:
- state wiring
- calling helper modules
- refresh timer
- manual refresh API

## Things to avoid during refactor
- do not change the API contract returned by `useOdds()` in the first pass
- do not change free/pro gating logic during this refactor
- do not mix subscription cleanup with `useOdds` cleanup
- do not do a giant rewrite in one commit

## Best refactor order later
1. extract `usePersistentState`
2. extract pure fetchers
3. extract pure transforms
4. extract line-history helpers
5. slim the hook last
