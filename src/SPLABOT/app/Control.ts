import { Client, Channel, TextChannel, User, Message, DMChannel, } from 'discord.js';
import env from "../inc/env.json";
import { eCommands } from "./Def"
import { CommandMessageAnalysis } from "./Utilis";
import { DBAccesser, User as MyUser, PlayUser, ePlayMode } from "./db";
import { MessageUtil, eMessage } from "./Message";

const eSendType = {
    sendReply: 1,
    sendReplyByDM: 2,
    sendDMByUserId: 3,
    sendMessageSameChannel: 4,
}
type eSendType = (typeof eSendType)[keyof typeof eSendType];

const MySuccess = "success";
type MySuccess = "success";
const MyError = "error";
type MyError = "error";
type ResultStatus = MySuccess | MyError;

interface MyResult {
    status: ResultStatus,
    sendList: {
        type: eSendType,
        userId: string,
        sendMessage: eMessage,
    }[]
}
class Sender {
    static async asyncReply(message: Message, sendMessage: string) {
        message.reply(sendMessage);
    }
    static async asyncDM(message: Message, sendMessage: string) {
        message.author.send(sendMessage);
    }
    static async asyncDM_fromUserId(client: Client, userId: string, sendMessage: string) {
        let dmChannel = await client.users.createDM(userId);
        dmChannel.send(sendMessage);
    }
    static async asyncSendSameChannel(message: Message, sendMessage: string) {
        message.channel.send(sendMessage);
    }
}

// if (message.mentions != null) {
//     console.log(message.mentions);

//     message.mentions.users.forEach(async user => {
//         console.log(user);
//         let dmch = await client.users.createDM(user.id);
//         dmch.send("メンションに乗っているIDにDMテスト");
//     });
// }

// f'{message.author.mention} Hey!' メンション

//        let react = message.guild.emojis.get('723422237973151776');
//    message.react(react)
//      .then(message => console.log("リアクション: <:5star:723422237973151776>"))
//      .catch(console.error);



export class Controller {
    private _dbAccesser: DBAccesser | null = null;

    constructor() {
    }

    get initialized(): boolean {
        return this._dbAccesser != null ? true : false;
    }
    get connectedDB(): DBAccesser {
        return this._dbAccesser!;
    }
    asyncSetup = async () => {
        this._dbAccesser = await DBAccesser.connect();
        console.log('db connected !');
    }

    processMessage = async (client: Client, message: Message) => {
        if (!MyFuncs.isUnresponsiveMessage(client, message))
            return;

        let analyser = new CommandMessageAnalysis(message.content);
        let isDM = MyFuncs.isDM(message);
        let sender: MyUser = {
            id: message.author.id,
            name: message.author.displayName,
        }
        let mentionUsers: MyUser[] = message.mentions.users.map(itr => {
            return {
                id: itr.id,
                name: itr.displayName,
            }
        });

        let result: MyResult;
        switch (analyser.command) {
            case eCommands.SplaJinroStart:
                result = await this.startGM(isDM, sender);
                break;
            case eCommands.Member:
                result = await this.changeMember(isDM, sender, mentionUsers);
                break;
            // case eCommands.RolePlan:
            //     result = prosessPolePlan(argsObj);
            //     break;
            // case eCommands.RoleSend:
            //     result = prosessRoleSend(argsObj);
            //     break;
            // case eCommands.Vote:
            //     result = prosessVote(argsObj);
            //     break;
            case eCommands.SplaJinroEnd:
                result = await this.endGM(isDM, sender);
                break;
            default:
                result = {
                    status: MySuccess,
                    sendList: [],
                };
                break;
        }
        // 順番に送信する前提で格納されている場合もあるので
        // 送信ごとに待機する
        result.sendList.forEach(async sendObj => {
            switch (sendObj.type) {
                case eSendType.sendReply:
                    await Sender.asyncReply(message, sendObj.sendMessage);
                    break;
                case eSendType.sendReplyByDM:
                    await Sender.asyncDM(message, sendObj.sendMessage);
                    break;
                case eSendType.sendDMByUserId:
                    await Sender.asyncDM_fromUserId(client, sendObj.userId, sendObj.sendMessage);
                    break;
                case eSendType.sendMessageSameChannel:
                    await Sender.asyncSendSameChannel(message, sendObj.sendMessage);
                    break;
            }
        });
    }

