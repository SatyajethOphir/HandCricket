// ============================================================
//  sessions/gameManager.js  — XO-ARENA HAND CRICKET
//  Supports: PvP 1v1, AI, Multiplayer (2–20 players / 2 teams)
//  New: match cancel, team-name editing, host controls, bot fill
// ============================================================

const { HandCricketGame, STATE } = require("../games/handcricket");
const { HandCricketAI } = require("../games/ai-handcricket");
const { updateStats, getPlayer } = require("../utils/database");
const {
  buildNumberButtons,
  buildTossButtons,
  buildBatBowlButtons,
  buildPostGameButtons,
  buildDifficultyMenu,
  buildMatchStartEmbed,
  buildTossEmbed,
  buildScorecardEmbed,
  buildBallResultEmbed,
  buildInningsEndEmbed,
  buildResultEmbed,
} = require("../utils/ui");
const {
  getSledge,
  getCrowdReaction,
  getMilestoneComment,
} = require("../utils/flavor");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

// ── Active sessions ───────────────────────────────────────────
const sessions = new Map(); // channelId → HandCricketGame (1v1 / AI)
const multiSessions = new Map(); // channelId → MultiMatch
const rematchConfigs = new Map();
const timeouts = new Map();
const TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "300000");

// ── Per-channel wicket streak tracker (for collapse detection) ─
const recentWickets = new Map(); // channelId → count

function _recordWicket(channelId) {
  recentWickets.set(channelId, (recentWickets.get(channelId) || 0) + 1);
}
function _resetWickets(channelId) {
  recentWickets.set(channelId, 0);
}
function _getRecentWickets(channelId) {
  return recentWickets.get(channelId) || 0;
}

// ── Safe reply helper ─────────────────────────────────────────
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(options);
    }
    return await interaction.reply(options);
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
//  BOT NAMES — used when filling empty slots
// ════════════════════════════════════════════════════════════
const BOT_NAMES = [
  "CricBot Alpha",
  "CricBot Beta",
  "CricBot Gamma",
  "CricBot Delta",
  "CricBot Sigma",
  "CricBot Omega",
  "CricBot Prime",
  "CricBot Ace",
  "CricBot Blaze",
  "CricBot Storm",
];

function makeBotPlayer(index) {
  return {
    id: `BOT_${index}`,
    username: BOT_NAMES[index % BOT_NAMES.length],
    isBot: true,
    ai: new HandCricketAI("medium"),
  };
}

// ════════════════════════════════════════════════════════════
//  MULTI-MATCH SESSION
// ════════════════════════════════════════════════════════════
class MultiMatch {
  constructor(channelId, host, teamSize, maxOvers) {
    this.channelId = channelId;
    this.host = host;
    this.teamSize = teamSize;
    this.maxOvers = maxOvers || 5;
    this.teamA = { name: "Team A", players: [host] };
    this.teamB = { name: "Team B", players: [] };
    this.state = "LOBBY";
    this.joinedIds = new Set([host.id]);

    this.innings = 1;
    this.scoreA = 0;
    this.scoreB = 0;
    this.ballsA = 0;
    this.ballsB = 0;
    this.wicketsA = 0;
    this.wicketsB = 0;
    this.target = null;
    this.battingTeam = null;
    this.tossWinner = null;
    this.batterIndex = 0;
    this.pendingBatter = null;
    this.pendingBowler = null;
    this.bowlerIndex = 0;
    this.lobbyMessageId = null;
    this.scorecardMsgId = null;
  }

  get maxBalls() {
    return this.maxOvers * 6;
  }
  get totalSlots() {
    return this.teamSize * 2;
  }
  get allPlayers() {
    return [...this.teamA.players, ...this.teamB.players];
  }

  isFull() {
    return (
      this.teamA.players.length >= this.teamSize &&
      this.teamB.players.length >= this.teamSize
    );
  }

  canStart() {
    return this.teamA.players.length >= 1 && this.teamB.players.length >= 1;
  }

  addPlayer(player) {
    if (this.joinedIds.has(player.id)) return "already";
    if (this.isFull()) return "full";
    if (this.teamA.players.length < this.teamSize) {
      this.teamA.players.push(player);
    } else {
      this.teamB.players.push(player);
    }
    this.joinedIds.add(player.id);
    return this.isFull() ? "full_now" : "ok";
  }

  fillWithBots() {
    let botIdx = 0;
    while (this.teamA.players.length < this.teamSize) {
      const bot = makeBotPlayer(botIdx++);
      this.teamA.players.push(bot);
      this.joinedIds.add(bot.id);
    }
    while (this.teamB.players.length < this.teamSize) {
      const bot = makeBotPlayer(botIdx++);
      this.teamB.players.push(bot);
      this.joinedIds.add(bot.id);
    }
  }

  getCurrentBatter() {
    const team = this.battingTeam === "A" ? this.teamA : this.teamB;
    return team.players[this.batterIndex % team.players.length];
  }

  getCurrentBowler() {
    const team = this.battingTeam === "A" ? this.teamB : this.teamA;
    return team.players[this.bowlerIndex % team.players.length];
  }

  getCurrentScore() {
    return this.battingTeam === "A" ? this.scoreA : this.scoreB;
  }

  getCurrentBalls() {
    return this.battingTeam === "A" ? this.ballsA : this.ballsB;
  }

  getCurrentWickets() {
    return this.battingTeam === "A" ? this.wicketsA : this.wicketsB;
  }

  isPlayerTurn(userId) {
    const batter = this.getCurrentBatter();
    const bowler = this.getCurrentBowler();
    return userId === batter.id || userId === bowler.id;
  }

  isActivePlayer(userId) {
    return this.joinedIds.has(userId);
  }

