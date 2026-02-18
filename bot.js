const axios = require("axios");
const cheerio = require("cheerio");
const { Client, GatewayIntentBits } = require("discord.js");

let alertChannel = null;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Store last seen newest code (time-limited section)
let lastNewestCode = null;

// Page to scrape
const DEXERTO_URL = "https://www.dexerto.com/gaming/raid-shadow-legends-promo-codes-free-silver-xp-boosts-1773448/";

async function checkPromoCodes() {
  try {
    const { data } = await axios.get(DEXERTO_URL, { timeout: 10000 });
    const $ = cheerio.load(data);

    // Find the time-limited codes section
    // Dexerto often uses tables; look for the one after headings like "Time-limited promo codes"
    let codes = [];

    // Strategy: find all <strong> or bold tags that look like codes (uppercase/short strings)
    // But more reliably: find tables, then extract first column (code) from rows after header
    $("table").each((i, table) => {
      const heading = $(table).prevAll("h3, h4, strong").first().text().toLowerCase();
      if (heading.includes("time-limited") || heading.includes("active promo codes")) {
        $(table)
          .find("tr")
          .each((j, row) => {
            const cells = $(row).find("td, th");
            if (cells.length >= 2) {
              const codeCell = $(cells[0]).text().trim();
              const rewardCell = $(cells[1]).text().trim();
              // Codes are usually uppercase/short, like MIDLOVE, EPYRE
              if (codeCell && /^[A-Z0-9]+$/.test(codeCell) && codeCell.length >= 4 && codeCell.length <= 20) {
                codes.push({ code: codeCell, reward: rewardCell });
              }
            }
          });
      }
    });

    if (codes.length === 0) {
      console.log("No time-limited codes found on Dexerto page");
      return;
    }

    // Assume the first one in the table is the newest (Dexerto usually lists newest first)
    const newest = codes[0].code;

    // First run: initialize
    if (lastNewestCode === null) {
      console.log(`Initialized newest code: ${newest}`);
      lastNewestCode = newest;
      return;
    }

    // New code detected
    if (newest !== lastNewestCode) {
      console.log(`New promo code detected: ${newest} (previous: ${lastNewestCode})`);
      lastNewestCode = newest;

      if (!alertChannel) {
        console.log("No alert channel set");
        return;
      }

      try {
        const channel = await client.channels.fetch(alertChannel);
        if (channel?.isTextBased()) {
          await channel.send(
            `🔥 **New RAID: Shadow Legends Promo Code Dropped!**\n` +
            `**${newest}**\n` +
            `Check Dexerto for rewards & more: <${DEXERTO_URL}>`
          );
        }
      } catch (chErr) {
        console.error("Failed to send alert:", chErr.message);
      }
    }

  } catch (err) {
    console.error("Error scraping Dexerto promo codes:", err.message);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  // Check every 60 seconds (Dexerto updates aren't super frequent)
  setInterval(checkPromoCodes, 60 * 1000);
  // Optional: run once immediately on start
  checkPromoCodes();
});

// Slash command handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setchannel") {
    alertChannel = interaction.channel.id;
    await interaction.reply("This channel is now set for RAID promo code alerts!");
  }

  if (interaction.commandName === "testalert") {
    if (!alertChannel) {
      return interaction.reply("No alert channel set. Use /setchannel first.");
    }
    const channel = await client.channels.fetch(alertChannel);
    await channel.send("🔥 **Test Alert:** Bot is alive and scraping Dexerto!");
    await interaction.reply("Test alert sent.");
  }
});

// You still need to register the slash commands (see previous response for code)

client.login(process.env.BOT_TOKEN);
