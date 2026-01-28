const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

let alertChannel = null;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Store last seen code
let lastCode = null;

// API endpoint
const API_URL = "https://raidbro.com/api/promo-codes";

async function checkPromoCodes() {
    try {
        const { data } = await axios.get(API_URL);

        if (!data || !data.codes || data.codes.length === 0) return;

        const newest = data.codes[0].code;

        // First run: initialize without sending a message
        if (lastCode === null) {
            lastCode = newest;
            return;
        }

        // New code detected
        if (newest !== lastCode) {
            lastCode = newest;

            if (!alertChannel) return; // no channel set yet

            const channel = await client.channels.fetch(alertChannel);
            channel.send(`🔥 **New Raid Promo Code Dropped!**\n**${newest}**`);
        }

    } catch (err) {
        console.error("Error checking promo codes:", err.message);
    }
}

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Check every 60 seconds
    setInterval(checkPromoCodes, 60 * 1000);
});

// Slash command handler (must NOT be inside ready)
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "setchannel") {
        alertChannel = interaction.channel.id;
        await interaction.reply(`This channel has been set for promo alerts.`);
    }

    if (interaction.commandName === "testalert") {
        if (!alertChannel) {
            return interaction.reply("No alert channel set. Use /setchannel first.");
        }

        const channel = await client.channels.fetch(alertChannel);
        await channel.send("🔥 **Test Alert:** Your bot is working perfectly.");
        await interaction.reply("Test alert sent.");
    }
});

client.login(process.env.BOT_TOKEN);