// src/utils/board-snapshot.js
// Compact, lossless encoding of the odds board for the saved "instant open"
// snapshot. A full board (~70 sports, ~900 games, a dozen books each) is ~6MB
// as plain JSON — over the snapshot cap and most of localStorage's ~5MB — so
// it was never saved and every open waited on the network. Odds are stored as
// positional arrays instead of repeated key names, and outcome names that are
// the game's own teams become 0 (home) / 1 (away). Anything with fields this
// encoder doesn't know is kept verbatim, so decoding returns exactly what was
// encoded. Per-book/market `last_update` stamps (unused by the app, ~25% of
// the payload) are the only thing dropped.

const HOME = 0;
const AWAY = 1;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const onlyKeys = (obj, allowed) => Object.keys(obj).every(key => allowed.has(key));
const OUTCOME_KEYS = new Set(['name', 'price', 'point']);
const MARKET_KEYS = new Set(['key', 'outcomes', 'last_update']);
const BOOK_KEYS = new Set(['key', 'title', 'markets', 'last_update']);

function withoutLastUpdate(obj) {
  if (!obj || typeof obj !== 'object' || !('last_update' in obj)) return obj;
  const { last_update: _unused, ...rest } = obj;
  return rest;
}

function encodeOutcome(outcome, game) {
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)
    || !onlyKeys(outcome, OUTCOME_KEYS) || typeof outcome.name !== 'string' || !isNum(outcome.price)
    || ('point' in outcome && !isNum(outcome.point))) {
    return { v: outcome };
  }
  const name = outcome.name === game.home_team ? HOME : outcome.name === game.away_team ? AWAY : outcome.name;
  return 'point' in outcome ? [name, outcome.price, outcome.point] : [name, outcome.price];
}

function decodeOutcome(encoded, game) {
  if (!Array.isArray(encoded)) return encoded.v;
  const [code, price, point] = encoded;
  const name = code === HOME ? game.home_team : code === AWAY ? game.away_team : code;
  return encoded.length > 2 ? { name, price, point } : { name, price };
}

function encodeMarket(market, game) {
  if (!market || typeof market !== 'object' || !onlyKeys(market, MARKET_KEYS)
    || typeof market.key !== 'string' || !Array.isArray(market.outcomes)) {
    return { v: withoutLastUpdate(market) };
  }
  return [market.key, market.outcomes.map(o => encodeOutcome(o, game))];
}

function decodeMarket(encoded, game) {
  if (!Array.isArray(encoded)) return encoded.v;
  return { key: encoded[0], outcomes: encoded[1].map(o => decodeOutcome(o, game)) };
}

function encodeBook(book, game) {
  if (!book || typeof book !== 'object' || !onlyKeys(book, BOOK_KEYS)
    || typeof book.key !== 'string' || typeof book.title !== 'string' || !Array.isArray(book.markets)) {
    return { v: withoutLastUpdate(book) };
  }
  return [book.key, book.title === book.key ? 0 : book.title, book.markets.map(m => encodeMarket(m, game))];
}

function decodeBook(encoded, game) {
  if (!Array.isArray(encoded)) return encoded.v;
  const [key, title, markets] = encoded;
  return { key, title: title === 0 ? key : title, markets: markets.map(m => decodeMarket(m, game)) };
}

// game -> [rest, books]; `rest` keeps every non-bookmaker field untouched.
export function encodeGame(game) {
  const { bookmakers, ...rest } = game;
  if (!Array.isArray(bookmakers)) return [game];
  return [rest, bookmakers.map(book => encodeBook(book, game))];
}

export function decodeGame(encoded) {
  const [rest, books] = encoded;
  if (books === undefined) return rest;
  return { ...rest, bookmakers: books.map(book => decodeBook(book, rest)) };
}

export const SNAPSHOT_VERSION = 2;

export function encodeBoard(games) {
  return games.map(encodeGame);
}

export function decodeBoard(encodedGames) {
  return encodedGames.map(decodeGame);
}
