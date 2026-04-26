// ============================================================
//  commands/rematch.js
//  /rematch — request a rematch from the last game
// ============================================================

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rematch')
    .setDescription('🔄 Request a rematch with the previous opponent'),

  async execute(interaction) {
    // The rematch logic is button-driven via gameManager.
    // This command serves as a hint/redirect.
    await interaction.reply({
      content: [
        '🔄 **Want a rematch?**',
        'After a game ends, click the **REMATCH** button in the result message!',
        '',
        'Or start a fresh game with `/handcricket`.',
      ].join('\n'),
      ephemeral: true,
    });
  },
};
