require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('bug')
    .setDescription('Report een nieuwe bug')
    .addStringOption(o => o.setName('tekst').setDescription('Beschrijf de bug').setRequired(true)),

  new SlashCommandBuilder()
    .setName('bugs')
    .setDescription('Bekijk alle bugs (alleen zichtbaar voor jou)'),

  new SlashCommandBuilder()
    .setName('notitie')
    .setDescription('Voeg een notitie toe')
    .addStringOption(o => o.setName('tekst').setDescription('De notitie').setRequired(true)),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Verwijder een bug op ID')
    .addStringOption(o => o.setName('id').setDescription('Bug ID (bijv. A3F7KQ)').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Slash commands registreren...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Klaar! Slash commands zijn geregistreerd.');
  } catch (err) {
    console.error('Fout bij registreren:', err);
  }
})();
