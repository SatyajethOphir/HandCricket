// ============================================================
//  commands/handcricket.js
//  /handcricket — entry point for all game modes
//  Subcommands: pvp | ai | multi
// ============================================================

const { SlashCommandBuilder } = require('discord.js');
const { gameManager }         = require('../sessions/gameManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('handcricket')
    .setDescription('🏏 Play Hand Cricket!')

    // ── 1v1 PvP ─────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('pvp')
        .setDescription('Challenge another player 1v1')
        .addUserOption(opt =>
          opt.setName('opponent').setDescription('The player you want to challenge').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('overs').setDescription('Overs per innings (1–10, default 5)').setMinValue(1).setMaxValue(10).setRequired(false)
        )
    )

    // ── vs AI ────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('ai')
        .setDescription('Play against the AI bot')
        .addIntegerOption(opt =>
          opt.setName('overs').setDescription('Overs per innings (1–10, default 5)').setMinValue(1).setMaxValue(10).setRequired(false)
        )
    )

    // ── Multiplayer ──────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('multi')
        .setDescription('Start a multiplayer team match (2–20 players, 2 teams)')
        .addIntegerOption(opt =>
          opt
            .setName('teamsize')
            .setDescription('Players per team (1–10, default 2)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('overs')
            .setDescription('Overs per innings (1–10, default 5)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ai') {
      await gameManager.startGame(interaction, null, 'ai');
      return;
    }

    if (sub === 'multi') {
      const teamSize = interaction.options.getInteger('teamsize') || 2;
      const overs    = interaction.options.getInteger('overs')    || 5;
      await gameManager.startMultiGame(interaction, teamSize, overs);
      return;
    }

    // ── PvP ──────────────────────────────────────────────────
    const opponent = interaction.options.getUser('opponent');

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: '🤦 You can\'t play against yourself! Try `/handcricket ai` to face the bot.',
        ephemeral: true,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: '🤖 You can\'t challenge a bot user! Use `/handcricket ai` instead.',
        ephemeral: true,
      });
    }

    await gameManager.startGame(interaction, opponent, 'pvp');
  },
};