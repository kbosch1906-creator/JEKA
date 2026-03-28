require('dotenv').config();
const {
  Client, GatewayIntentBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const data = require('./data');

data.ensureFiles();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Embed & knoppen ───────────────────────────────────────────

const STATUS_COLOR = { open: 0xE67E22, pending: 0x3498DB, fixed: 0x2ECC71 };
const STATUS_LABEL = { open: '🔴 Open', pending: '🔵 Pending', fixed: '🟢 Fixed' };


function buildBugEmbed(bug) {
  return new EmbedBuilder()
    .setColor(STATUS_COLOR[bug.status])
    .setTitle(`${STATUS_LABEL[bug.status]} — Bug #${bug.id}`)
    .setDescription(bug.text)
    .setFooter({ text: `ID: ${bug.id}` });
}

function buildBugButtons(bug) {
  const row = new ActionRowBuilder();
  if (bug.status === 'open') {
    row.addComponents(
      new ButtonBuilder().setCustomId(`pending:${bug.id}`).setLabel('Mark Pending').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`delete:${bug.id}`).setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
    );
  } else if (bug.status === 'pending') {
    row.addComponents(
      new ButtonBuilder().setCustomId(`fixed:${bug.id}`).setLabel('Mark Fixed').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reopen:${bug.id}`).setLabel('Heropenen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`delete:${bug.id}`).setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId(`reopen:${bug.id}`).setLabel('Heropenen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`delete:${bug.id}`).setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
    );
  }
  return row;
}

// ── Slash command handlers ────────────────────────────────────

async function handleBugCreate(interaction) {
  const tekst = interaction.options.getString('tekst');
  await interaction.deferReply();
  const bug = data.createBug(tekst, interaction.user.username, interaction.channelId);
  const msg = await interaction.editReply({
    embeds: [buildBugEmbed(bug)],
    components: [buildBugButtons(bug)],
  });
  data.updateBug(bug.id, { messageId: msg.id });
}

async function handleBugsList(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const all = data.getAllBugs();
  if (all.length === 0) {
    return interaction.editReply('Geen bugs gevonden.');
  }

  const order = ['open', 'pending', 'fixed'];
  const sorted = [...all].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const shown  = sorted.slice(0, 25);

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('Alle bugs')
    .addFields(shown.map(b => ({
      name:  `${STATUS_LABEL[b.status]}  #${b.id}`,
      value: b.text.length > 80 ? b.text.slice(0, 80) + '…' : b.text,
    })));

  if (all.length > 25) {
    embed.setFooter({ text: `1-25 van ${all.length} bugs getoond` });
  }
  await interaction.editReply({ embeds: [embed] });
}

async function handleNotitie(interaction) {
  const tekst = interaction.options.getString('tekst');
  await interaction.deferReply();
  const line = data.appendNote(tekst, interaction.user.username);
  const embed = new EmbedBuilder()
    .setColor(0x8b90a8)
    .setTitle('📝 Notitie opgeslagen')
    .setDescription(tekst)
    .setFooter({ text: line });
  await interaction.editReply({ embeds: [embed] });
}

async function handleDeleteCommand(interaction) {
  const id    = interaction.options.getString('id').toUpperCase();
  const found = data.deleteBug(id);
  await interaction.reply({
    content: found ? `Bug #${id} verwijderd.` : `Bug #${id} niet gevonden.`,
    ephemeral: true,
  });
}

// ── Button handlers ───────────────────────────────────────────

async function handleStatusButton(interaction, action, bugId) {
  await interaction.deferUpdate();
  const statusMap = { pending: 'pending', fixed: 'fixed', reopen: 'open' };
  const bug = data.updateBug(bugId, { status: statusMap[action] });
  if (!bug) return; // bug al verwijderd
  await interaction.editReply({
    embeds: [buildBugEmbed(bug)],
    components: [buildBugButtons(bug)],
  });
}

async function handleDeleteButton(interaction, bugId) {
  await interaction.deferUpdate();
  data.deleteBug(bugId);
  await interaction.deleteReply();
}

