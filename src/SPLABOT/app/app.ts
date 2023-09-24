import env from "../inc/env.json";
import {
    Client, Message, Interaction, Events, GatewayIntentBits, Partials,
    // ↓ discord WebAPI
    REST, Routes,
} from 'discord.js';
import { Controller } from "./Control"
import { COMMAND_DEF_LIST as MY_COMMANDS } from "./Def";

console.log('import finished!');

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
const rest = new REST({
    version: '10'
});

const controller = new Controller();



client.once('ready', async () => {
    console.log('discord connected!');

    // ---スラッシュコマンド 更新処理
    try {
        // サーバーごとにループ
        for (const servId of env.allowed_serv) {
            // 古いコマンドかもしれないので、同じAppIDのコマンドは削除
            const guild = client.guilds.cache.get(servId);
            let commandList = await guild?.commands.fetch();
            if (commandList){
                for (const cmd of commandList.values()){
                    if (cmd.applicationId == env.appid) {
                        await guild?.commands.delete(cmd.id);
                    }
               }
            }
            // コマンド追加
            await rest.put(
                Routes.applicationGuildCommands(env.appid, servId),
                { body: MY_COMMANDS },
            );
        }
        console.log('slash command refresh success!');
    } catch (error) {
        console.error('slash command refresh failed... :', error);
    }

    // ---アプリ初期処理
    await controller.asyncSetup();
});

// メッセージ受信時
client.on(Events.MessageCreate, async message => {
    if (!controller.initialized) {
        return;
    }
    try {
        await controller.processMessage(client, message);
    }
    catch(e) {
        console.log(e);
    }
});

//スラッシュコマンド
client.on(Events.InteractionCreate, async interaction => {
    if (!controller.initialized) {
        return;
    }
    try {
        await controller.processCommand(client, interaction);
    }
    catch(e) {
        console.log(e);
    }
});

client.login(env.token);
rest.setToken(env.token);