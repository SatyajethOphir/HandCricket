// ============================================================
//  utils/ui.js
//  All Discord embed & component builders live here.
//  Keep UI logic out of game logic — clean separation.
// ============================================================

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const { getNumberEmoji } = require('./flavor');

// ── Brand Colors ──────────────────────────────────────────────
const COLORS = {
  PRIMARY:  0x1a1a2e,   // deep navy
  BATTING:  0xf5a623,   // gold
  BOWLING:  0x4ecdc4,   // teal
  OUT:      0xe74c3c,   // red
  WIN:      0x2ecc71,   // green
  DRAW:     0x95a5a6,   // grey
  AI:       0x9b59b6,   // purple
  TOSS:     0x3498db,   // blue
  DANGER:   0xe74c3c,
};

// ── Number buttons (1–6) ──────────────────────────────────────
function buildNumberButtons(gameId, disabled = false) {
  const rows = [];

  // Row 1: 1, 2, 3
  const row1 = new ActionRowBuilder().addComponents(
    [1, 2, 3].map(n =>
      new ButtonBuilder()
        .setCustomId(`hc_move_${gameId}_${n}`)
        .setLabel(`${n}`)
        .setEmoji(getNumberEmoji(n))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    )
  );

  // Row 2: 4, 5, 6
  const row2 = new ActionRowBuilder().addComponents(
    [4, 5, 6].map(n =>
      new ButtonBuilder()
        .setCustomId(`hc_move_${gameId}_${n}`)
        .setLabel(`${n}`)
        .setEmoji(getNumberEmoji(n))
        .setStyle(n === 6 ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(disabled)
    )
  );

  return [row1, row2];
}

// ── Toss buttons ──────────────────────────────────────────────
function buildTossButtons(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hc_toss_${gameId}_odd`)
        .setLabel('ODD')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hc_toss_${gameId}_even`)
        .setLabel('EVEN')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

// ── Bat/Bowl choice buttons ───────────────────────────────────
function buildBatBowlButtons(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hc_choice_${gameId}_bat`)
        .setLabel('BAT FIRST')
        .setEmoji('🏏')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hc_choice_${gameId}_bowl`)
        .setLabel('BOWL FIRST')
        .setEmoji('🎳')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

// ── Post-game buttons ─────────────────────────────────────────
function buildPostGameButtons(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hc_rematch_${gameId}`)
        .setLabel('REMATCH')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hc_quit_${gameId}`)
        .setLabel('QUIT')
        .setEmoji('🚪')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

// ── Difficulty selector ───────────────────────────────────────
function buildDifficultyMenu(gameId) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`hc_difficulty_${gameId}`)
        .setPlaceholder('🤖 Choose AI Difficulty...')
        .addOptions([
          { label: '😴 Easy — Casual Fun', value: 'easy', description: 'AI plays randomly. Perfect for beginners.', emoji: '😴' },
          { label: '😐 Medium — Challenge Mode', value: 'medium', description: 'AI learns patterns. It\'s getting tricky.', emoji: '😐' },
          { label: '🔥 Hard — Ruthless Mode', value: 'hard', description: 'AI predicts your moves. Good luck.', emoji: '🔥' },
        ])
    ),
  ];
}

// ── Match Start Embed ─────────────────────────────────────────
function buildMatchStartEmbed(game) {
  const isAI = game.mode === 'ai';
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🏏 HAND CRICKET — MATCH BEGINS!')
    .setDescription([
      `> **${game.player1.username}** ⚔️ **${isAI ? '🤖 ' + game.player2.username : game.player2.username}**`,
      '',
      `📌 **Mode:** ${isAI ? `AI Battle (${game.aiDifficulty?.toUpperCase() || 'MEDIUM'})` : 'Player vs Player'}`,
      `🎯 **Overs:** ${game.maxOvers} per innings`,
      '',
      '> *Toss time! Choose odd or even...*',
    ].join('\n'))
    .setFooter({ text: 'XO-Arena 🎮 Hand Cricket • Type /stats to see your record' })
    .setTimestamp();
}

// ── Toss Result Embed ─────────────────────────────────────────
function buildTossEmbed(game, tossWinner, tossTotal) {
  return new EmbedBuilder()
    .setColor(COLORS.TOSS)
    .setTitle('🪙 TOSS RESULT!')
    .setDescription([
      `🎲 **Total:** ${tossTotal} (${tossTotal % 2 === 0 ? 'EVEN' : 'ODD'})`,
      '',
      `🏆 **${tossWinner.username}** wins the toss!`,
      '',
      '*Choose: Bat first or Bowl first?*',
    ].join('\n'))
    .setColor(COLORS.TOSS);
}

