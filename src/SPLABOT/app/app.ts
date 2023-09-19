import {
    Client, Message, Events, GatewayIntentBits, GatewayDispatchEvents
} from 'discord.js';
import env from "../inc/env.json";
import { Controller as Controller } from "./Control"

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ]
});
const controller = new Controller();

client.once('ready', () => {
    console.log('discord connected !');

    // このイベント内で await して良いのか分からないのでひとまず非同期で
    controller.asyncSetup();
});

// // メンバー加入時
// client.on("guildMemberAdd", member => {
//     // 指定のサーバー以外では動作しないようにする
//     if (member.guild != null && !env.allowed_serv.includes(member.guild.id))
//         return;
// });

// メッセージ受信時
client.on(Events.MessageCreate, async message => {
    if (!controller.initialized){
        return;
    }

    console.log(message);

    await controller.processMessage(client, message);

});

client.login(env.token);