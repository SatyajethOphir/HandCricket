// ============================================================
//  XO-ARENA DISCORD BOT — index.js
//  Loads commands, routes interactions to the correct handler.
// ============================================================

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Bot client ──────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// ── Auto-load slash commands ─────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: /${command.data.name}`);
  }
}

// ── Ready ────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log('\n🎮 XO-ARENA is LIVE!');
  console.log(`🤖 Logged in as: ${client.user.tag}`);
  console.log(`📡 Serving ${client.guilds.cache.size} servers\n`);
  client.user.setActivity('Hand Cricket 🏏 | /handcricket', { type: 0 });
});

// ── Interaction Router ───────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {

  // ── Slash commands ────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`❌ Command error [${interaction.commandName}]:`, err);
      const msg = { content: '⚠️ Something went wrong. The umpire is confused.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  // ── Buttons, Select Menus, Modal Submits → game handler ──
  if (
    interaction.isButton() ||
    interaction.isStringSelectMenu() ||
    interaction.isModalSubmit()
  ) {
    const { gameManager } = require('./sessions/gameManager');
    try {
      await gameManager.handleInteraction(interaction);
    } catch (err) {
      console.error('❌ Interaction error:', err);
      // Safely respond without crashing if already replied/deferred
      const errMsg = { content: '⚠️ Interaction failed. Please try again.', ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errMsg);
        } else {
          await interaction.reply(errMsg);
        }
      } catch (_) {}
    }
    return;
  }
});

// ── Error guards ─────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException',  err => console.error('Uncaught exception:',  err));

// ── Login ────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);