  registerMove(userId, number) {
    const batter = this.getCurrentBatter();
    const bowler = this.getCurrentBowler();

    if (userId === batter.id) {
      if (this.pendingBatter !== null) return "already";
      this.pendingBatter = number;
    } else if (userId === bowler.id) {
      if (this.pendingBowler !== null) return "already";
      this.pendingBowler = number;
    } else {
      return "not_your_turn";
    }

    if (batter.isBot && this.pendingBatter === null) {
      this.pendingBatter = batter.ai.decide(
        "batting",
        this.getCurrentScore(),
        this.target,
        this.maxBalls - this.getCurrentBalls(),
      );
    }
    if (bowler.isBot && this.pendingBowler === null) {
      this.pendingBowler = bowler.ai.decide(
        "bowling",
        this.getCurrentScore(),
        this.target,
        this.maxBalls - this.getCurrentBalls(),
      );
    }

    if (this.pendingBatter === null || this.pendingBowler === null)
      return "waiting";

    const bn = this.pendingBatter;
    const bwn = this.pendingBowler;
    this.pendingBatter = null;
    this.pendingBowler = null;

    const isOut = bn === bwn;
    let runs = 0;

    if (!isOut) {
      runs = bn;
      if (this.battingTeam === "A") this.scoreA += runs;
      else this.scoreB += runs;
    }

    if (this.battingTeam === "A") {
      this.ballsA++;
      if (isOut) {
        this.wicketsA++;
        this.batterIndex++;
      }
    } else {
      this.ballsB++;
      if (isOut) {
        this.wicketsB++;
        this.batterIndex++;
      }
    }

    const balls = this.getCurrentBalls();
    const wickets = this.getCurrentWickets();
    const maxW =
      (this.battingTeam === "A" ? this.teamA : this.teamB).players.length - 1;
    const inningsOver = balls >= this.maxBalls || wickets >= maxW;

    let innings2Won = false;
    if (this.innings === 2 && this.target !== null) {
      innings2Won = this.getCurrentScore() >= this.target;
    }

    return {
      bn,
      bwn,
      runs,
      isOut,
      inningsOver: inningsOver || innings2Won,
      innings2Won,
    };
  }

  endInnings() {
    this.innings = 2;
    this.target = (this.battingTeam === "A" ? this.scoreA : this.scoreB) + 1;
    this.battingTeam = this.battingTeam === "A" ? "B" : "A";
    this.batterIndex = 0;
    this.bowlerIndex = 0;
    this.pendingBatter = null;
    this.pendingBowler = null;
    this.state = "INNINGS2";
  }

  getResult() {
    const scoreA = this.scoreA;
    const scoreB = this.scoreB;
    if (scoreA > scoreB)
      return {
        winner: this.teamA,
        loser: this.teamB,
        scoreA,
        scoreB,
        margin: scoreA - scoreB,
      };
    if (scoreB > scoreA)
      return {
        winner: this.teamB,
        loser: this.teamA,
        scoreA,
        scoreB,
        margin: scoreB - scoreA,
      };
    return { draw: true, scoreA, scoreB };
  }
}

// ════════════════════════════════════════════════════════════
//  EMBED / UI BUILDERS FOR MULTIPLAYER
// ════════════════════════════════════════════════════════════

function buildLobbyEmbed(m) {
  const aList =
    m.teamA.players
      .map((p, i) => `${i + 1}. ${p.isBot ? "🤖" : "👤"} ${p.username}`)
      .join("\n") || "*Empty*";
  const bList =
    m.teamB.players
      .map((p, i) => `${i + 1}. ${p.isBot ? "🤖" : "👤"} ${p.username}`)
      .join("\n") || "*Empty*";

  return new EmbedBuilder()
    .setColor(0x1a73e8)
    .setTitle("🏏 Hand Cricket — Multiplayer Lobby")
    .setDescription(
      `**Hosted by:** ${m.host.username}\n` +
        `**Team size:** ${m.teamSize} per team  |  **Overs:** ${m.maxOvers}\n` +
        `**Players:** ${m.allPlayers.length} / ${m.totalSlots}\n\n` +
        `> Use the buttons below to join, fill with bots, or start!`,
    )
    .addFields(
      {
        name: `🔵 ${m.teamA.name} (${m.teamA.players.length}/${m.teamSize})`,
        value: aList,
        inline: true,
      },
      {
        name: `🔴 ${m.teamB.name} (${m.teamB.players.length}/${m.teamSize})`,
        value: bList,
        inline: true,
      },
    )
    .setFooter({
      text: "XO-Arena 🎮 • Host only: Start / Fill Bots / Cancel / Edit Names",
    })
    .setTimestamp();
}

function buildLobbyButtons(channelId, isHost) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hcm_join_${channelId}`)
      .setLabel("Join Game")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🏏"),
    new ButtonBuilder()
      .setCustomId(`hcm_start_${channelId}`)
      .setLabel("Start Match")
      .setStyle(ButtonStyle.Success)
      .setEmoji("▶️")
      .setDisabled(!isHost),
    new ButtonBuilder()
      .setCustomId(`hcm_fillbots_${channelId}`)
      .setLabel("Fill with Bots")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🤖")
      .setDisabled(!isHost),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hcm_editnames_${channelId}`)
      .setLabel("Edit Team Names")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("✏️")
      .setDisabled(!isHost),
    new ButtonBuilder()
      .setCustomId(`hcm_cancel_${channelId}`)
      .setLabel("Cancel Match")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
  );
  return [row1, row2];
}

function buildMultiScorecardEmbed(m) {
  const batter = m.getCurrentBatter();
  const bowler = m.getCurrentBowler();
  const battingTeamName = m.battingTeam === "A" ? m.teamA.name : m.teamB.name;
  const score = m.getCurrentScore();
  const balls = m.getCurrentBalls();
  const wickets = m.getCurrentWickets();
  const overs = `${Math.floor(balls / 6)}.${balls % 6}`;

  let desc =
    `**Innings ${m.innings}** — ${battingTeamName} batting\n\n` +
    `🏏 **Batter:** ${batter.isBot ? "🤖" : ""}${batter.username}\n` +
    `🎳 **Bowler:** ${bowler.isBot ? "🤖" : ""}${bowler.username}\n\n` +
    `📊 **Score:** ${score}/${wickets}  (${overs} ov / ${m.maxOvers} ov)`;

  if (m.innings === 2 && m.target) {
    const need = m.target - score;
    const rem = m.maxBalls - balls;
    desc += `\n🎯 **Target:** ${m.target}  |  Need **${need}** in **${rem}** balls`;
  }

  return new EmbedBuilder()
    .setColor(m.innings === 1 ? 0x1a73e8 : 0xff6b00)
    .setTitle(`🏏 ${m.teamA.name} vs ${m.teamB.name}`)
    .setDescription(desc)
    .addFields(
      {
        name: `🔵 ${m.teamA.name}`,
        value: `**${m.scoreA}**/${m.wicketsA}`,
        inline: true,
      },
      {
        name: `🔴 ${m.teamB.name}`,
        value: `**${m.scoreB}**/${m.wicketsB}`,
        inline: true,
      },
    )
    .setFooter({
      text: `${batter.username} pick a number • ${bowler.username} bowl!`,
    })
    .setTimestamp();
}

