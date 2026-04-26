// ============================================================
//  games/handcricket.js
//  Core game state machine for a single Hand Cricket match.
//  Handles both PvP and PvAI modes.
//  States: SETUP → TOSS → CHOOSING → BATTING → GAME_OVER
// ============================================================

const { HandCricketAI } = require('./ai-handcricket');

const MAX_OVERS_DEFAULT = 5; // 5 overs = 30 balls per innings

// ── Game States ───────────────────────────────────────────────
const STATE = {
  SETUP:      'SETUP',       // Waiting for 2nd player / difficulty pick
  TOSS:       'TOSS',        // Toss in progress
  CHOOSING:   'CHOOSING',    // Winner chose bat/bowl
  INNINGS1:   'INNINGS1',    // First innings
  INNINGS2:   'INNINGS2',    // Second innings
  GAME_OVER:  'GAME_OVER',   // Match complete
};

class HandCricketGame {
  /**
   * @param {string} gameId       Unique game ID (usually channelId)
   * @param {object} player1      { id, username }
   * @param {object} player2      { id, username } or AI object
   * @param {'pvp'|'ai'} mode
   * @param {number} maxOvers
   */
  constructor(gameId, player1, player2, mode = 'pvp', maxOvers = MAX_OVERS_DEFAULT) {
    this.id        = gameId;
    this.mode      = mode;
    this.maxOvers  = maxOvers;
    this.state     = STATE.SETUP;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    // ── Players ────────────────────────────────────────────
    this.player1 = player1;  // always the challenger
    this.player2 = player2;  // opponent or AI placeholder
    this.aiDifficulty = null;

    // ── AI engine (created after difficulty chosen) ─────────
    this.ai = null;

    // ── Toss ───────────────────────────────────────────────
    this.tossWinner    = null;  // player who won toss
    this.tossChooser   = null;  // player who called odd/even
    this.tossCall      = null;  // 'odd' | 'even'
    this.tossTotal     = null;

    // ── Batting assignment ─────────────────────────────────
    // batFirst: 1 → player1 bats first, 2 → player2 bats first
    this.batFirst = null;

    // ── Innings tracking ───────────────────────────────────
    this.innings = 1;
    this.score1  = 0;   // score for player1's batting turn
    this.score2  = 0;   // score for player2's batting turn
    this.target  = null;  // set after 1st innings

    // ── Current ball state ─────────────────────────────────
    this.balls           = 0;    // balls in current innings
    this.currentOverBalls = [];  // ball-by-ball for current over display

    // ── Pending moves (for simultaneous reveal or sequenced) ─
    this.pendingBatter = null;
    this.pendingBowler = null;

    // ── Who is currently waiting ───────────────────────────
    // In PvP: 'batter' | 'bowler' | 'both' | null
    this.waitingFor = null;

    // ── Message IDs for updating embeds ───────────────────
    this.scorecardMessageId = null;
    this.channelId          = gameId; // gameId doubles as channelId

    // ── History for rematch ────────────────────────────────
    this.rematchConfig = null;
  }

  // ──────────────────────────────────────────────────────────
  //  Convenience getters
  // ──────────────────────────────────────────────────────────

  /** Player whose turn it is to bat in current innings */
  getBatter() {
    if (this.innings === 1) {
      return this.batFirst === 1 ? this.player1 : this.player2;
    } else {
      return this.batFirst === 1 ? this.player2 : this.player1;
    }
  }

  /** Player whose turn it is to bowl in current innings */
  getBowler() {
    if (this.innings === 1) {
      return this.batFirst === 1 ? this.player2 : this.player1;
    } else {
      return this.batFirst === 1 ? this.player1 : this.player2;
    }
  }

  /** Score of the current batter */
  getCurrentScore() {
    const batter = this.getBatter();
    return batter.id === this.player1.id ? this.score1 : this.score2;
  }

  /** Add runs to current batter */
  addRuns(runs) {
    const batter = this.getBatter();
    if (batter.id === this.player1.id) this.score1 += runs;
    else this.score2 += runs;
  }

  /** Is the current batter the AI? */
  isBatterAI() {
    return this.mode === 'ai' && this.getBatter().id === this.player2.id;
  }

  /** Is the current bowler the AI? */
  isBowlerAI() {
    return this.mode === 'ai' && this.getBowler().id === this.player2.id;
  }

  /** Is it a human player's turn? */
  isHumanTurn(userId) {
    const batter = this.getBatter();
    const bowler = this.getBowler();
    return userId === batter.id || userId === bowler.id;
  }

  /** Balls remaining in current innings */
  ballsRemaining() {
    return (this.maxOvers * 6) - this.balls;
  }

  // ──────────────────────────────────────────────────────────
  //  Toss
  // ──────────────────────────────────────────────────────────

  /**
   * Resolve toss.
   * @param {string} callerId   user who called odd/even
   * @param {'odd'|'even'} call
   * @returns {{ winner: object, total: number }}
   */
  resolveToss(callerId, call) {
    // Both numbers random
    const n1 = Math.ceil(Math.random() * 6);
    const n2 = Math.ceil(Math.random() * 6);
    const total = n1 + n2;
    const parity = total % 2 === 0 ? 'even' : 'odd';

    const caller = callerId === this.player1.id ? this.player1 : this.player2;
    const other  = callerId === this.player1.id ? this.player2 : this.player1;

    this.tossCall    = call;
    this.tossTotal   = total;
    this.tossWinner  = parity === call ? caller : other;
    this.tossChooser = this.tossWinner; // winner gets to choose
    this.state       = STATE.CHOOSING;

    return { winner: this.tossWinner, total, n1, n2 };
  }

