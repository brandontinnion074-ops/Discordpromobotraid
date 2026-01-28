const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
    new SlashCommandBuilder()
        .setName("setchannel")
        .setDescription("Sets this channel as the promo code alert channel."),
    new SlashCommandBuilder()
        .setName("testalert")
        .setDescription("Sends a test promo alert to the configured channel.")
].map(cmd => cmd.toJSON());


const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

rest.put(
    Routes.applicationCommands("1465964748561580042"),
    { body: commands }
).then(() => console.log("Commands registered."));