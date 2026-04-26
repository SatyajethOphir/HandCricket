// ============================================================
//  deploy-commands.js
//  Run this once (or after adding new commands):
//  > node deploy-commands.js
// ============================================================

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Deploying ${commands.length} command(s)...`);

    const target = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(target, { body: commands });
    console.log('✅ Commands deployed successfully!');
  } catch (err) {
    console.error('❌ Deploy failed:', err);
  }
})();
