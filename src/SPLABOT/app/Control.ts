import { Client, Channel, User, Message, ChannelType, } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import env from "../inc/env.json";
import { MAX_MEMBER_COUNT, eCommands } from "./Def"
import { CommandMessageAnalysis as CommandMessageAnalyser } from "./Utilis";
import { DBAccesser, User as MyUser, PlayUser, ePlayMode } from "./db";
import { MessageUtil, eMessage } from "./Message";

const GLOBAL_USER_DATA = {
    player_id: "-1",
    player: { id: "-1", name: "global" },
    player_last_ope_datatime: new Date(),
    play_mode: ePlayMode.SplaJinro,
    play_data: {
        members: {
            key: "",
            list: [],
        },
        suggestRoleTemplate: `${eCommands.SuggestRole} あきと 人狼 狂人`,
    }
};

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
        // グローバルデータが無ければメソッド内で作成してくれるので、これを呼んでおく
        this.getGlobalData();
    }

    processMessage = async (client: Client, message: Message) => {
        if (!MyFuncs.isUnresponsiveMessage(client, message, true))
            return;

        let analyser = new CommandMessageAnalyser(message.content);
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

        // TODO /spロールテンプレート設定なるものを作るか？
        // TODO /spロールテンプレート /グローバル {グローバルテンプレートの設定}
        // TODO /spロールテンプレート {個人の設定。 空ならグローバルテンプレートで上書き}

        let result: MyResult;
        switch (analyser.command) {
            // startGM は DB登録処理として内部だけで使う
            // case eCommands.SplaJinroStart:
            //     result = await this.startGM(isDM, sender);
            //     break;
            case eCommands.Member:
                result = await this.updateMember(isDM, sender, mentionUsers);
                break;
            case eCommands.SuggestRole:
                result = await this.suggestRole(isDM, sender, analyser);
                break;
            //     // TODO ロールDM機能の実装
            // case eCommands.SendRole:
            //     result = await this.sendRole(isDM, sender, analyser);
            //     break;
            //     // TODO 投票機能の実装
            // case eCommands.CreateVote:
            //     result = await this.crewateVote(isDM, sender, analyser);
            //     break;
            case eCommands.ClearData:
                result = await this.clearUserData(isDM, sender);
                break;
            //     // TODO ロールテンプレート編集の実装
            // case eCommands.EditRoleTemplate:
            //     result = await this.editRoleTemplate(isDM, sender, analyser);
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

    insertUserData = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const query = { player_id: user.id };
        const data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (data) {
            // 既にDM
            return MyFuncs.createErrorReply(eMessage.C01_AlreadyGM);
        }

        // DBに追加
        const insData: PlayUser = {
            player_id: user.id,
            player: user,
            player_last_ope_datatime: new Date(),
            play_mode: ePlayMode.SplaJinro,
            play_data: {
                members: {
                    key: "",
                    list: [],
                },
                suggestRoleTemplate: "",
            }
        }
        const insRet = (await this.connectedDB.PlayUser.insertOne(insData));
        if (!insRet.acknowledged) {
            return MyFuncs.createErrorReply(eMessage.C01_DBError);
        }

        // 成功メッセージ
        return MyFuncs.createSuccessReply(eMessage.C01_BecameGM, user.name);
    }


    updateMember = async (isDM: boolean, user: MyUser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM) {
            // ではだめにする。理由としてメンバーのメンションが必要なので
            return MyFuncs.createErrorReply(eMessage.C02_NotAllowFromDM);
        }

        // startGMの結果も入るのであらかじめ作成
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        const query = { player_id: user.id };
        let data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data) {
            // GMで無ければこちらで startGM してしまう
            const resultStartGM = await this.insertUserData(isDM, user);
            if (resultStartGM.status != MySuccess) {
                return resultStartGM;
            }
            result.sendList = resultStartGM.sendList;

            data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
            if (!data) {
                throw new Error("論理エラー");
            }
        }

        if (inputMenbers.length == 0) {
            // メンションが０人なら参照モード
            if (data.play_data.members.list.length == 0) {
                // 参照したがメンバー０人。メッセージを追加して返却
                result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView_Zero,));
                return result;
            }
            // 現在のメンバーを返却
            let msg = data.play_data.members.list.map(mem =>
                MessageUtil.getMessage(eMessage.C02_inner_MemberFormat, mem.name)
            ).join("\n");
            result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView, msg));
            return result;
        }

        // ---追加・削除モード
        // 既存メンバーと入力値メンバを重複無しで配列化
        const unique = new Set(data.play_data.members.list.concat(inputMenbers));
        const concatMember = [...unique];

        // "追加"・"削除"・"変わらず"、のフラグ振り分け
        let workMemberList: { member: MyUser, status: "add" | "delete" | "none" }[] = [];
        concatMember.forEach(cctMen => {
            const existing = data!.play_data.members.list.some(exsMem => exsMem.id == cctMen.id);
            const isInInput = inputMenbers.some(inpMem => inpMem.id == cctMen.id);
            // 既存メンバーにいる かつ 入力にもいた ⇒ 削除 else そのまま
            if (existing && isInInput) {
                workMemberList.push({ member: cctMen, status: "delete" });
            }
            // 既存メンバーにいない かつ 入力にいる ⇒ 追加
            else if (!existing && isInInput) {
                workMemberList.push({ member: cctMen, status: "add" });
            }
            else {
                workMemberList.push({ member: cctMen, status: "none" });
            }
        });

        // メンバー多すぎ問題
        if (workMemberList.filter(mem => mem.status != "delete").length > MAX_MEMBER_COUNT) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C02_ToMany,));
            return result;
        }

        // メンバー更新
        const key = uuidv4();
        const newMember = workMemberList
            .filter(workMem => workMem.status != "delete")
            .map(wMem => wMem.member);

        const updRet = (await this.connectedDB.PlayUser.updateOne(
            query,
            {
                $set: {
                    'play_data.members.key': key,
                    'play_data.members.list': newMember,
                },
                $currentDate: {
                    player_last_ope_datatime: true,
                },
            },
        ));

        if (!updRet.acknowledged || updRet.modifiedCount == 0) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C02_DBError,));
            return result;
        }

        // 成功メッセージ
        result.sendList.push(MyFuncs.createReply(eMessage.C02_UpdatedMember,));

        // 参照モードを利用して最終的なメンバーのメッセージを取得し、返信に追加
        (await this.updateMember(isDM, user, [])).sendList.forEach(sendObj => {
            result.sendList.push(sendObj);
        });
        return result;
    }

    suggestRole = async (isDM: boolean, user: MyUser, orgCmd: CommandMessageAnalyser): Promise<MyResult> => {
        if (isDM) {
            // DMからでもOK
            console.log("dmで受信");
        }

        // ユーザーデータ取得
        const query = { player_id: user.id };
        let data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data) {
            // GMで無ければメンバー追加へ誘導（メンバー追加コマンドでGMになれるので、ここではGMにさせてあげないんだから///）
            return MyFuncs.createErrorReply(eMessage.C03_MemberNothing,);
        }

        // 複数のメッセージが入る場合があるので先に作っておく
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        // コマンドチェック
        let cmd = orgCmd;
        let useTemplate = false;
        if (cmd.getValue(0, 1) == null) {
            // 引数が１個も無い場合はテンプレートを採用
            useTemplate = true;
            cmd = new CommandMessageAnalyser(data?.play_data.suggestRoleTemplate ?? "");
            if (cmd.isEmpty()) {
                // グローバルデータから取得
                const gData = await this.getGlobalData();
                cmd = new CommandMessageAnalyser(gData?.play_data.suggestRoleTemplate ?? "");
            }
        }
        // コマンドチェックつづき
        // テンプレートを利用したからと言ってエラーにならないわけでは無い
        if (cmd.getValue(0, 2) == null) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_RorlArgNothing, eCommands.SuggestRole))
            return result;
        }
        else if ((cmd.getLength(0) - 2) > MAX_MEMBER_COUNT) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_ToMany,))
            return result;
        }

        // コマンドの内容を保持
        let theName = cmd.getValue(0, 1)!;
        let roleNameList: string[] = [];
        for (let i = 2; i < cmd.getLength(0); i++) {
            roleNameList.push(cmd.getValue(0, i)!);
        }

        if (useTemplate) {
            // テンプレートを利用した旨のメッセージ
            result.sendList.push(MyFuncs.createReply(
                eMessage.C03_UseTemplate,
                theName,
                roleNameList.join("、")))
        }

        // メンバーチェック
        if (data.play_data.members.list.length == 0) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_MemberNothing,))
            return result;
        }
        if (data.play_data.members.list.length < roleNameList.length) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(
                eMessage.C03_MemberFew,
                roleNameList.length,
                data.play_data.members.list.length));
            return result;
        }

        // ---ロール割り振り提案

        // 全員村人にして、役職ごとにランダムで決定
        let workMemberList: { member: MyUser, dispName: string, role: string }[]
            = data.play_data.members.list.map(mem => { return { member: mem, dispName: "", role: "村人" }; });
        roleNameList.forEach(role => {
            let hitIdx = 999;
            do {
                hitIdx = MyFuncs.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.role ?? "") != "村人"); // 村人でなければ再抽選
            workMemberList[hitIdx].role = role;
        });

        // アルファベットテーブルをランダムに回してメンバーの数で抽出
        let alpList = ["A", "B", "F", "H", "W", "X", "Y", "Z", "N", "L", "Q", "S",];
        for (let i = 0; MyFuncs.getRandomInt(alpList.length); i++) {
            alpList.push(alpList.shift()!);
        }
        alpList = alpList.slice(0, workMemberList.length);

        // メンバーにランダムに割り当て
        alpList.forEach(alp => {
            let hitIdx = 999;
            do {
                hitIdx = MyFuncs.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.dispName ?? "-1") != ""); // 空で無ければ再抽選
            workMemberList[hitIdx].dispName = theName + alp;
        });

        // 文字列化
        let memberUID = data.play_data.members.key;
        let memberRoleStr = "";
        let option = "狂人=>知らせる=>人狼";

        // 文字幅調整
        let roleMaxlen = Math.max(...roleNameList.map(v => v.length));

        memberRoleStr = workMemberList.map(obj => 
            MessageUtil.getMessage(eMessage.C03_inner_MemberFormat, 
                obj.dispName, 
                obj.role.padEnd(roleMaxlen, "　"), // 役職は全角だろうという前提
                obj.member.name),
        ).join("\n");

        // TODO Embed を使って記載できないか？ あぁコマンドになるからコピーできなとだめか
        // TODO 配役に問題なければ リアクション で 送信コピペを省略できないか？
        // TODO スラッシュコマンドへの対応

        result.sendList.push(
            MyFuncs.createReply(eMessage.C03_SuggestMemberExplain),
            MyFuncs.createReply(
                eMessage.C03_SuggestMember,
                eCommands.SendRole,
                memberUID,
                memberRoleStr,
                option),
        );
        return result;
    }


    // }
    // static prosessSplaJinroStart(args: CommandMessageAnalysis) {

    // }


    clearUserData = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const query = { player_id: user.id };
        const data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C06_IsNotGM,),
                }],
            }
        }

        const delRet = await this.connectedDB.PlayUser.deleteMany(query);
        if (!delRet.acknowledged) {
            return {
                status: MyError,
                sendList: [{
                    type: eSendType.sendReply,
                    userId: "",
                    sendMessage: MessageUtil.getMessage(eMessage.C06_DBError,),
                }],
            }
        }

        return {
            status: MySuccess,
            sendList: [{
                type: eSendType.sendReply,
                userId: "",
                sendMessage: MessageUtil.getMessage(eMessage.C06_QuitGM,),
            }],
        }
    }

    getGlobalData = async (): Promise<PlayUser> => {
        const query = { player_id: GLOBAL_USER_DATA.player_id };
        const data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (data) {
            return data;
        }
        const insRet = (await this.connectedDB.PlayUser.insertOne(GLOBAL_USER_DATA));
        if (!insRet.acknowledged) {
            throw new Error("global data insert failed.");
        }
        return GLOBAL_USER_DATA;
    }

    static showHow2User = (): MyResult => {
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
            sendMessage: `${eCommands.Member} ……かきかけ`,
        });

        return result;
    }

    static MessageLog = (msg: Message): void => {
        const isDM = MyFuncs.isDM(msg) ? "DM" : "not DM";
        console.log("Recept! msg:%s, sender:%s, DM?:%s", msg.content, msg.author.displayName, isDM)
    }


}






