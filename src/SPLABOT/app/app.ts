import {
    Message,
    Client,
    User,
    Events,
    GatewayIntentBits
} from 'discord.js';

import env from "../inc/env.json";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ]
});

const isDM = (message: Message) => {
    if (message.guild)
        return false;
    return true;
}

client.once('ready', () => {
    console.log('Ready!');
});

// メンバー加入時
client.on("guildMemberAdd", member => {
    // 指定のサーバー以外では動作しないようにする
    if (member.guild != null && !env.allowed_serv.includes(member.guild.id))
        return;
    // member.guild.channels.cache.get(chId).send(`${member.user}が参加しました！`);
});

// メッセージ受信時
client.on(Events.MessageCreate, async message => {
    // Botには反応しないようにする
    if (message.author.id == client.user?.id || message.author.bot)
        return;

    console.log(message);

    if (isDM(message)) {
        // DM
        message.author.send("ダイレクトメッセージで受信");
    }

    // 指定のサーバー以外では動作しないようにする
    if (message.guild != null && !env.allowed_serv.includes(message.guild.id)) {
        message.channel.send("知らないチャネルだ…");
        return;
    }


    // メッセージが入力された場所(テキストチャネル)に送信する
    // message.channel.send("オウム返しします。\n" + message.content);

    //メッセージの送信者にDMを送信する
    // message.reply("オウム返しします。\n" + message.content);

    // ダイレクトメッセージ
    message.author.send("ダイレクトメッセージで返信");

    // 任意のチャンネルIDを使用して
    // channel.send(txt)

    if (message.mentions != null) {
        console.log(message.mentions);

        message.mentions.users.forEach(async (value, key, map) => {
            console.log(value);
            console.log(key);
            console.log(map);
            let dmch = await client.users.createDM(value.id);
            dmch.send("メンションに乗っているIDにDMテスト");
        });
    }

    // f'{message.author.mention} Hey!' メンション

    //        let react = message.guild.emojis.get('723422237973151776');
    //    message.react(react)
    //      .then(message => console.log("リアクション: <:5star:723422237973151776>"))
    //      .catch(console.error);
});


client.login(env.token);