function buildMultiResultEmbed(m) {
  const r = m.getResult();
  let desc;
  if (r.draw) {
    desc = `⚖️ **It's a TIE!**\nBoth teams scored **${r.scoreA}** runs!`;
  } else {
    desc =
      `🏆 **${r.winner.name} WIN** by **${r.margin} runs**!\n\n` +
      `🔵 ${m.teamA.name}: **${r.scoreA}**\n🔴 ${m.teamB.name}: **${r.scoreB}**`;
  }
  return new EmbedBuilder()
    .setColor(r.draw ? 0xaaaaaa : 0xf5a623)
    .setTitle("🏏 Match Over!")
    .setDescription(desc)
    .setFooter({ text: "XO-Arena 🎮 Hand Cricket" })
    .setTimestamp();
}

function buildMultiNumberButtons(channelId) {
  const nums = [1, 2, 3, 4, 5, 6];
  const row = new ActionRowBuilder().addComponents(
    ...nums.map((n) =>
      new ButtonBuilder()
        .setCustomId(`hcm_move_${channelId}_${n}`)
        .setLabel(`${n}`)
        .setStyle(ButtonStyle.Primary),
    ),
  );
  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hcm_cancel_${channelId}`)
      .setLabel("Cancel Match")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
  );
  return [row, cancelRow];
}

function buildMultiTossButtons(channelId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hcm_toss_${channelId}_odd`)
        .setLabel("Odd")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔢"),
      new ButtonBuilder()
        .setCustomId(`hcm_toss_${channelId}_even`)
        .setLabel("Even")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔢"),
    ),
  ];
}

function buildMultiBatBowlButtons(channelId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hcm_choice_${channelId}_bat`)
        .setLabel("Bat First")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🏏"),
      new ButtonBuilder()
        .setCustomId(`hcm_choice_${channelId}_bowl`)
        .setLabel("Bowl First")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎳"),
    ),
  ];
}

// ════════════════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════════════════

async function startGame(interaction, opponent, mode) {
  const channelId = interaction.channelId;

  if (sessions.has(channelId) || multiSessions.has(channelId)) {
    return interaction.reply({
      content:
        "⚠️ A game is already in progress here! Cancel it first or wait for timeout.",
      ephemeral: true,
    });
  }

  const player1 = {
    id: interaction.user.id,
    username: interaction.user.displayName || interaction.user.username,
  };
  let player2;

  if (mode === "ai") {
    player2 = { id: "AI_BOT", username: "🤖 CricketBot" };
  } else {
    player2 = {
      id: opponent.id,
      username: opponent.displayName || opponent.username,
    };
  }

  getPlayer(player1.id, player1.username);
  if (mode !== "ai") getPlayer(player2.id, player2.username);

  const overs = interaction.options?.getInteger?.("overs") || 5;
  const game = new HandCricketGame(channelId, player1, player2, mode, overs);
  sessions.set(channelId, game);
  _resetTimeout(channelId, interaction.channel);

  if (mode === "ai") {
    await interaction.reply({
      embeds: [buildMatchStartEmbed(game)],
      components: buildDifficultyMenu(channelId),
    });
  } else {
    await interaction.reply({
      content: `<@${player2.id}> — You've been challenged to Hand Cricket! 🏏`,
      embeds: [buildMatchStartEmbed(game)],
      components: buildTossButtons(channelId),
    });
    game.state = STATE.TOSS;
  }
}

async function startMultiGame(interaction, teamSize, maxOvers) {
  const channelId = interaction.channelId;

  if (sessions.has(channelId) || multiSessions.has(channelId)) {
    return interaction.reply({
      content: "⚠️ A game is already running here!",
      ephemeral: true,
    });
  }

  const host = {
    id: interaction.user.id,
    username: interaction.user.displayName || interaction.user.username,
  };
  const m = new MultiMatch(channelId, host, teamSize, maxOvers);
  multiSessions.set(channelId, m);
  _resetTimeout(channelId, interaction.channel);

  await interaction.reply({
    embeds: [buildLobbyEmbed(m)],
    components: buildLobbyButtons(channelId, true),
  });
  const reply = await interaction.fetchReply();
  m.lobbyMessageId = reply.id;
}

// ────────────────────────────────────────────────────────────
//  Unified interaction router
// ────────────────────────────────────────────────────────────
async function handleInteraction(interaction) {
  const customId = interaction.customId;
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  if (interaction.isModalSubmit && interaction.isModalSubmit()) {
    if (customId.startsWith("hcm_editnames_modal_")) {
      return _handleEditNamesModal(interaction, channelId);
    }
    return;
  }

  if (customId.startsWith("hcm_")) {
    const parts = customId.split("_");
    const action = parts[1];
    const cid = parts[2];
    const value = parts[3];

    if (cid !== channelId) {
      return interaction.reply({
        content: "⚠️ This button belongs to a different channel.",
        ephemeral: true,
      });
    }
    return _handleMultiInteraction(
      interaction,
      action,
      channelId,
      userId,
      value,
    );
  }

  if (!customId.startsWith("hc_")) return;

  const parts = customId.split("_");
  const action = parts[1];
  const gameId = parts[2];
  const value = parts[3];

  if (gameId !== channelId) {
    return interaction.reply({
      content: "⚠️ This button is for a different channel's game.",
      ephemeral: true,
    });
  }

  const game = sessions.get(channelId);

  if (action === "rematch")
    return _handleRematch(interaction, channelId, userId);
  if (action === "quit") {
    await interaction.update({ components: [] });
    return interaction.followUp({
      content: "👋 Game closed. Use `/handcricket` to play again!",
    });
  }
  if (action === "cancel")
    return _handleCancel1v1(interaction, channelId, userId);

  if (!game) {
    return interaction.reply({
      content: "⚠️ No active game here. Start one with `/handcricket`!",
      ephemeral: true,
    });
  }

  _resetTimeout(channelId, interaction.channel);

  switch (action) {
    case "difficulty": {
      const difficulty = interaction.isStringSelectMenu()
        ? interaction.values[0]
        : value;
      return _handleDifficulty(interaction, game, difficulty);
    }
    case "toss":
      return _handleToss(interaction, game, value);
    case "choice":
      return _handleBatBowlChoice(interaction, game, value);
    case "move":
      return _handleMove(interaction, game, parseInt(value));
    default:
      return interaction.reply({
        content: "⚠️ Unknown action.",
        ephemeral: true,
      });
  }
}