    startGM = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        // FIXME IDのみでチェックすればよい
        const query = {
            player: user,
        };
        const data = (await this.connectedDB.PlayUser
            .findOne(query)
        ) as PlayUser | null;

        if (data) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C01_AlreadyGM,),
                }],
            }
        }

        const insData: PlayUser = {
            player: user,
            player_last_ope_datatime: new Date().toLocaleTimeString(),
            play_mode: ePlayMode.SplaJinro,
            play_data: {
                members: {
                    key: "",
                    list: [],
                }
            }
        }
        const insRet = (await this.connectedDB.PlayUser
            .insertOne(insData)
        );
        if (!insRet.acknowledged) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C01_DBError,),
                }],
            }
        }

        return {
            status: MySuccess,
            sendList: [{
                type: eSendType.sendReply,
                userId: "",
                sendMessage: MessageUtil.getMessage(eMessage.C01_BecameGM, user.name),
            }],
        }
    }


    changeMember = async (isDM: boolean, user: MyUser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM) {
            // ではだめ
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C02_NotAllowFromDM,),
                }],
            }
        }

        const query = {
            player: user,
        };
        let data = (await this.connectedDB.PlayUser
            .findOne(query)
        ) as PlayUser | null;

        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }
        if (!data) {
            const resultStartGM = await this.startGM(isDM, user);
            if (resultStartGM.status != MySuccess) {
                return resultStartGM;
            }
            result.sendList = resultStartGM.sendList;
            
            data = (await this.connectedDB.PlayUser
                .findOne(query)
            ) as PlayUser | null;
            if (!data) {
                throw new Error("論理エラー");
            }
        }

        // TODO メッセージは 上記の result に追加する形で。
        if (inputMenbers.length == 0) {
            // メンバー参照モード
            if (data.play_data.members.list.length == 0) {
                return {
                    status: MySuccess,
                    sendList: [{
                        type: eSendType.sendReply,
                        userId: "",
                        sendMessage: MessageUtil.getMessage(eMessage.C02_MemberView_Zero,),
                    }],
                }
            }
            let msg = data.play_data.members.list.map(mem => mem.name).join("\n");
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C02_MemberView, msg),
                }],
            }
        }

        //TODO data.memberをコピーして inputMemberに居たら消す。inputMemberにしか居なければ追加する
        //TODO 削除した人、追加した人をメッセージで表示できるようにする。
        //TODO DBに登録する前に、最終的なメンバーが多すぎるようならエラーにする。

        // FIXME 仮
        return {
            status: MySuccess,
            sendList: [{
                type: eSendType.sendReply,
                userId: "",
                sendMessage: MessageUtil.getMessage("",),
            }],
        }
    }
    // static prosessSplaJinroStart(args: CommandMessageAnalysis) {

    // }
    // static prosessSplaJinroStart(args: CommandMessageAnalysis) {

    // }


    endGM = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const query = {
            player: user,
        }
        const data = (await this.connectedDB.PlayUser
            .findOne(query)
        ) as PlayUser | null;

        if (!data) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C05_IsNotGM,),
                }],
            }
        }

        const delRet = (await this.connectedDB.PlayUser
            .deleteMany(query)
        );
        if (!delRet.acknowledged) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C05_DBError,),
                }],
            }
        }

        return {
            status: MySuccess,
            sendList: [{
                type: eSendType.sendReply,
                userId: "",
                sendMessage: MessageUtil.getMessage(eMessage.C05_QuitGM,),
            }],
        }
    }

    showHow2User = (): MyResult => {
        let msg: string = "";
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        result.sendList.push({
            type: eSendType.sendReply,
            userId: "",
            sendMessage: "以下のコマンドが使えます！😊",
        });

        result.sendList.push({
            type: eSendType.sendReply,
            userId: "",
            sendMessage: `${eCommands.SplaJinroStart} ……かきかけ`,
        });

        return result;
    }
}






class MyFuncs {
    static isUnresponsiveMessage = (client: Client, message: Message): boolean => {
        if (message.author.id == client.user?.id) {
            console.log("これは私")
            return false;
        }
        if (message.author.bot) {
            console.log("知らないbotとはお話しちゃいけないって言われました");
            return false;
        }
        // 指定のサーバー以外では反応しないようにする
        if (message.guild != null && !env.allowed_serv.includes(message.guild.id)) {
            console.log("知らないチャネルだ…");
            return false;
        }
        return true;
    }

    static isDM = (message: Message) => {
        if (message.guild)
            return false;
        return true;
    }

}