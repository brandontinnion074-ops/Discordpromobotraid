const axios = require("axios");
const cheerio = require("cheerio");
const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes, 
  EmbedBuilder 
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let alertChannel = null;
let lastNewestCode = null;

const DEXERTO_URL = "https://www.dexerto.com/gaming/raid-shadow-legends-promo-codes-free-silver-xp-boosts-1773448/";

// ────────────────────────────────────────────────
// Register slash commands (global — takes up to 1h to appear)
const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Sets this channel as the promo code alert channel."),
  new SlashCommandBuilder()
    .setName("testalert")
    .setDescription("Sends a test promo alert to the configured channel."),
  new SlashCommandBuilder()
    .setName("listcodes")
    .setDescription("Lists all current active RAID promo codes from Dexerto."),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log("Started refreshing global application (/) commands.");
    await rest.put(
      Routes.applicationCommands("1465964748561580042"),
      { body: commands }
    );
    console.log("Successfully registered global slash commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();

// ────────────────────────────────────────────────
// Scrape Dexerto for codes
async function scrapePromoCodes() {
  try {
    const { data } = await axios.get(DEXERTO_URL, { timeout: 15000 });
    const $ = cheerio.load(data);

    let timeLimited = [];
    let newPlayer = [];
    let updateDate = "Unknown";

    // Try to find update date (often in first paragraph or heading)
    $("p strong, h2, h3").each((i, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("february") || text.includes("updated") || text.includes("as of")) {
        updateDate = $(el).text().trim() || updateDate;
      }
    });

    // Find tables
    $("table").each((i, table) => {
      const prevHeading = $(table).prevAll("h2, h3, h4, strong").first().text().toLowerCase();

      if (prevHeading.includes("time-limited") || prevHeading.includes("active promo codes") || prevHeading.includes("limited")) {
        $(table).find("tr").each((j, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const code = $(cells[0]).text().trim().toUpperCase();
            const reward = $(cells[1]).text().trim();
            if (code && /^[A-Z0-9]+$/.test(code) && code.length >= 4) {
              timeLimited.push({ code, reward });
            }
          }
        });
      }

      if (prevHeading.includes("new player") || prevHeading.includes("long-term") || prevHeading.includes("permanent")) {
        $(table).find("tr").each((j, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const code = $(cells[0]).text().trim().toUpperCase();
            const reward = $(cells[1]).text().trim();
            if (code && /^[A-Z0-9]+$/.test(code) && code.length >= 4) {
              newPlayer.push({ code, reward });
            }
          }
        });
      }
    });

    // Fallback: look for bold/strong codes if tables missed
    if (timeLimited.length === 0 && newPlayer.length === 0) {
      $("strong, b").each((i, el) => {
        const text = $(el).text().trim().toUpperCase();
        if (/^[A-Z0-9]{4,20}$/.test(text)) {
          // Rough guess — put in time-limited if short
          timeLimited.push({ code: text, reward: "Unknown (check page)" });
        }
      });
    }

    return { timeLimited, newPlayer, updateDate };
  } catch (err) {
    console.error("Scrape error:", err.message);
    return { timeLimited: [], newPlayer: [], updateDate: "Error fetching" };
  }
}

// ────────────────────────────────────────────────
// Check for new time-limited code (alert logic)
async function checkPromoCodes() {
  const { timeLimited } = await scrapePromoCodes();

  if (timeLimited.length === 0) return;

  const newest = timeLimited[0]?.code;

  if (lastNewestCode === null) {
    lastNewestCode = newest;
    console.log(`Initialized newest time-limited code: ${newest}`);
    return;
  }

  if (newest && newest !== lastNewestCode) {
    lastNewestCode = newest;
    console.log(`New code detected: ${newest}`);

    if (!alertChannel) return;

    try {
      const channel = await client.channels.fetch(alertChannel);
      if (channel?.isTextBased()) {
        await channel.send(
          `🔥 **New RAID Promo Code!**\n` +
          `**${newest}**\n` +
          `→ Check Dexerto for full rewards: <${DEXERTO_URL}>`
        );
      }
    } catch (err) {
      console.error("Alert send error:", err.message);
    }
  }
}

// ────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  setInterval(checkPromoCodes, 60 * 1000); // every 1 min
  checkPromoCodes(); // run once on start
});

// ────────────────────────────────────────────────
// Slash command handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "setchannel") {
      alertChannel = interaction.channel.id;
      await interaction.reply({
        content: "✅ This channel is now set for RAID promo code alerts!",
        ephemeral: true,
      });
    }

    else if (interaction.commandName === "testalert") {
      if (!alertChannel) {
        return interaction.reply({
          content: "No alert channel set. Use /setchannel first.",
          ephemeral: true,
        });
      }
      const channel = await client.channels.fetch(alertChannel);
      await channel.send("🔥 **Test Alert:** Bot is working and watching Dexerto!");
      await interaction.reply({ content: "Test alert sent!", ephemeral: true });
    }

    else if (interaction.commandName === "listcodes") {
      await interaction.deferReply({ ephemeral: false });

      const { timeLimited, newPlayer, updateDate } = await scrapePromoCodes();

      const embed = new EmbedBuilder()
        .setColor(0xFF4500) // Orange-red for RAID theme
        .setTitle("RAID: Shadow Legends Promo Codes")
        .setURL(DEXERTO_URL)
        .setDescription(`Last checked/updated: **${updateDate}**\nSource: Dexerto`)
        .setTimestamp()
        .setFooter({ text: "Codes can expire quickly — redeem in-game ASAP!" });

      if (timeLimited.length > 0) {
        embed.addFields({
          name: "🕒 Time-Limited Codes (Everyone)",
          value: timeLimited
            .map(c => `**${c.code}** → ${c.reward}`)
            .join("\n") || "None found",
          inline: false,
        });
      } else {
        embed.addFields({
          name: "🕒 Time-Limited Codes",
          value: "None detected right now — check Dexerto directly.",
          inline: false,
        });
      }

      if (newPlayer.length > 0) {
        embed.addFields({
          name: "🆕 New Player / Long-term Codes",
          value: newPlayer
            .slice(0, 10) // limit to avoid huge messages
            .map(c => `**${c.code}** → ${c.reward}`)
            .join("\n") + (newPlayer.length > 10 ? `\n...and ${newPlayer.length - 10} more` : ""),
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error("Command error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Sorry, something went wrong!", ephemeral: true });
    }
  }
});

client.login(process.env.BOT_TOKEN);
