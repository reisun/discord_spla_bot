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

//スラッシュコマンドに応答するには、interactionCreateのイベントリスナーを使う必要があります
client.on(Events.InteractionCreate, async interaction => {

    // // スラッシュ以外のコマンドの場合は対象外なので早期リターンさせて終了します
    // // コマンドにスラッシュが使われているかどうかはisChatInputCommand()で判断しています
    // if (!interaction.isChatInputCommand()) return;

    // // heyコマンドに対する処理
    // if (interaction.commandName === heyFile.data.name) {
    //     try {
    //         await heyFile.execute(interaction);
    //     } catch (error) {
    //         console.error(error);
    //         if (interaction.replied || interaction.deferred) {
    //             await interaction.followUp({ content: 'コマンド実行時にエラーになりました。', ephemeral: true });
    //         } else {
    //             await interaction.reply({ content: 'コマンド実行時にエラーになりました。', ephemeral: true });
    //         }
    //     }
    // } else {
    //     console.error(`${interaction.commandName}というコマンドには対応していません。`);
    // }
});

client.login(env.token);