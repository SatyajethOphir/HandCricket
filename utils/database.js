// ============================================================
//  utils/database.js  — IN-MEMORY ONLY (no SQLite)
//  Stats live in a Map for the duration of the bot session.
//  Simple, zero-dependency, zero setup.
// ============================================================

const store = new Map();

function getPlayer(userId, username) {
  if (!store.has(userId)) {
    store.set(userId, {
      user_id:       userId,
      username:      username || 'Unknown',
      coins:         0,
      matches:       0,
      wins:          0,
      losses:        0,
      total_runs:    0,
      highest_score: 0,
      wickets_taken: 0,
    });
  }
  return store.get(userId);
}

function updateStats(userId, { won, runsScored = 0, wicketsTaken = 0 }) {
  const p = getPlayer(userId);
  p.coins         += won ? 20 : 5;
  p.matches       += 1;
  p.wins          += won ? 1 : 0;
  p.losses        += won ? 0 : 1;
  p.total_runs    += runsScored;
  p.highest_score  = Math.max(p.highest_score, runsScored);
  p.wickets_taken += wicketsTaken;
}

function getLeaderboard(limit = 10) {
  return [...store.values()]
    .sort((a, b) => b.coins - a.coins || b.wins - a.wins)
    .slice(0, limit);
}

function addCoins(userId, amount) {
  const p = store.get(userId);
  if (p) p.coins += amount;
}

module.exports = { getPlayer, updateStats, getLeaderboard, addCoins };