// ── Interaction router ────────────────────────────────────────

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'bug':     return handleBugCreate(interaction);
        case 'bugs':    return handleBugsList(interaction);
        case 'notitie': return handleNotitie(interaction);
        case 'delete':  return handleDeleteCommand(interaction);
      }
    }

    if (interaction.isButton()) {
      // Notitie verwijderen (2 stappen)
      if (interaction.customId === 'note_delete') {
        await interaction.deferUpdate();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('note_delete_cancel').setLabel('Annuleren').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('note_delete_confirm').setLabel('Ja, verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ components: [row] });
      }
      if (interaction.customId === 'note_delete_cancel') {
        await interaction.deferUpdate();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('note_delete').setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ components: [row] });
      }
      if (interaction.customId === 'note_delete_confirm') {
        await interaction.deferUpdate();
        return interaction.deleteReply();
      }

      // Update gedaan/niet gedaan toggle
      if (interaction.customId === 'update_done') {
        await interaction.deferUpdate();
        const origEmbed = interaction.message.embeds[0];
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ Update — Gedaan')
          .setDescription(origEmbed.description)
          .setFooter({ text: origEmbed.footer?.text ?? '' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('update_undone').setLabel('Markeer als niet gedaan').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('update_delete').setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
      }
      if (interaction.customId === 'update_undone') {
        await interaction.deferUpdate();
        const origEmbed = interaction.message.embeds[0];
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📋 Update')
          .setDescription(origEmbed.description)
          .setFooter({ text: origEmbed.footer?.text ?? '' });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('update_done').setLabel('Markeer als gedaan').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('update_delete').setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
      }
      if (interaction.customId === 'update_delete') {
        await interaction.deferUpdate();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('update_delete_cancel').setLabel('Annuleren').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('update_delete_confirm').setLabel('Ja, verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ components: [row] });
      }
      if (interaction.customId === 'update_delete_cancel') {
        await interaction.deferUpdate();
        const origEmbed = interaction.message.embeds[0];
        const isDone = origEmbed.title?.includes('Gedaan');
        const row = new ActionRowBuilder().addComponents(
          isDone
            ? new ButtonBuilder().setCustomId('update_undone').setLabel('Markeer als niet gedaan').setStyle(ButtonStyle.Secondary)
            : new ButtonBuilder().setCustomId('update_done').setLabel('Markeer als gedaan').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('update_delete').setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
        );
        return interaction.editReply({ components: [row] });
      }
      if (interaction.customId === 'update_delete_confirm') {
        await interaction.deferUpdate();
        return interaction.deleteReply();
      }

      const [action, bugId] = interaction.customId.split(':');
      if (action === 'delete') return handleDeleteButton(interaction, bugId);
      return handleStatusButton(interaction, action, bugId);
    }
  } catch (err) {
    console.error('Fout bij interactie:', err);
    const reply = { content: 'Er ging iets mis. Probeer opnieuw.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.followUp(reply).catch(() => {});
    } else {
      interaction.reply(reply).catch(() => {});
    }
  }
});

// ── Berichten in kanalen ──────────────────────────────────────

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const kanaal = message.channel.name;

  if (kanaal === 'bugs') {
    const tekst = message.content.trim();
    if (!tekst) return;
    await message.delete().catch(() => {});
    const bug = data.createBug(tekst, message.author.username, message.channelId);
    const msg = await message.channel.send({
      embeds: [buildBugEmbed(bug)],
      components: [buildBugButtons(bug)],
    });
    data.updateBug(bug.id, { messageId: msg.id });
  }

  if (kanaal === 'updates') {
    const tekst = message.content.trim();
    if (!tekst) return;
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📋 Update')
      .setDescription(tekst)
      .setFooter({ text: `Door ${message.author.username}` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('update_done').setLabel('Markeer als gedaan').setStyle(ButtonStyle.Success),
    );
    await message.channel.send({ embeds: [embed], components: [row] });
  }

  if (kanaal === 'notities') {
    let tekst = message.content.trim();

    // Lees bijgevoegd bestand als er geen tekst is
    if (!tekst && message.attachments.size > 0) {
      const attachment = message.attachments.first();
      try {
        const res = await fetch(attachment.url, { redirect: 'follow' });
        tekst = (await res.text()).trim();
        console.log('Bijlage gelezen, lengte:', tekst.length);
      } catch (err) {
        console.error('Fout bij lezen bijlage:', err);
        return;
      }
    }

    if (!tekst) return;
    await message.delete().catch(() => {});

    // Splits lange tekst op in stukken van max 4000 tekens (Discord embed limiet)
    const stukken = [];
    for (let i = 0; i < tekst.length; i += 4000) stukken.push(tekst.slice(i, i + 4000));

    for (let i = 0; i < stukken.length; i++) {
      if (i === 0) data.appendNote(stukken[i], message.author.username);
      const embed = new EmbedBuilder()
        .setColor(0x8b90a8)
        .setTitle(i === 0 ? '📝 Notitie' : '📝 (vervolg)')
        .setDescription(stukken[i])
        .setFooter({ text: `Opgeslagen door ${message.author.username}` });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('note_delete').setLabel('Verwijderen').setStyle(ButtonStyle.Danger),
      );
      await message.channel.send({ embeds: [embed], components: [row] });
    }
  }
});

client.once('ready', () => {
  console.log(`Bug Tracker Bot online als ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
