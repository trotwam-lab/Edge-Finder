// api/_discord.js — best-effort Discord edge alerts.
//
// When DISCORD_WEBHOOK_URL is set, the edge scan posts its strongest fresh
// edges to a Discord channel (the Pro community room). This is a retention
// and conversion channel: people keep paying to stay in the room where the
// edges drop in real time. Without the env var this module is a no-op.
//
// Guardrails, all scoped to the warm function instance:
//   - throttle: at most one post per POST_INTERVAL so scans don't spam
//   - dedupe: an edge (game+market+outcome+book) is only announced once
//   - never throws: a Discord hiccup must not break the edge feed

const POST_INTERVAL = 15 * 60 * 1000; // 15 minutes between posts
const MIN_POST_EV = 3.0;              // only announce MEDIUM+ edges
const MAX_EDGES_PER_POST = 5;
const MAX_SEEN_KEYS = 500;

let lastPostTs = 0;
const seenKeys = new Set();

function edgeKey(edge) {
  return `${edge.gameId}|${edge.market}|${edge.outcomeName}|${edge.outcomePoint ?? ''}|${edge.bookKey}`;
}

function rememberKeys(edges) {
  edges.forEach(edge => seenKeys.add(edgeKey(edge)));
  // Cheap bound: reset entirely rather than tracking insertion order — a
  // rare duplicate announcement beats unbounded memory growth.
  if (seenKeys.size > MAX_SEEN_KEYS) seenKeys.clear();
}

export async function postEdgesToDiscord(allEdges = []) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  if (Date.now() - lastPostTs < POST_INTERVAL) return;

  const fresh = allEdges
    .filter(edge => edge.ev >= MIN_POST_EV && !seenKeys.has(edgeKey(edge)))
    .slice(0, MAX_EDGES_PER_POST);
  if (fresh.length === 0) return;

  const lines = fresh.map(edge =>
    `${edge.emoji} **${edge.game}** — ${edge.edge}\n` +
    `└ ${edge.book} · **${edge.evDisplay} EV** · ${edge.confidence} confidence · fair ${edge.fairProbability}%`
  );

  const payload = {
    username: 'EdgeFinder',
    embeds: [{
      title: `🎯 ${fresh.length} fresh edge${fresh.length === 1 ? '' : 's'} on the board`,
      description: lines.join('\n\n'),
      color: 0x6366f1,
      footer: { text: 'EdgeFinder edge scan · prices move fast — verify before betting' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      lastPostTs = Date.now();
      rememberKeys(fresh);
    } else {
      console.warn(`Discord webhook responded ${res.status}`);
    }
  } catch (e) {
    console.warn('Discord webhook post failed:', e.message);
  }
}