// ════════════════════════════════════════════════════════════
//  MULTIPLAYER INTERACTION HANDLERS
// ════════════════════════════════════════════════════════════

async function _handleMultiInteraction(
  interaction,
  action,
  channelId,
  userId,
  value,
) {
  const m = multiSessions.get(channelId);

  if (action === "cancel") {
    return _handleMultiCancel(interaction, m, channelId, userId);
  }

  if (!m) {
    return interaction.reply({
      content: "⚠️ No multiplayer lobby here!",
      ephemeral: true,
    });
  }

  _resetTimeout(channelId, interaction.channel);

  switch (action) {
    case "join":
      return _handleMultiJoin(interaction, m, userId);
    case "start":
      return _handleMultiStart(interaction, m, userId, channelId);
    case "fillbots":
      return _handleMultiFillBots(interaction, m, userId, channelId);
    case "editnames":
      return _handleEditNamesPrompt(interaction, m, userId, channelId);
    case "toss":
      return _handleMultiToss(interaction, m, userId, value);
    case "choice":
      return _handleMultiChoice(interaction, m, userId, value, channelId);
    case "move":
      return _handleMultiMove(interaction, m, userId, parseInt(value));
    default:
      return interaction.reply({
        content: "⚠️ Unknown multiplayer action.",
        ephemeral: true,
      });
  }
}

// ── Join lobby ────────────────────────────────────────────────
async function _handleMultiJoin(interaction, m, userId) {
  if (m.state !== "LOBBY") {
    return interaction.reply({
      content: "⚠️ The match has already started!",
      ephemeral: true,
    });
  }

  const player = {
    id: userId,
    username: interaction.user.displayName || interaction.user.username,
  };
  const result = m.addPlayer(player);

  if (result === "already") {
    return interaction.reply({
      content: "✅ You're already in the lobby!",
      ephemeral: true,
    });
  }
  if (result === "full") {
    return interaction.reply({
      content: "⚠️ The lobby is full!",
      ephemeral: true,
    });
  }

  getPlayer(userId, player.username);

  await interaction.update({
    embeds: [buildLobbyEmbed(m)],
    components: buildLobbyButtons(m.channelId, userId === m.host.id),
  });
}

// ── Fill bots ─────────────────────────────────────────────────
async function _handleMultiFillBots(interaction, m, userId, channelId) {
  if (userId !== m.host.id) {
    return interaction.reply({
      content: "⚠️ Only the host can fill with bots!",
      ephemeral: true,
    });
  }
  if (m.state !== "LOBBY") {
    return interaction.reply({
      content: "⚠️ Match already started!",
      ephemeral: true,
    });
  }

  m.fillWithBots();

  await interaction.update({
    embeds: [buildLobbyEmbed(m)],
    components: buildLobbyButtons(channelId, true),
  });
}

// ── Edit team names — show modal ──────────────────────────────
async function _handleEditNamesPrompt(interaction, m, userId, channelId) {
  if (userId !== m.host.id) {
    return interaction.reply({
      content: "⚠️ Only the host can edit team names!",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`hcm_editnames_modal_${channelId}`)
    .setTitle("Edit Team Names");

  const nameA = new TextInputBuilder()
    .setCustomId("teamA_name")
    .setLabel("Team A Name")
    .setStyle(TextInputStyle.Short)
    .setValue(m.teamA.name)
    .setMaxLength(24)
    .setRequired(true);

  const nameB = new TextInputBuilder()
    .setCustomId("teamB_name")
    .setLabel("Team B Name")
    .setStyle(TextInputStyle.Short)
    .setValue(m.teamB.name)
    .setMaxLength(24)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameA),
    new ActionRowBuilder().addComponents(nameB),
  );

  await interaction.showModal(modal);
}

// ── Edit team names — modal submit ────────────────────────────
async function _handleEditNamesModal(interaction, channelId) {
  const m = multiSessions.get(channelId);
  if (!m)
    return interaction.reply({
      content: "⚠️ No active lobby!",
      ephemeral: true,
    });
  if (interaction.user.id !== m.host.id) {
    return interaction.reply({
      content: "⚠️ Only the host can do this!",
      ephemeral: true,
    });
  }

  const newA =
    interaction.fields.getTextInputValue("teamA_name").trim() || "Team A";
  const newB =
    interaction.fields.getTextInputValue("teamB_name").trim() || "Team B";
  m.teamA.name = newA;
  m.teamB.name = newB;

  await interaction.reply({
    content: `✅ Team names updated! **${newA}** vs **${newB}**`,
    ephemeral: true,
  });

  const channel = interaction.channel;
  try {
    const msg = await channel.messages.fetch(m.lobbyMessageId);
    await msg.edit({
      embeds: [buildLobbyEmbed(m)],
      components: buildLobbyButtons(channelId, true),
    });
  } catch (_) {}
}

// ── Start match ───────────────────────────────────────────────
async function _handleMultiStart(interaction, m, userId, channelId) {
  if (userId !== m.host.id) {
    return interaction.reply({
      content: "⚠️ Only the host can start the match!",
      ephemeral: true,
    });
  }
  if (m.state !== "LOBBY") {
    return interaction.reply({
      content: "⚠️ Match already started!",
      ephemeral: true,
    });
  }
  if (!m.canStart()) {
    return interaction.reply({
      content: "⚠️ Need at least 1 player per team to start!",
      ephemeral: true,
    });
  }

  m.state = "TOSS";

  await interaction.update({
    content: `🏏 **${m.teamA.name}** vs **${m.teamB.name}** — The toss! **${m.host.username}** calls it:`,
    embeds: [buildLobbyEmbed(m)],
    components: buildMultiTossButtons(channelId),
  });
}

