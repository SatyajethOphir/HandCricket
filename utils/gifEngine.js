// ============================================================
//  utils/gifEngine.js — Situation-aware GIF fetcher
//  Uses Tenor API v2 to fetch contextual cricket GIFs
// ============================================================

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const GIPHY_BASE    = 'https://api.giphy.com/v1/gifs/search';


// ── Situation → search query pools ───────────────────────────
// Multiple queries per situation so it doesn't repeat the same GIF
const GIF_QUERIES = {
  OUT: [
    'cricket wicket celebration',
    'cricket bowled out',
    'cricket dismissed batting',
    'out cricket stumps flying',
    'cricket fielder catch celebration',
  ],
  SIX: [
    'cricket six sixes hit',
    'cricket massive six crowd',
    'cricket six celebration stadium',
    'cricket big hit six runs',
    'cricket six boundary crowd cheering',
  ],
  FOUR: [
    'cricket four boundary',
    'cricket four runs boundary rope',
    'cricket four shot boundary',
  ],
  WIN: [
    'cricket team winning celebration',
    'cricket champions trophy celebration',
    'cricket victory lap celebration',
    'cricket match win team jump',
    'cricket winning moment team',
  ],
  CLOSE_WIN: [
    'cricket last ball win',
    'cricket close finish celebration',
    'cricket thriller win last over',
    'cricket nail biting finish',
  ],
  DRAW: [
    'cricket tie match handshake',
    'cricket draw both teams',
    'shrug its a tie',
  ],
  TOSS_WIN: [
    'coin flip win excited',
    'toss cricket win',
    'lucky coin flip celebration',
  ],
  INNINGS_START: [
    'cricket match start',
    'cricket opening batsman walking',
    'cricket innings begins',
  ],
  INNINGS_SWITCH: [
    'cricket innings change sides',
    'cricket teams switching ends',
    'cricket second innings begins',
  ],
  CHASE_START: [
    'cricket chase target begins',
    'cricket second innings batting',
    'cricket chasing target batting',
  ],
  MILESTONE_50: [
    'cricket fifty runs milestone',
    'cricket half century celebration',
    'cricket 50 runs batsman celebration',
  ],
  MILESTONE_100: [
    'cricket century celebration batsman',
    'cricket 100 runs milestone',
    'cricket ton hundred runs',
  ],
  LAST_OVER: [
    'cricket last over tension',
    'cricket final over pressure',
    'cricket nail biting last over',
  ],
  NEED_6_ON_LAST: [
    'cricket last ball six needed',
    'cricket 6 off last ball thriller',
    'cricket last ball six drama',
  ],
  THRASHING: [
    'cricket big win massive victory',
    'cricket dominant performance win',
    'cricket thrash opponent big margin',
  ],
  COLLAPSE: [
    'cricket batting collapse wickets falling',
    'cricket multiple wickets top order collapse',
    'cricket all out batting collapse',
  ],
  BOT_WIN: [
    'robot wins trophy',
    'robot celebrating victory dance',
    'ai robot wins game celebration',
  ],
  LOBBY_FULL: [
    'cricket team assembled ready',
    'cricket squad team ready to play',
  ],
  TIMEOUT: [
    'cricket match abandoned timeout',
    'waiting forever timeout',
    'nobody showed up cricket',
  ],
};

// ── Cache: avoid refetching identical queries ─────────────────
const gifCache = new Map();   // query → [url, url, ...]
const usedGifs = new Map();   // situation → Set of used indices

/**
 * Fetch GIFs for a query from Tenor, with caching.
 */
// Replace _fetchGifs function
async function _fetchGifs(query, limit = 8) {
  if (gifCache.has(query)) return gifCache.get(query);

  if (!GIPHY_API_KEY) {
    console.warn('[gifEngine] GIPHY_API_KEY not set — skipping GIF fetch');
    return [];
  }

  try {
    const url = `${GIPHY_BASE}?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=${limit}&rating=pg`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);
    const data = await res.json();

    // Giphy returns data.data[] with images.original.url
    const urls = (data.data || [])
      .map(g => g.images?.original?.url)
      .filter(Boolean);

    gifCache.set(query, urls);
    setTimeout(() => gifCache.delete(query), 30 * 60 * 1000);
    return urls;
  } catch (err) {
    console.error('[gifEngine] Giphy fetch error:', err.message);
    return [];
  }
}

/**
 * Pick a random GIF URL for a situation.
 * Rotates through queries so results stay fresh.
 *
 * @param {string} situation  - Key from GIF_QUERIES
 * @param {object} [context]  - Optional game context for smarter selection
 * @returns {Promise<string|null>}
 */
async function getSmartGif(situation, context = {}) {
  const queries = GIF_QUERIES[situation];
  if (!queries?.length) return null;

  // Pick query — rotate using usedGifs tracker
  if (!usedGifs.has(situation)) usedGifs.set(situation, new Set());
  const used = usedGifs.get(situation);

  // Find a query we haven't used recently
  let availableQueries = queries.filter((_, i) => !used.has(i));
  if (!availableQueries.length) {
    used.clear();
    availableQueries = queries;
  }

  const queryIndex = queries.indexOf(
    availableQueries[Math.floor(Math.random() * availableQueries.length)]
  );
  used.add(queryIndex);

  const query = queries[queryIndex];
  const gifs  = await _fetchGifs(query);
  if (!gifs.length) return null;

  return gifs[Math.floor(Math.random() * gifs.length)];
}

/**
 * Determine the best GIF situation from game context.
 *
 * @param {string} event      - 'OUT' | 'SIX' | 'FOUR' | 'WIN' | 'INNINGS_END' etc.
 * @param {object} ctx        - Game context
 */
function resolveSituation(event, ctx = {}) {
  switch (event) {

    case 'OUT': {
      // Multiple wickets in a row → collapse
      if (ctx.recentWickets >= 3) return 'COLLAPSE';
      return 'OUT';
    }

    case 'SIX':  return 'SIX';
    case 'FOUR': return 'FOUR';

    case 'WIN': {
      if (ctx.winnerIsBot)           return 'BOT_WIN';
      if (ctx.margin <= 2)           return 'CLOSE_WIN';
      if (ctx.margin >= 30)          return 'THRASHING';
      return 'WIN';
    }

    case 'DRAW':  return 'DRAW';

    case 'INNINGS_END': {
      if (ctx.innings === 1)         return 'INNINGS_SWITCH';
      return 'CHASE_START';
    }

    case 'TOSS':          return 'TOSS_WIN';
    case 'LOBBY_FULL':    return 'LOBBY_FULL';
    case 'TIMEOUT':       return 'TIMEOUT';

    case 'MILESTONE': {
      if (ctx.score >= 100)          return 'MILESTONE_100';
      if (ctx.score >= 50)           return 'MILESTONE_50';
      return null;
    }

    case 'PRESSURE': {
      if (ctx.needRunsOnLastBall)    return 'NEED_6_ON_LAST';
      if (ctx.isLastOver)            return 'LAST_OVER';
      return null;
    }

    default: return null;
  }
}

/**
 * All-in-one: resolve situation from event+context, then fetch GIF.
 *
 * @param {string} event
 * @param {object} ctx
 * @returns {Promise<string|null>}
 */
async function getGifForEvent(event, ctx = {}) {
  const situation = resolveSituation(event, ctx);
  if (!situation) return null;
  return getSmartGif(situation, ctx);
}

module.exports = { getGifForEvent, getSmartGif, resolveSituation, GIF_QUERIES };