class MyFuncs {
    static isUnresponsiveMessage = (client: Client, message: Message, isOutputLog: boolean): boolean => {
        if (message.author.id == client.user?.id) {
            if (isOutputLog) console.log("これは私")
            return false;
        }
        if (message.author.bot) {
            if (isOutputLog) console.log("知らないbotとはお話しちゃいけないって言われました");
            return false;
        }
        // 指定のサーバー以外では反応しないようにする
        if (message.guild != null && !env.allowed_serv.includes(message.guild.id)) {
            if (isOutputLog) console.log("知らないチャネルだ…");
            return false;
        }
        if (isOutputLog) Controller.MessageLog(message);
        return true;
    }

    static isDM = (message: Message) => {
        return message.channel.type === ChannelType.DM;
    }

    static getRandomInt = (max: number): number => {
        return Math.floor(Math.random() * (max + 1));
    }

    static createReply = (msg: eMessage, ...args: unknown[]): {
        type: eSendType,
        userId: string,
        sendMessage: eMessage,
    } => {
        return {
            type: eSendType.sendReply,
            userId: "",
            sendMessage: MessageUtil.getMessage(msg, ...args),
        };
    }

    static createErrorReply = (msg: eMessage, ...args: unknown[]): MyResult => {
        return {
            status: MyError,
            sendList: [MyFuncs.createReply(msg, ...args)],
        }
    }
    static createSuccessReply = (msg: eMessage, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createReply(msg, ...args)],
        }
    }

}