// ── Toss ──────────────────────────────────────────────────────
async function _handleMultiToss(interaction, m, userId, call) {
  if (userId !== m.host.id) {
    return interaction.reply({
      content: "⚠️ Only the host calls the toss!",
      ephemeral: true,
    });
  }
  if (m.state !== "TOSS") {
    return interaction.reply({
      content: "⚠️ Toss already done!",
      ephemeral: true,
    });
  }

  const total =
    Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;
  const isOdd = total % 2 !== 0;
  const hostWon = (call === "odd" && isOdd) || (call === "even" && !isOdd);

  m.tossWinner = hostWon ? "A" : "B";
  const winnerName = hostWon ? m.teamA.name : m.teamB.name;

  await interaction.update({
    content: `🪙 Toss result: **${total}** (${isOdd ? "Odd" : "Even"}) — **${winnerName}** wins the toss!`,
    embeds: [],
    components: buildMultiBatBowlButtons(m.channelId),
  });
}

// ── Bat/Bowl choice ───────────────────────────────────────────
async function _handleMultiChoice(interaction, m, userId, choice, channelId) {
  const winnerTeam = m.tossWinner === "A" ? m.teamA : m.teamB;
  if (!winnerTeam.players.some((p) => p.id === userId)) {
    return interaction.reply({
      content: `⚠️ Only a player from **${winnerTeam.name}** (toss winner) can choose!`,
      ephemeral: true,
    });
  }
  if (m.state !== "TOSS") {
    return interaction.reply({
      content: "⚠️ Choice already made!",
      ephemeral: true,
    });
  }

  m.battingTeam =
    choice === "bat" ? m.tossWinner : m.tossWinner === "A" ? "B" : "A";
  m.state = "INNINGS1";
  _resetWickets(channelId);

  const battingName = m.battingTeam === "A" ? m.teamA.name : m.teamB.name;

  const scoreEmbed = buildMultiScorecardEmbed(m);
  const msg = await interaction.update({
    content: `🏏 **${battingName}** will bat first!`,
    embeds: [scoreEmbed],
    components: buildMultiNumberButtons(channelId),
    fetchReply: true,
  });
  m.scorecardMsgId = msg?.id;

  await _triggerMultiBots(interaction, m);
}

// ── Number move ───────────────────────────────────────────────
async function _handleMultiMove(interaction, m, userId, number) {
  if (!["INNINGS1", "INNINGS2"].includes(m.state)) {
    return safeReply(interaction, {
      content: "⚠️ Game not in play!",
      ephemeral: true,
    });
  }

  const batter = m.getCurrentBatter();
  const bowler = m.getCurrentBowler();

  if (userId !== batter.id && userId !== bowler.id) {
    return safeReply(interaction, {
      content: "⚠️ It's not your turn right now! You're spectating this ball.",
      ephemeral: true,
    });
  }
  if (userId === batter.id && m.pendingBatter !== null) {
    return safeReply(interaction, {
      content: "⚠️ Already locked in! Waiting for the bowler...",
      ephemeral: true,
    });
  }
  if (userId === bowler.id && m.pendingBowler !== null) {
    return safeReply(interaction, {
      content: "⚠️ Already bowled! Waiting for the batter...",
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  const result = m.registerMove(userId, number);

  if (result === "already") {
    return interaction.followUp({
      content: "⚠️ Already submitted!",
      ephemeral: true,
    });
  }
  if (result === "waiting") {
    const who = userId === batter.id ? bowler.username : batter.username;
    return interaction.followUp({
      content: `✅ Move locked! Waiting for **${who}**...`,
      ephemeral: true,
    });
  }

  await _resolveMultiBall(interaction, m, result);
}

// ── Resolve ball ──────────────────────────────────────────────
async function _resolveMultiBall(interaction, m, result) {
  const { bn, bwn, runs, isOut, inningsOver, innings2Won } = result;
  const channel = interaction.channel;
  const batter = m.getCurrentBatter();
  const bowler = m.getCurrentBowler();

  if (isOut) {
    _recordWicket(m.channelId);
  } else {
    _resetWickets(m.channelId);
  }

  let flavor = "";
  if (isOut) flavor = "💥 **OUT!** " + getSledge("OUT");
  else if (runs === 6) flavor = "🚀 **SIX!** " + getSledge("SIX");
  else if (Math.random() < 0.25) flavor = getCrowdReaction();

  const ballEmbed = new EmbedBuilder()
    .setColor(isOut ? 0xff0000 : runs === 6 ? 0xffd700 : 0x00cc44)
    .setTitle(isOut ? "💀 WICKET!" : `${runs} Run${runs !== 1 ? "s" : ""}!`)
    .setDescription(
      `🏏 **${batter.username}** played **${bn}**\n` +
        `🎳 **${bowler.username}** bowled **${bwn}**\n\n` +
        (isOut
          ? "❌ **SAME NUMBER — OUT!**"
          : `✅ **${runs} run${runs !== 1 ? "s" : ""} scored!**`) +
        (flavor ? `\n\n${flavor}` : ""),
    )
    .setTimestamp();

  try {
    await interaction.editReply({ embeds: [ballEmbed], components: [] });
  } catch (_) {
    await channel.send({ embeds: [ballEmbed] }).catch(() => {});
  }

  await _sleep(700);

  if (inningsOver || innings2Won) {
    if (m.innings === 2 || innings2Won) {
      await _endMultiMatch(interaction, m, channel);
    } else {
      await _endMultiInnings1(interaction, m, channel);
    }
    return;
  }

  const scoreMsg = await channel.send({
    embeds: [buildMultiScorecardEmbed(m)],
    components: buildMultiNumberButtons(m.channelId),
  });
  m.scorecardMsgId = scoreMsg.id;

  await _triggerMultiBots(interaction, m);
}

// ── End innings 1 ─────────────────────────────────────────────
async function _endMultiInnings1(interaction, m, channel) {
  const score = m.getCurrentScore();
  const battingName = m.battingTeam === "A" ? m.teamA.name : m.teamB.name;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x1a73e8)
        .setTitle("🏏 End of Innings 1")
        .setDescription(
          `**${battingName}** scored **${score}** runs!\n\nSwitching sides...`,
        )
        .setTimestamp(),
    ],
  });

  await _sleep(1500);
  m.endInnings();
  _resetWickets(m.channelId);

  const chasingName = m.battingTeam === "A" ? m.teamA.name : m.teamB.name;
  const msg = await channel.send({
    content: `🎯 **Innings 2 begins!** ${chasingName} needs **${m.target}** runs to win!`,
    embeds: [buildMultiScorecardEmbed(m)],
    components: buildMultiNumberButtons(m.channelId),
  });
  m.scorecardMsgId = msg.id;

  await _triggerMultiBots(interaction, m);
}