  /**
   * Toss winner picks bat or bowl.
   * @param {string} chooserId
   * @param {'bat'|'bowl'} choice
   */
  assignBatBowl(chooserId, choice) {
    const chooserIsP1 = chooserId === this.player1.id;
    if (choice === 'bat') {
      this.batFirst = chooserIsP1 ? 1 : 2;
    } else {
      this.batFirst = chooserIsP1 ? 2 : 1;
    }
    this.innings   = 1;
    this.state     = STATE.INNINGS1;
    this.waitingFor = 'both';
    this.lastActivity = Date.now();
  }

  // ──────────────────────────────────────────────────────────
  //  Ball resolution
  // ──────────────────────────────────────────────────────────

  /**
   * Register a move from a player.
   * Returns null if waiting for both; returns result when ready.
   * @param {string} userId
   * @param {number} number  1–6
   * @returns {object|null} { runs, isOut, batterNum, bowlerNum } or null
   */
  registerMove(userId, number) {
    this.lastActivity = Date.now();
    const batter = this.getBatter();
    const bowler = this.getBowler();

    if (userId === batter.id) this.pendingBatter = number;
    if (userId === bowler.id) this.pendingBowler = number;

    // Both moves in? Resolve.
    if (this.pendingBatter !== null && this.pendingBowler !== null) {
      return this._resolveBall(this.pendingBatter, this.pendingBowler);
    }
    return null;  // still waiting for the other player
  }

  /**
   * Register AI move automatically (called by game manager).
   */
  registerAIMove(number) {
    if (this.isBatterAI()) this.pendingBatter = number;
    else if (this.isBowlerAI()) this.pendingBowler = number;

    if (this.pendingBatter !== null && this.pendingBowler !== null) {
      return this._resolveBall(this.pendingBatter, this.pendingBowler);
    }
    return null;
  }

  /** Internal: resolve a completed ball */
  _resolveBall(batterNum, bowlerNum) {
    const isOut = batterNum === bowlerNum;
    const runs  = isOut ? 0 : batterNum;

    this.balls++;
    this.pendingBatter = null;
    this.pendingBowler = null;

    // Track current over display
    this.currentOverBalls.push(isOut ? 'W' : runs);
    if (this.currentOverBalls.length > 6) {
      this.currentOverBalls = this.currentOverBalls.slice(-6);
    }
    if (this.balls % 6 === 0) {
      this.currentOverBalls = [];  // new over
    }

    // AI: record player's move for pattern learning
    if (this.mode === 'ai' && this.ai) {
      const playerNum = this.isBatterAI() ? bowlerNum : batterNum;
      this.ai.recordPlayerMove(playerNum);
    }

    if (!isOut) this.addRuns(runs);

    const innings1Done = isOut || this.balls >= this.maxOvers * 6;
    const innings2Won  = this.innings === 2 && !isOut &&
                         this.getCurrentScore() > this.target;

    return {
      batterNum,
      bowlerNum,
      runs,
      isOut,
      inningsOver: innings1Done || innings2Won,
      innings2Won,
    };
  }

  // ──────────────────────────────────────────────────────────
  //  Innings transition
  // ──────────────────────────────────────────────────────────

  /** Call after innings 1 ends. Sets target. */
  endInnings1() {
    this.target = this.getCurrentScore();
    this.innings   = 2;
    this.balls     = 0;
    this.currentOverBalls = [];
    this.state     = STATE.INNINGS2;
    this.waitingFor = 'both';
    this.pendingBatter = null;
    this.pendingBowler = null;
    this.lastActivity = Date.now();
  }

  // ──────────────────────────────────────────────────────────
  //  Match result
  // ──────────────────────────────────────────────────────────

  /**
   * Determine match result.
   * @returns {{ winner: object|null, loser: object|null, margin: number, draw: boolean }}
   */
  getResult() {
    const s1 = this.score1;
    const s2 = this.score2;

    // Who batted which innings?
    const p1BattedFirst = this.batFirst === 1;

    const p1Score = s1;  // player1's batting score
    const p2Score = s2;  // player2's batting score

    if (p1Score === p2Score) {
      return { winner: null, loser: null, margin: 0, draw: true };
    }

    const winner = p1Score > p2Score ? this.player1 : this.player2;
    const loser  = p1Score > p2Score ? this.player2 : this.player1;
    const margin = Math.abs(p1Score - p2Score);

    this.state = STATE.GAME_OVER;

    return { winner, loser, margin, draw: false };
  }

  /** Serialize for rematch config */
  toRematchConfig() {
    return {
      player1:      this.player1,
      player2:      this.player2,
      mode:         this.mode,
      aiDifficulty: this.aiDifficulty,
      maxOvers:     this.maxOvers,
    };
  }
}

module.exports = { HandCricketGame, STATE, MAX_OVERS_DEFAULT };
