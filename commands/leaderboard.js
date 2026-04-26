// ============================================================
//  commands/leaderboard.js
//  /leaderboard — top players by coins
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 View the XO-Arena Hand Cricket leaderboard'),

  async execute(interaction) {
    await interaction.deferReply();

    const players = getLeaderboard(10);

    if (!players || players.length === 0) {
      return interaction.editReply({
        content: '📭 No matches played yet! Use `/handcricket` to start the first game.',
      });
    }

    // ── Medals ───────────────────────────────────────────────
    const medals = ['🥇', '🥈', '🥉'];

    const rows = players.map((p, i) => {
      const medal   = medals[i] || `**${i + 1}.**`;
      const wr      = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(0) : 0;
      const name    = p.username.length > 14 ? p.username.slice(0, 13) + '…' : p.username;
      return `${medal} \`${name.padEnd(15)}\` 💰 ${String(p.coins).padStart(5)} | 🏆 ${p.wins}W | 🎯 ${wr}% WR`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle('🏆 XO-ARENA LEADERBOARD — HAND CRICKET')
      .setDescription(`\`\`\`\n${'RANK  PLAYER          COINS   W   WR%'.padEnd(44)}\n${'─'.repeat(44)}\n\`\`\`` + `\n${rows}`)
      .setFooter({ text: 'Updated live • /stats to see your personal record • XO-Arena 🎮' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