// ── Live Scorecard Embed ──────────────────────────────────────
function buildScorecardEmbed(game) {
  const batter  = game.getBatter();
  const bowler  = game.getBowler();
  const innings = game.innings;
  const score   = game.getCurrentScore();
  const target  = game.target;

  const ballsThisOver  = game.balls % 6;
  const oversCompleted = Math.floor(game.balls / 6);
  const overStr        = `${oversCompleted}.${ballsThisOver}`;

  let statusLine = '';
  if (innings === 2 && target !== null) {
    const needed = target - score + 1;
    const remaining = (game.maxOvers * 6) - game.balls;
    statusLine = needed > 0
      ? `🎯 **Needs ${needed} more runs** off ${remaining} balls`
      : `✅ **Target chased!**`;
  }

  // Build ball-by-ball of current over
  const ballHistory = (game.currentOverBalls || [])
    .map(b => b === 'W' ? '💀' : `[${b}]`)
    .join(' ');

  return new EmbedBuilder()
    .setColor(innings === 2 ? COLORS.BOWLING : COLORS.BATTING)
    .setTitle(`🏏 INNINGS ${innings} — LIVE`)
    .addFields(
      {
        name: '🏏 Batting',
        value: `**${batter.username}**`,
        inline: true,
      },
      {
        name: '🎳 Bowling',
        value: `**${bowler.username}**`,
        inline: true,
      },
      {
        name: '📊 Score',
        value: `**${score}** runs`,
        inline: true,
      },
      {
        name: '⏱ Overs',
        value: `**${overStr}** / ${game.maxOvers}.0`,
        inline: true,
      },
      ...(target !== null ? [{
        name: '🎯 Target',
        value: `**${target + 1}**`,
        inline: true,
      }] : []),
      ...(ballHistory ? [{
        name: '🎱 This Over',
        value: ballHistory || '—',
        inline: false,
      }] : []),
    )
    .setDescription(
      statusLine
        ? `\n${statusLine}\n`
        : `\n*${batter.username}'s turn to play...*\n`
    )
    .setFooter({ text: `XO-Arena 🎮 | Pick a number (1–6). Match if both same = OUT!` });
}

// ── Ball Result Embed ─────────────────────────────────────────
function buildBallResultEmbed(game, batter, bowler, bNum, bONum, runs, isOut, flavor) {
  let color = isOut ? COLORS.OUT : (runs === 6 ? COLORS.WIN : COLORS.BATTING);

  const desc = isOut
    ? `💀 **${batter.username} is OUT!**\n> Both picked **${getNumberEmoji(bNum)}** — same number!\n\n${flavor}`
    : `${runs === 6 ? '🔥' : runs >= 4 ? '🎯' : '🏏'} **${batter.username}** scores **${runs} run${runs !== 1 ? 's' : ''}!**\n> ${getNumberEmoji(bNum)} vs ${getNumberEmoji(bONum)}\n\n${flavor}`;

  return new EmbedBuilder()
    .setColor(color)
    .setDescription(desc);
}

// ── Innings End Embed ─────────────────────────────────────────
function buildInningsEndEmbed(game, score, player) {
  return new EmbedBuilder()
    .setColor(COLORS.DRAW)
    .setTitle(`📋 INNINGS ${game.innings} COMPLETE`)
    .setDescription([
      `**${player.username}** scored **${score} runs**`,
      '',
      game.innings === 1
        ? `🎯 **Target for ${game.getBowler().username}: ${score + 1} runs**`
        : '',
    ].join('\n'))
    .setTimestamp();
}

// ── Final Result Embed ────────────────────────────────────────
function buildResultEmbed(game, winner, loser, winnerScore, loserScore, margin) {
  const isDraw = !winner;
  return new EmbedBuilder()
    .setColor(isDraw ? COLORS.DRAW : COLORS.WIN)
    .setTitle(isDraw ? '🤝 MATCH DRAWN!' : `🏆 ${winner.username.toUpperCase()} WINS!`)
    .setDescription([
      isDraw
        ? `*Both teams ended level at **${winnerScore}** runs!*`
        : `*Won by **${margin}** run${margin !== 1 ? 's' : ''}!*`,
      '',
      '```',
      `  FINAL SCORECARD`,
      `  ─────────────────────`,
      `  ${game.player1.username.padEnd(16)} ${game.score1} runs`,
      `  ${game.player2.username.padEnd(16)} ${game.score2} runs`,
      '```',
      '',
      isDraw ? '' : `💰 **${winner.username}** earned **+20 coins**!`,
      `💰 **${isDraw ? 'Both players' : loser.username}** earned **+5 coins**!`,
    ].join('\n'))
    .setTimestamp()
    .setFooter({ text: 'Use /rematch or /stats • XO-Arena 🎮' });
}

module.exports = {
  COLORS,
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
};
