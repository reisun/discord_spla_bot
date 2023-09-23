import {
    Client, Message, Events, GatewayIntentBits, Partials
} from 'discord.js';
import env from "../inc/env.json";
import { Controller as Controller } from "./Control"

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    // BotへのDMを受信するには以下が必要みたい
    // thanks!
    // https://stackoverflow.com/questions/68700270/event-messagecreate-not-firing-emitting-when-i-send-a-dm-to-my-bot-discord-js-v
    partials: [Partials.Channel],
});
const controller = new Controller();



client.once('ready', () => {
    console.log('discord connected !');

    // このイベント内で await して良いのか分からないのでひとまず非同期で
    controller.asyncSetup();
});

// メッセージ受信時
client.on(Events.MessageCreate, async message => {
    if (!controller.initialized){
        return;
    }
    await controller.processMessage(client, message);
});

client.login(env.token);