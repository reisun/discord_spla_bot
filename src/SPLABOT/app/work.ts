// import { Message, MessageEmbed } from "discord.js"


// const prefix = '!'

// const test = (message: Message) => {
//     if (!message.content.startsWith(prefix))
//         return;
//     const [command, ...args] = message.content.slice(prefix.length).split(' ');
//     :regional_indicator_a:
//     :regional_indicator_h:

//     const emojis = ['🇦', '🇧', '🇨', '🇩']; 
//     if (command === 'poll') {
//         const [title, ...choices] = args
//         if (!title) 
//             return message.channel.send('タイトルを指定してください')
//         if (choices.length < 2 || choices.length > emojis.length)
//             return message.channel.send(`選択肢は2以上${emojis.length}個未満で指定してください`);
//         const embed = new Discord.MessageEmbed().setTitle(title).setDescription(choices.map((c, i) => `${emojis[i]} ${c}`).join('\n'))
//         const poll = await message.channel.send({
//             embeds: [embed]
//         });
//         emojis.slice(0, choices.length).forEach(emoji => poll.react(emoji))
//         embed.setFooter({
//             text: `集計時は !endpoll ${poll.channel.id} ${poll.id} と送信してください。`
//         })
//         poll.edit({ embeds: [embed] });
//         return;
//     }
//     if (command === 'endpoll') {
//         const [cid, mid] = args;
//         if (!cid || !mid) return message.channel.send('IDが指定されていません。');
//         const channel = await message.guild.channels.fetch(cid);
//         const poll = await channel.messages.fetch(mid);
//         if (poll.author.id !== client.user.id) return;
//         if (poll.embeds[0]) return;
//         let result = "投票結果";
//         for (let i = 0; poll.reactions.cache.get(emojis[i]) && i < emojis.length; i++) {
//             const reaction = poll.reactions.cache.get(emojis[i])
//             result = `${result}\n${emojis[i]} ： ${reaction.users.cache.has(client.user.id) ? reaction.count - 1 : reaction.count}票`
//         }
//         poll.reply({
//             embeds: [
//                 new Discord.MessageEmbed()
//                     .setTitle(poll.embeds[0].title)
//                     .setDescription(result)
//             ]
//         })
//     }
// })

//     client.login(token)
// const { EmbedBuilder, Client } = require("discord.js");
// const client = new Client(
//     {
//         intents: [
//             //...
//         ]
//     }
// );

// const prefix = "!";
// const emojis = ["🇦", "🇧", "🇨", "🇩"];

// client.on("messageCreate", async message => {
//     if (message.author.id === client.user.id) return;
//     if (!message.content.startsWith(prefix)) return;
//     const [command, ...args] = message.content.slice(prefix.length).split(/\s+/g);
//     if (command === "poll") {
//         //絵文字の設定。2～20個まで指定可能。
//         const [title, ...choices] = args;
//         if (!title) return message.reply("タイトルを設定してください。");
//         if (choices.length < 2 || choices.length > 20 || choices.length > emojis.length)
//             return message.reply(
//                 `選択肢は2～${emojis.length > 20 ? 20 : emojis.length}個の間で指定してください。`
//             );
//         const embed = new EmbedBuilder();
//         embed.setTitle(title);
//         embed.setFields(
//             choices.map(
//                 (c, i) => ({ name: emojis[i], value: c })
//             )
//         );

//         const msg = await message.channel.send({ embeds: [embed] });
//         emojis.slice(0, choices.length).forEach(emoji => msg.react(emoji));
//         embed.setFooter({
//             text: `集計時は !endpoll ${msg.channel.id} ${msg.id}と送信してください。`
//         });
//         msg.edit({ embeds: [embed] });
//         return;
//     };
//     if (command === "endpoll") {
//         const [channelId, messageId] = args;
//         const channel = await message
//             .guild
//             .channels
//             .fetch(channelId)
//             .catch(err => {
//                 console.error(err);
//                 return null;
//             });
//         if (!channel)
//             return message.reply("チャンネルIDの指定が間違っているか、チャンネルが削除されています。");
//         const msg = await channel
//             .messages
//             .fetch(messageId)
//             .catch(err => {
//                 console.error(err);
//                 return null;
//             });
//         if (!msg)
//             return message.reply("メッセージIDの指定が間違っているか、メッセージが削除されています。");
//         if (msg.author.id !== client.user.id) return;
//         if (!msg.embeds[0]) return;
//         const msgembed = msg.embeds[0];
//         if (!msgembed.title || !msgembed.fields?.length)
//             return message.reply("その投票は無効です。");
//         const result = msgembed
//             .fields
//             .map(field => {
//                 const emoji = field.name;
//                 if (!msg.reactions.cache.has(emoji)) return { emoji, count: 0 };
//                 const reaction = msg.reactions.resolve(emoji);
//                 return {
//                     emoji,
//                     count: reaction.users.cache.has(client.user.id)
//                         ? reaction.count - 1
//                         : reaction.count
//                 };
//             });
//         const embed = new EmbedBuilder();
//         embed.setTitle(`${msgembed.title} の投票結果`);
//         embed.setDescription(result.map(n => `${n.emoji}：${n.count}票`).join("\n"));
//         message.channel.send({ embeds: [embed] });
//         // msg.reactions.removeAll(); << [保留] 必要かどうか...
//     }
// });