// ── End match ─────────────────────────────────────────────────
async function _endMultiMatch(interaction, m, channel) {
  multiSessions.delete(m.channelId);
  _clearTimeout(m.channelId);
  recentWickets.delete(m.channelId);

  const r = m.getResult();

  m.teamA.players
    .filter((p) => !p.isBot)
    .forEach((p) => {
      updateStats(p.id, {
        won: !r.draw && r.winner.name === m.teamA.name,
        runsScored: m.scoreA,
      });
    });
  m.teamB.players
    .filter((p) => !p.isBot)
    .forEach((p) => {
      updateStats(p.id, {
        won: !r.draw && r.winner.name === m.teamB.name,
        runsScored: m.scoreB,
      });
    });

  await channel.send({
    embeds: [buildMultiResultEmbed(m)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hcm_cancel_${m.channelId}`)
          .setLabel("Close")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

// ── Trigger bots automatically ────────────────────────────────
async function _triggerMultiBots(interaction, m) {
  if (!["INNINGS1", "INNINGS2"].includes(m.state)) return;

  const batter = m.getCurrentBatter();
  const bowler = m.getCurrentBowler();

  if (!batter.isBot && !bowler.isBot) return;

  await _sleep(800);

  if (batter.isBot && bowler.isBot) {
    const bn = batter.ai.decide(
      "batting",
      m.getCurrentScore(),
      m.target,
      m.maxBalls - m.getCurrentBalls(),
    );
    const bwn = bowler.ai.decide(
      "bowling",
      m.getCurrentScore(),
      m.target,
      m.maxBalls - m.getCurrentBalls(),
    );

    m.pendingBatter = bn;
    const result = m.registerMove(bowler.id, bwn);

    if (result && result !== "waiting" && result !== "already") {
      await _resolveMultiBall(interaction, m, result);
    }
    return;
  }

  if (batter.isBot && m.pendingBatter === null) {
    const bn = batter.ai.decide(
      "batting",
      m.getCurrentScore(),
      m.target,
      m.maxBalls - m.getCurrentBalls(),
    );
    const result = m.registerMove(batter.id, bn);
    if (result && result !== "waiting" && result !== "already") {
      await _resolveMultiBall(interaction, m, result);
    }
  } else if (bowler.isBot && m.pendingBowler === null) {
    const bwn = bowler.ai.decide(
      "bowling",
      m.getCurrentScore(),
      m.target,
      m.maxBalls - m.getCurrentBalls(),
    );
    const result = m.registerMove(bowler.id, bwn);
    if (result && result !== "waiting" && result !== "already") {
      await _resolveMultiBall(interaction, m, result);
    }
  }
}

// ── Cancel multiplayer ────────────────────────────────────────
async function _handleMultiCancel(interaction, m, channelId, userId) {
  if (!m) {
    await interaction.update({ components: [] }).catch(() => {});
    return;
  }

  const isHost = userId === m.host.id;
  const isPlayer = m.joinedIds.has(userId);

  if (!isHost && !isPlayer) {
    return interaction.reply({
      content: "⚠️ Only players in this match can cancel it!",
      ephemeral: true,
    });
  }

  multiSessions.delete(channelId);
  _clearTimeout(channelId);
  recentWickets.delete(channelId);

  const cancellerName =
    interaction.user.displayName || interaction.user.username;

  await interaction
    .update({
      content: `❌ **Match cancelled** by **${cancellerName}**. Use \`/handcricket\` to start a new game!`,
      embeds: [],
      components: [],
    })
    .catch(async () => {
      await interaction
        .reply({ content: `❌ Match cancelled by **${cancellerName}**!` })
        .catch(() => {});
    });
}

// ════════════════════════════════════════════════════════════
//  1v1 / AI HANDLERS
// ════════════════════════════════════════════════════════════

async function _handleCancel1v1(interaction, channelId, userId) {
  const game = sessions.get(channelId);

  if (!game) {
    await interaction.update({ components: [] }).catch(() => {});
    return;
  }

  if (userId !== game.player1.id && userId !== game.player2.id) {
    return interaction.reply({
      content: "⚠️ Only the players in this match can cancel it!",
      ephemeral: true,
    });
  }

  sessions.delete(channelId);
  _clearTimeout(channelId);
  recentWickets.delete(channelId);

  const cancellerName =
    interaction.user.displayName || interaction.user.username;

  await interaction
    .update({
      content: `❌ **Match cancelled** by **${cancellerName}**. Use \`/handcricket\` to start a new game!`,
      embeds: [],
      components: [],
    })
    .catch(async () => {
      await interaction
        .reply({ content: `❌ Match cancelled by **${cancellerName}**!` })
        .catch(() => {});
    });
}

async function _handleDifficulty(interaction, game, difficulty) {
  if (interaction.user.id !== game.player1.id) {
    return interaction.reply({
      content: "⚠️ Only the challenger can pick AI difficulty!",
      ephemeral: true,
    });
  }

  game.aiDifficulty = difficulty;
  game.ai = new HandCricketAI(difficulty);

  const diffEmoji =
    { easy: "😴", medium: "😐", hard: "🔥" }[difficulty] || "🤖";

  await interaction.update({
    content: `${diffEmoji} **${difficulty.toUpperCase()} AI selected!** Time for the toss...`,
    embeds: [buildMatchStartEmbed(game)],
    components: buildTossButtons(game.id),
  });

  game.state = STATE.TOSS;
}

async function _handleToss(interaction, game, call) {
  if (interaction.user.id !== game.player1.id) {
    return interaction.reply({
      content: "⚠️ Only the challenger calls the toss!",
      ephemeral: true,
    });
  }
  if (game.state !== STATE.TOSS) {
    return interaction.reply({
      content: "⚠️ Toss already done!",
      ephemeral: true,
    });
  }

  const result = game.resolveToss(interaction.user.id, call);
  const tossEmbed = buildTossEmbed(game, result.winner, result.total);

  if (game.mode === "ai" && result.winner.id === "AI_BOT") {
    const aiChoice = game.aiDifficulty === "hard" ? "bowl" : "bat";
    game.assignBatBowl("AI_BOT", aiChoice);
    const choiceText =
      aiChoice === "bat"
        ? "🏏 CricketBot chose to **BAT FIRST**!"
        : "🎳 CricketBot chose to **BOWL FIRST**!";

    await interaction.update({ embeds: [tossEmbed], components: [] });
    await interaction.followUp({
      content: choiceText,
      embeds: [buildScorecardEmbed(game)],
      components: _addCancelButton(buildNumberButtons(game.id), game.id),
    });

    if (game.isBatterAI()) await _triggerAIMove(interaction, game);
    return;
  }

  await interaction.update({
    embeds: [tossEmbed],
    components: buildBatBowlButtons(game.id),
  });
}

async function _handleBatBowlChoice(interaction, game, choice) {
  if (interaction.user.id !== game.tossWinner?.id) {
    return interaction.reply({
      content: "⚠️ Only the toss winner can make this choice!",
      ephemeral: true,
    });
  }
  if (game.state !== STATE.CHOOSING) {
    return interaction.reply({
      content: "⚠️ Choice already made!",
      ephemeral: true,
    });
  }

  game.assignBatBowl(interaction.user.id, choice);
  _resetWickets(game.id);

  const choiceText =
    choice === "bat"
      ? `🏏 **${interaction.user.username}** chose to bat first!`
      : `🎳 **${interaction.user.username}** chose to bowl first!`;

  await interaction.update({
    content: choiceText,
    embeds: [buildScorecardEmbed(game)],
    components: _addCancelButton(buildNumberButtons(game.id), game.id),
  });

  if (game.isBatterAI()) await _triggerAIMove(interaction, game);
}

async function _handleMove(interaction, game, number) {
  const userId = interaction.user.id;

  if (![STATE.INNINGS1, STATE.INNINGS2].includes(game.state)) {
    return safeReply(interaction, {
      content: "⚠️ Game is not in play!",
      ephemeral: true,
    });
  }
  if (number < 1 || number > 6) {
    return safeReply(interaction, {
      content: "⚠️ Pick a number between 1 and 6!",
      ephemeral: true,
    });
  }

  const batter = game.getBatter();
  const bowler = game.getBowler();

  if (userId !== batter.id && userId !== bowler.id) {
    return safeReply(interaction, {
      content: "⚠️ It's not your turn! You're a spectator this ball.",
      ephemeral: true,
    });
  }
  if (userId === batter.id && game.pendingBatter !== null) {
    return safeReply(interaction, {
      content:
        "⚠️ You've already picked for this ball! Waiting for opponent...",
      ephemeral: true,
    });
  }
  if (userId === bowler.id && game.pendingBowler !== null) {
    return safeReply(interaction, {
      content: "⚠️ You've already bowled! Waiting for batter...",
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  if (game.mode === "ai" && game.ai) {
    game.ai.recordPlayerMove(number);
  }

  const result = game.registerMove(userId, number);

  if (result === null) {
    if (game.mode === "ai" && (game.isBatterAI() || game.isBowlerAI())) {
      await _triggerAIMove(interaction, game);
      return;
    }
    const who = userId === batter.id ? bowler.username : batter.username;
    await interaction.followUp({
      content: `✅ Move locked in! Waiting for **${who}**...`,
      ephemeral: true,
    });
    return;
  }

  await _resolveBallResult(interaction, game, result);
}

async function _resolveBallResult(interaction, game, result) {
  const { batterNum, bowlerNum, runs, isOut, inningsOver, innings2Won } =
    result;
  const batter = game.getBatter();
  const bowler = game.getBowler();
  const channel = interaction.channel;

  if (isOut) {
    _recordWicket(game.id);
  } else {
    _resetWickets(game.id);
  }

  let flavor = "";
  if (isOut) flavor = getSledge("OUT");
  else if (runs === 6) flavor = getSledge("SIX");
  else if (Math.random() < 0.3) flavor = getCrowdReaction();

  const milestone = getMilestoneComment(game.getCurrentScore());
  if (milestone && !isOut) flavor += `\n${milestone}`;

  const ballEmbed = buildBallResultEmbed(
    game,
    batter,
    bowler,
    batterNum,
    bowlerNum,
    runs,
    isOut,
    flavor,
  );

  try {
    await interaction.editReply({ embeds: [ballEmbed], components: [] });
  } catch (_) {
    await channel.send({ embeds: [ballEmbed] }).catch(() => {});
  }

  await _sleep(600);

  if (inningsOver) {
    if (innings2Won || game.innings === 2) {
      await _endMatch(interaction, game, channel);
    } else {
      await _endInnings1(interaction, game, channel);
    }
    return;
  }

  const scoreEmbed = buildScorecardEmbed(game);
  const msg = await channel.send({
    embeds: [scoreEmbed],
    components: _addCancelButton(buildNumberButtons(game.id, false), game.id),
  });
  game.scorecardMessageId = msg.id;

  if (game.mode === "ai" && (game.isBatterAI() || game.isBowlerAI())) {
    await _triggerAIMove(interaction, game);
  }
}

async function _endInnings1(interaction, game, channel) {
  const score = game.getCurrentScore();
  const batter = game.getBatter();
  const inningsEmbed = buildInningsEndEmbed(game, score, batter);
  await channel.send({ embeds: [inningsEmbed] });

  await _sleep(1500);
  game.endInnings1();
  _resetWickets(game.id);

  const scoreEmbed = buildScorecardEmbed(game);
  const msg = await channel.send({
    content: `🏏 **INNINGS 2 BEGINS!** ${game.getBatter().username} needs to chase ${score + 1} runs!`,
    embeds: [scoreEmbed],
    components: _addCancelButton(buildNumberButtons(game.id, false), game.id),
  });
  game.scorecardMessageId = msg.id;

  if (game.mode === "ai" && (game.isBatterAI() || game.isBowlerAI())) {
    await _triggerAIMove(interaction, game);
  }
}

async function _endMatch(interaction, game, channel) {
  const result = game.getResult();
  sessions.delete(game.id);
  _clearTimeout(game.id);
  recentWickets.delete(game.id);

  rematchConfigs.set(game.id, game.toRematchConfig());

  if (!result.draw) {
    if (game.player1.id !== "AI_BOT") {
      updateStats(game.player1.id, {
        won: result.winner.id === game.player1.id,
        runsScored: game.score1,
        wicketsTaken: 0,
      });
    }
    if (game.player2.id !== "AI_BOT") {
      updateStats(game.player2.id, {
        won: result.winner.id === game.player2.id,
        runsScored: game.score2,
      });
    }
  }

  let aiComment = "";
  if (game.mode === "ai" && game.ai) {
    if (result.winner?.id === "AI_BOT")
      aiComment = `\n🤖 *${game.ai.getTaunt("WIN")}*`;
    else if (result.winner?.id === game.player1.id)
      aiComment = "\n😤 *The AI demands a rematch.*";
  }

  const resultEmbed = buildResultEmbed(
    game,
    result.winner,
    result.loser,
    Math.max(game.score1, game.score2),
    Math.min(game.score1, game.score2),
    result.margin,
  );

  await channel.send({
    content: aiComment || undefined,
    embeds: [resultEmbed],
    components: buildPostGameButtons(game.id),
  });
}

async function _triggerAIMove(interaction, game) {
  if (!game.ai) return;
  if (![STATE.INNINGS1, STATE.INNINGS2].includes(game.state)) return;

  const role = game.isBatterAI() ? "batting" : "bowling";
  const aiScore = game.getBatter().id === "AI_BOT" ? game.getCurrentScore() : 0;
  const ballsLeft = game.ballsRemaining();

  const channel = interaction.channel;

  await game.ai.thinkDelay();

  const aiNumber = game.ai.decide(role, aiScore, game.target, ballsLeft);
  const result = game.registerAIMove(aiNumber);

  if (result === null) {
    await channel
      .send({
        embeds: [buildScorecardEmbed(game)],
        components: _addCancelButton(
          buildNumberButtons(game.id, false),
          game.id,
        ),
      })
      .catch(() => {});
    return;
  }

  await _resolveBallResultOnChannel(channel, game, result);
}

async function _resolveBallResultOnChannel(channel, game, result) {
  const { batterNum, bowlerNum, runs, isOut, inningsOver, innings2Won } =
    result;
  const batter = game.getBatter();
  const bowler = game.getBowler();

  if (isOut) _recordWicket(game.id);
  else _resetWickets(game.id);

  let flavor = "";
  if (isOut) flavor = getSledge("OUT");
  else if (runs === 6) flavor = getSledge("SIX");
  else if (Math.random() < 0.3) flavor = getCrowdReaction();

  const milestone = getMilestoneComment(game.getCurrentScore());
  if (milestone && !isOut) flavor += `\n${milestone}`;

  const ballEmbed = buildBallResultEmbed(
    game,
    batter,
    bowler,
    batterNum,
    bowlerNum,
    runs,
    isOut,
    flavor,
  );

  await channel.send({ embeds: [ballEmbed] }).catch(() => {});

  await _sleep(600);

  if (inningsOver) {
    const fakeInteraction = {
      channel,
      editReply: async () => {},
      followUp: async () => {},
    };
    if (innings2Won || game.innings === 2) {
      await _endMatch(fakeInteraction, game, channel);
    } else {
      await _endInnings1(fakeInteraction, game, channel);
    }
    return;
  }

  const scoreEmbed = buildScorecardEmbed(game);
  await channel
    .send({
      embeds: [scoreEmbed],
      components: _addCancelButton(buildNumberButtons(game.id, false), game.id),
    })
    .catch(() => {});
}

async function _handleRematch(interaction, channelId, userId) {
  const config = rematchConfigs.get(channelId);
  if (!config) {
    return interaction.reply({
      content: "⚠️ No recent game found to rematch!",
      ephemeral: true,
    });
  }
  if (userId !== config.player1.id && userId !== config.player2.id) {
    return interaction.reply({
      content: "⚠️ Only the original players can start a rematch!",
      ephemeral: true,
    });
  }
  if (sessions.has(channelId)) {
    return interaction.reply({
      content: "⚠️ A game is already running!",
      ephemeral: true,
    });
  }

  const newP1 = userId === config.player1.id ? config.player1 : config.player2;
  const newP2 = userId === config.player1.id ? config.player2 : config.player1;

  const game = new HandCricketGame(
    channelId,
    newP1,
    newP2,
    config.mode,
    config.maxOvers,
  );
  if (config.mode === "ai") {
    game.aiDifficulty = config.aiDifficulty || "medium";
    game.ai = new HandCricketAI(game.aiDifficulty);
  }
  sessions.set(channelId, game);
  rematchConfigs.delete(channelId);
  _resetTimeout(channelId, interaction.channel);

  game.state = STATE.TOSS;

  await interaction.update({
    content: `🔄 **REMATCH!** ${newP1.username} vs ${newP2.username}!`,
    embeds: [buildMatchStartEmbed(game)],
    components: buildTossButtons(channelId),
  });
}

// ── Helpers ────────────────────────────────────────────────────

function _addCancelButton(rows, channelId) {
  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hc_cancel_${channelId}`)
      .setLabel("Cancel Match")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
  );
  return [...(rows || []), cancelRow];
}

function _resetTimeout(channelId, channel) {
  _clearTimeout(channelId);
  const handle = setTimeout(async () => {
    sessions.delete(channelId);
    multiSessions.delete(channelId);
    recentWickets.delete(channelId);
    try {
      await channel.send(
        "⏰ **Game timed out** due to inactivity. Use `/handcricket` to start a new match!",
      );
    } catch (_) {}
  }, TIMEOUT_MS);
  timeouts.set(channelId, handle);
}

function _clearTimeout(channelId) {
  if (timeouts.has(channelId)) {
    clearTimeout(timeouts.get(channelId));
    timeouts.delete(channelId);
  }
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Export ────────────────────────────────────────────────────
const gameManager = {
  startGame,
  startMultiGame,
  handleInteraction,
  sessions,
  multiSessions,
};
module.exports = { gameManager };
