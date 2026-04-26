// ============================================================
//  commands/stats.js
//  /stats — personal match statistics
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 View your Hand Cricket statistics')
    .addUserOption(opt =>
      opt
        .setName('player')
        .setDescription('Check another player\'s stats (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('player') || interaction.user;

    if (target.bot) {
      return interaction.reply({ content: '🤖 Bots don\'t have stats!', ephemeral: true });
    }

    const p = getPlayer(target.id, target.displayName || target.username);

    if (!p) {
      return interaction.reply({
        content: '📭 No stats found. Play a game first using `/handcricket`!',
        ephemeral: true,
      });
    }

    const winRate  = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(1) : '0.0';
    const avgScore = p.matches > 0 ? (p.total_runs / p.matches).toFixed(1)   : '0.0';

    // ── Rank badge based on coins ───────────────────────────
    let rank = '🌱 Rookie';
    if (p.coins >= 500)  rank = '💎 Diamond';
    else if (p.coins >= 300) rank = '🏆 Gold';
    else if (p.coins >= 150) rank = '🥈 Silver';
    else if (p.coins >= 50)  rank = '🥉 Bronze';

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle(`📊 ${target.displayName || target.username}'s Stats`)
      .setThumbnail(target.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: '🏅 Rank',         value: rank,                    inline: true },
        { name: '💰 Coins',        value: `${p.coins}`,            inline: true },
        { name: '🎮 Matches',      value: `${p.matches}`,          inline: true },
        { name: '🏆 Wins',         value: `${p.wins}`,             inline: true },
        { name: '❌ Losses',       value: `${p.losses}`,           inline: true },
        { name: '📈 Win Rate',     value: `${winRate}%`,           inline: true },
        { name: '🏏 Total Runs',   value: `${p.total_runs}`,       inline: true },
        { name: '⭐ Highest Score', value: `${p.highest_score}`,   inline: true },
        { name: '📊 Avg Score',    value: `${avgScore}`,           inline: true },
      )
      .setFooter({ text: 'XO-Arena 🎮 Hand Cricket • /leaderboard to see rankings' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
