// ============================================================
//  games/ai-handcricket.js
//  The AI brain. Three difficulty levels:
//  Easy   → pure random
//  Medium → slight bias toward safe plays + anti-pattern
//  Hard   → tracks player history, predicts & avoids matches
// ============================================================

class HandCricketAI {
  /**
   * @param {'easy'|'medium'|'hard'} difficulty
   */
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.playerMoveHistory = [];   // tracks what the human played
    this.myMoveHistory     = [];   // tracks what AI played
    this.consecutiveSame   = 0;    // how many times player repeated
    this.lastPlayerMove    = null;
  }

  // ── Record what the player just played ─────────────────────
  recordPlayerMove(n) {
    this.playerMoveHistory.push(n);
    if (n === this.lastPlayerMove) this.consecutiveSame++;
    else this.consecutiveSame = 0;
    this.lastPlayerMove = n;
  }

  // ── Get frequency map of player moves ──────────────────────
  _playerFreq() {
    const freq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const m of this.playerMoveHistory) freq[m] = (freq[m] || 0) + 1;
    return freq;
  }

  // ── Most-played number by the player ─────────────────────
  _playerFavourite() {
    const freq = this._playerFreq();
    return parseInt(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  // ── Least-played number by the player ────────────────────
  _playerLeast() {
    const freq = this._playerFreq();
    return parseInt(Object.entries(freq).sort((a, b) => a[1] - b[1])[0][0]);
  }

  // ── Random from 1–6 ──────────────────────────────────────
  _random() {
    return Math.floor(Math.random() * 6) + 1;
  }

  // ── Core decision engine ──────────────────────────────────
  /**
   * Decide AI's next number.
   * @param {'batting'|'bowling'} role  AI's current role
   * @param {number} currentScore       AI's score (if batting)
   * @param {number} target             Target to chase (if batting 2nd innings)
   * @param {number} ballsLeft          Balls remaining
   * @returns {number} 1–6
   */
  decide(role = 'batting', currentScore = 0, target = null, ballsLeft = 30) {
    switch (this.difficulty) {
      case 'easy':   return this._easyDecide();
      case 'medium': return this._mediumDecide(role, currentScore, target, ballsLeft);
      case 'hard':   return this._hardDecide(role, currentScore, target, ballsLeft);
      default:       return this._random();
    }
  }

  // ── EASY: pure random ─────────────────────────────────────
  _easyDecide() {
    return this._random();
  }

  // ── MEDIUM: semi-strategic ────────────────────────────────
  _mediumDecide(role, currentScore, target, ballsLeft) {
    // If AI is batting and needs big runs fast, go aggressive
    if (role === 'batting' && target !== null) {
      const needed = target - currentScore;
      const rr = ballsLeft > 0 ? needed / ballsLeft : 99;
      if (rr > 4) {
        // Need big — bias toward 5, 6
        const aggressive = [4, 5, 6, 6, 5, 6];
        return aggressive[Math.floor(Math.random() * aggressive.length)];
      }
    }

    // Avoid the player's most-used number (anti-pattern when bowling)
    if (role === 'bowling' && this.playerMoveHistory.length > 3) {
      const fav = this._playerFavourite();
      // 50% chance to pick their favourite (to get them out)
      if (Math.random() < 0.5) return fav;
    }

    // Otherwise slightly biased toward 2, 3, 4
    const pool = [1, 2, 2, 3, 3, 4, 4, 5, 6];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── HARD: predictive ─────────────────────────────────────
  _hardDecide(role, currentScore, target, ballsLeft) {
    const histLen = this.playerMoveHistory.length;

    if (histLen < 3) {
      // Not enough data — use medium strategy
      return this._mediumDecide(role, currentScore, target, ballsLeft);
    }

    const freq    = this._playerFreq();
    const fav     = this._playerFavourite();
    const least   = this._playerLeast();
    const last    = this.lastPlayerMove;
    const needed  = target !== null ? target - currentScore : null;
    const rr      = (needed !== null && ballsLeft > 0) ? needed / ballsLeft : null;

    if (role === 'bowling') {
      // ── HARD BOWLING: try to match the batter ──────────────
      // Check if player tends to repeat after a boundary (6)
      const last2 = this.playerMoveHistory.slice(-2);
      if (last2[0] === 6 && last2[1] === 6) {
        // Player loves 6s — match it
        return 6;
      }
      // If player just played their favourite 2x in a row, match it
      if (this.consecutiveSame >= 2) return last;
      // Otherwise pick their overall favourite with 70% probability
      return Math.random() < 0.7 ? fav : this._random();
    }

    if (role === 'batting') {
      // ── HARD BATTING: avoid what bowler (player) tends to bowl
      // Player's most frequent number → AI avoids it
      if (rr !== null && rr > 5) {
        // Desperate — need big numbers — pick anything except player's fav
        const options = [1, 2, 3, 4, 5, 6].filter(n => n !== fav);
        return options[Math.floor(Math.random() * options.length)];
      }
      // Conservative: avoid player's favourite, prefer mid-range
      const safePool = [1, 2, 3, 4, 5, 6]
        .filter(n => n !== fav)
        .sort(() => Math.random() - 0.5);
      // Slightly prefer higher numbers for scoring
      return safePool[0] ?? this._random();
    }

    return this._random();
  }

  // ── Simulate thinking delay ───────────────────────────────
  async thinkDelay() {
    // Easy AI decides instantly; Hard AI "thinks" longer
    const delays = { easy: 800, medium: 1300, hard: 1800 };
    const base   = delays[this.difficulty] || 1300;
    const jitter = Math.floor(Math.random() * 500);
    await new Promise(r => setTimeout(r, base + jitter));
  }

  // ── Taunt messages based on difficulty ───────────────────
  getTaunt(situation) {
    const taunts = {
      easy: {
        OUT:    ['😇 Oh dear... accident, I promise.', '🫢 Did I do that?'],
        SIX:    ['🎉 Got lucky there!', '😅 Didn\'t mean to get 6 lol'],
        WIN:    ['😲 Wait, I won?!', '😴 Won in my sleep.'],
      },
      medium: {
        OUT:    ['😏 Saw that coming.', '🎯 Pattern: DETECTED.'],
        SIX:    ['🔥 Count it.', '😤 Easy runs.'],
        WIN:    ['📊 Data doesn\'t lie.', '🤖 Calculated victory.'],
      },
      hard: {
        OUT:    ['🧠 PREDICTED. You played that exact number 3 balls ago.', '🤖 Your brain is a spreadsheet and I have the formula.'],
        SIX:    ['💀 Did I say you could survive this?', '🔥 Inevitable.'],
        WIN:    ['☠️ I had this from ball one.', '🤖 You never stood a chance. The data was clear.'],
      },
    };

    const diffTaunts = taunts[this.difficulty] || taunts.medium;
    const options    = diffTaunts[situation] || diffTaunts.WIN;
    return options[Math.floor(Math.random() * options.length)];
  }
}

module.exports = { HandCricketAI };
