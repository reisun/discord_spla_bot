import { Client, Channel, User, Message, ChannelType, Interaction, TextBasedChannel, ApplicationCommandOptionType, EmbedBuilder, Colors, BaseMessageOptions, MessageReaction, PartialMessageReaction, Guild, PartialUser, } from 'discord.js';
import env from "../inc/env.json";
import { eCommands, isMyCommand } from "./Commands"
import { MAX_MEMBER_COUNT, ALPHABET_TABLE } from "./Def"
import { plainTextCommandAnalyser } from "./Utilis";
import { DBAccesser, User as MyUser, PlayUser, PlayUserUtil, PlayUserVersion, ePlayMode } from "./db";
import { MessageUtil, eMessage } from "./Message";
import { MatchKeysAndValues } from 'mongodb';

// TODO メンバー情報はサーバー単位で保存が必要
// TODO 操作者の確認、作業を飛ばすコマンドが欲しい
//       ⇒ むしろこちらをデフォルトにしたい
// TODO 操作者のメンバー情報を各メンバーに共有できないか
//      ⇒ 操作ごとにメンバーに同じ内容をコピーするというとても荒々しい処理になりそう笑

// TODO 投票で 中のメッセージを修正したりすると面白いか？
// TODO メッセージは組み込みにしたい。本文説明（or 導入メッセージ）<改行> 組み込みメッセージ みたいなフォーマットで。
// TODO 組み込みメッセージで複数をなるべく一つにしたいし、エラーメッセージには色を付けたりした。
// TODO 普通の人狼でも使えるようにしたい
// TODO 名前付きはあくまでも オプションにしたい。
//      ⇒ hide_name オプション common_name role1 role2…
//      ⇒ basic オプション role1 role2
// TODO ゲーム名とチャット名を同時に出す仕様は面倒なので、どちらかが出る仕様としたい。
//      ⇒ 共通名前付き にするなら、ちゃんと共通名前でやり取りして、
//          必要なら議論タイムで名乗るってのがゲームだと思うし。
// TODO controler　は inner と外用で分けたい。例外処理も controlerがわで
// TODO 操作者だけのメッセージは他ユーザーに見えないようにしたい
// TODO 追放者の登録をしたい

const eSendType = {
    sendReply: 1,
    sendReplyByDM: 2,
    sendDMByUserId: 3,
} as const;
type eSendType = (typeof eSendType)[keyof typeof eSendType];

type MessageContent = string | BaseMessageOptions & { addAction?: (rp: Message<boolean>) => Promise<void>, };
type SendParams = {
    type: eSendType,
    user: MyUser,
    sendMessage: MessageContent,
}

const MySuccess = "success";
const MyError = "error";
type MyResult = {
    status: typeof MySuccess | typeof MyError,
    sendList: SendParams[]
}

type asyncGetPlayUesrResult = {
    data: PlayUser,
    getRet: null,
} | {
    data: null,
    getRet: MyResult,
}

class Sender {
    static async asyncReply(message: Message, sendMessage: MessageContent) {
        const rp = await message.reply(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
    static async asyncDM(user: User, sendMessage: MessageContent) {
        const rp = await user.send(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
    static async asyncDM_fromUserId(client: Client, userId: string, sendMessage: MessageContent) {
        const dmChannel = await client.users.createDM(userId);
        const rp = await dmChannel.send(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
    static async asyncSendSameChannel(ch: TextBasedChannel, sendMessage: MessageContent) {
        const rp = await ch.send(sendMessage);
        if (typeof sendMessage === "string")
            return;
        if (sendMessage.addAction)
            await sendMessage.addAction(rp);
    }
}

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
        console.log('bot MyDB connected!');
    }

    processCommand = async (client: Client, interaction: Interaction) => {
        if (!interaction.isCommand())
            return;

        // 自分の反応やBOTの反応は無視する
        if (!MyFuncs.isUnresponsiveMessage(client, interaction.user, interaction.guild, false))
            return;

        if (!isMyCommand(interaction.commandName))
            return;

        // --- コマンド解析

        let mentionUsers: MyUser[] = [];

        // 先に平文のコマンドでの動作を整備していたためそちらに合わせる。
        // 平文のコマンドにコンバート
        let plainTextCommand = "/" + interaction.commandName;
        for (const opt of interaction.options.data) {
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "edit") {
                if (!opt.options) {
                    continue;
                }
                for (const subopt of opt.options) {
                    if (subopt.type == ApplicationCommandOptionType.User) {
                        const userid = <string>subopt.value;
                        const name = (await client.users.fetch(userid)).displayName;
                        mentionUsers.push({
                            id: userid,
                            name: name,
                        });
                    }
                }
            }
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "again") {
                // 引数無し
            }
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "send") {
                if (!opt.options) {
                    continue;
                }
                for (const subopt of opt.options) {
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name == "name") {
                        plainTextCommand += " " + subopt.value;
                    }
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name.match(/^role/)) {
                        plainTextCommand += " " + subopt.value;
                    }
                }
            }
        }
        console.log("converted to plainTextCommand. \n" + plainTextCommand);

        // Discord API の仕様上 3秒以内に何らかのレスポンスを返す必要あり
        // 考え中的なレスポンスを返す
        await interaction.reply("*応答中…*");

        let result: MyResult;
        try {
            result = await this.processPlaneTextCommand(plainTextCommand, interaction.user, interaction.channel!, mentionUsers);
        }
        finally {
            await interaction.editReply("------")
                .catch(console.error);
        }

        // 結果に基づき処理
        this.processResultObj(result, client, interaction.user, interaction.channel!);
    }

    processMessage = async (client: Client, message: Message) => {
        // 自分の反応やBOTの反応は無視する
        if (!MyFuncs.isUnresponsiveMessage(client, message.author, message.guild, false))
            return;

        const plainTextCommand = message.content;
        let mentionUsers: MyUser[] = message.mentions.users.map(itr => {
            return {
                id: itr.id,
                name: itr.displayName,
            }
        });

        // コマンド処理
        let result = await this.processPlaneTextCommand(plainTextCommand, message.author, message.channel, mentionUsers);

        // 結果に基づき処理
        this.processResultObj(result, client, message.author, message.channel);
    }

    processReaction = async (
        client: Client,
        lastReaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser
    ): Promise<void> => {

        // 自分の反応やBOTの反応は無視する
        if (!MyFuncs.isUnresponsiveMessage(client, user, lastReaction.message.guild, false))
            return;

        // BOT自身のメッセージに対する反応で無ければ無視する
        if (lastReaction.message.author == null
            || client.user == null
            || lastReaction.message.author.id != client.user.id) {
            return;
        }

        // BOT自身のメッセージに埋め込みメッセージが無ければ少なくとも投票ではないので無視する
        if (!lastReaction.message.embeds || lastReaction.message.embeds.length != 1)
            return;

        // 埋め込みメッセージのフッタに投票を示す文字列が入っていれば処理する
        const embed = lastReaction.message.embeds[0];
        const voteMsg = [eMessage.C00_VoteOneOnOne, eMessage.C00_VoteAny]
        if (embed.footer == null
            || !voteMsg.some(v => embed.footer!.text.includes(v))
        ) {
            return;
        }

        const getMyCheckReactionsOnCache = async () => {
            const allReactions = lastReaction.message.reactions.cache.map(r => r);
            const myCheckReactions: MessageReaction[] = [];
            for (const r of allReactions) {
                const us = r.users.cache;
                if (us.find(u => u.id == user.id))
                    myCheckReactions.push(r);
            };
            return myCheckReactions;
        }

        if (embed.footer.text == eMessage.C00_VoteOneOnOne) {
            // 一人一票
            // ⇒ 直近のリアクション以外は削除
            const myCheckReactionsOnCache = await getMyCheckReactionsOnCache();
            if (myCheckReactionsOnCache.length <= 1) {
                return;
            }
            for (const r of myCheckReactionsOnCache) {
                if (lastReaction.emoji.identifier != r.emoji.identifier) {
                    await r.users.remove(await user.fetch());
                }
            }
        }
        else {
            // 一人複数票あり
            // ⇒ 何もしない
        }
    }

    processPlaneTextCommand = async (plainTextCommand: string, user: User, channel: TextBasedChannel, users: MyUser[]): Promise<MyResult> => {
        let analyser = new plainTextCommandAnalyser(plainTextCommand);
        let isDM = MyFuncs.isDM(channel);
        let sender: MyUser = {
            id: user.id,
            name: user.displayName,
        }

        switch (analyser.command) {
            case eCommands.Member:
                return await this.updateMember(isDM, sender, users);
            case eCommands.SuggestRole:
                return await this.suggestRole(isDM, sender, analyser);
            case eCommands.SendRole:
                return await this.sendRole(isDM, sender, analyser);
            case eCommands.CreateVote:
                return await this.createVote(isDM, user);
            case eCommands.ClearMemberData:
                return await this.clearUserData(isDM, sender);
            default:
                return {
                    status: MySuccess,
                    sendList: [],
                };
        }
    }

    processResultObj = async (result: MyResult, client: Client, user: User, channel: TextBasedChannel) => {
        // 順番に送信する前提で格納されている場合もあるので
        // 送信ごとに待機する
        let dmFailedUser: MyUser[] = []
        for (const sendObj of result.sendList) {
            switch (sendObj.type) {
                case eSendType.sendReply:
                    await Sender.asyncSendSameChannel(channel, sendObj.sendMessage)
                        .catch(console.error);
                    break;
                case eSendType.sendReplyByDM:
                    await Sender.asyncDM(user, sendObj.sendMessage)
                        .catch(e => Sender.asyncSendSameChannel(channel, MessageUtil.getMessage(eMessage.C00_ReplyDMFailed,)))
                        .catch(console.error);
                    break;
                case eSendType.sendDMByUserId:
                    await Sender.asyncDM_fromUserId(client, sendObj.user.id, sendObj.sendMessage)
                        .catch(e => dmFailedUser.push(sendObj.user));
                    break;
            }
        }
        if (dmFailedUser.length > 0) {
            const unique = dmFailedUser.filter((u, index) => dmFailedUser.findIndex(v => v.id === u.id) === index);
            const memList = unique.map(u => "* " + u.name).join("\n").replace(/\n$/, "");
            await Sender.asyncSendSameChannel(channel, MessageUtil.getMessage(eMessage.C00_OtherDMFailed, memList))
                .catch(console.error);
        }
    }

    insertUserData = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const { data, } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, user,);
        if (data) {
            // データがあったらエラー
            return MyFuncs.createErrorReply(eMessage.C01_AlreadyIns);
        }

        // DBに追加
        const insData: PlayUser = PlayUserUtil.createNewPlayUserObj(user);
        insData.play_mode = ePlayMode.SplaJinro;

        const insRet = (await this.connectedDB.PlayUser.insertOne(insData));
        if (!insRet.acknowledged) {
            return MyFuncs.createErrorReply(eMessage.C01_DBError);
        }

        // 成功メッセージ
        return MyFuncs.createSuccessReply(eMessage.C01_InsertSuccess, user.name);
    }

    updateMember = async (isDM: boolean, user: MyUser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM && inputMenbers.length > 0) {
            // ではだめにする。メンバーのメンションが必要なので
            return MyFuncs.createErrorReply(eMessage.C02_NotAllowFromDM);
        }

        // startGMの結果も入るのであらかじめ作成
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        let { data, } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, user);
        if (!data) {
            // GMで無ければこちらで startGM してしまう
            const resultStartGM = await this.insertUserData(isDM, user);
            if (resultStartGM.status != MySuccess) {
                return resultStartGM;
            }
            result.sendList = resultStartGM.sendList;

            data = (await MyFuncs.asyncGetPlayUesr(this.connectedDB, user)).data;
            if (!data) {
                throw new Error("論理エラー");
            }
        }

        if (inputMenbers.length == 0) {
            // メンションが０人なら参照モード
            if (data.play_data.member_list.length == 0) {
                // 参照したがメンバー０人。メッセージを追加して返却
                result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView_Zero,));
                return result;
            }
            // 現在のメンバーを返却
            let msg = data.play_data.member_list.map(mem =>
                MessageUtil.getMessage(eMessage.C02_inner_MemberFormat, mem.name)
            ).join("\n");
            result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView, msg));
            return result;
        }

        // ---追加・削除モード
        // 既存メンバーと入力値メンバを重複無しで配列化
        const unique = new Set(data.play_data.member_list.concat(inputMenbers));
        const concatMember = [...unique];

        // "追加"・"削除"・"変わらず"、のフラグ振り分け
        let workMemberList: { member: MyUser, status: "add" | "delete" | "none" }[] = [];
        concatMember.forEach(cctMen => {
            const existing = data!.play_data.member_list.some(exsMem => exsMem.id == cctMen.id);
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
        let newMember = workMemberList
            .filter(workMem => workMem.status != "delete")
            .map(wMem => wMem.member);

        // ここで メンバー名の空白を _ アンスコ に置換しておく
        for (let i = 0; i < newMember.length; i++) {
            newMember[i].name = newMember[i].name.replace(/[ 　]+/, "_");
        }

        // TODO ロール決めの際の他の文字も空白はアンスコにしないと駄目そう？
        const updSuccess = await MyFuncs.asyncUpdatePlayUser(this.connectedDB, user, {
            'play_data.member_list': newMember,
        });

        if (!updSuccess) {
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

    suggestRole = async (isDM: boolean, user: MyUser, orgCmd: plainTextCommandAnalyser): Promise<MyResult> => {
        if (isDM) {
            // DMからでもOK
            console.log("dmで受信");
        }

        // ユーザーデータ取得
        let { data, getRet } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, user,
            eMessage.C03_MemberNothing,)
        if (!data) {
            // GMで無ければメンバー追加へ誘導（メンバー追加コマンドでGMになれるので、ここではGMにさせてあげない）
            return getRet!;
        }

        // 複数のメッセージが入る場合があるので先に作っておく
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        // --checkオプションがあるかどうか控えておく
        // TODO --check は定数にしたい
        let checkOptExists = orgCmd.getOptions().some(opt => opt == "--check");

        // コマンドチェック
        let cmd = orgCmd;
        let uesPredata = false;
        if (cmd.getValue(0, 1) == null) {
            // 引数が１個も無い場合は前回のデータを採用
            uesPredata = true;
            cmd = new plainTextCommandAnalyser(data?.play_data.prevSuggestRoleCommandString ?? "");
            if (cmd.isEmpty()) {
                return MyFuncs.createErrorReply(eMessage.C03_NonAgainData,);
            }
        }
        // コマンドチェックつづき
        // 前回データの利用だからといってエラーにならないわけでは無い
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

        if (uesPredata) {
            result.sendList.push(MyFuncs.createReply(
                eMessage.C03_UsePredata,
                theName,
                roleNameList.join("、")))
        }

        // メンバーチェック
        if (data.play_data.member_list.length == 0) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_MemberNothing,))
            return result;
        }
        if (data.play_data.member_list.length < roleNameList.length) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(
                eMessage.C03_MemberFew,
                roleNameList.length,
                data.play_data.member_list.length));
            return result;
        }

        // ---ロール割り振り作成

        // 村人を初期値にして、役職ごとにランダムでメンバーに割り振り
        let workMemberList: { member: MyUser, dispName: string, role: string }[]
            = data.play_data.member_list.map(mem => { return { member: mem, dispName: "", role: "村人" }; });
        roleNameList.forEach(role => {
            let hitIdx = 999;
            do {
                hitIdx = MyFuncs.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.role ?? "") != "村人"); // 村人でなければ再抽選
            workMemberList[hitIdx].role = role;
        });

        // アルファベットテーブルをランダムに回してメンバーに割り振り
        let alpList = ALPHABET_TABLE.concat();
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

        // --- 文字列化
        let memberRoleStr = "";

        // 見易くなるよう文字幅調整用の数を求める
        let roleMaxlen = Math.max(...roleNameList.map(v => v.length));

        memberRoleStr = workMemberList.map(obj =>
            MessageUtil.getMessage(eMessage.C03_inner_MemberFormat,
                obj.dispName,
                obj.role.padEnd(roleMaxlen, "　"), // 役職は全角だろうという前提で文字幅調整
                obj.member.name),
        ).join("\n");

        // とりあえず 知らせるオプションの規定値を設定しておく
        let option = MessageUtil.getMessage(
            eMessage.C03_inner_1_know_to_0, "人狼", "狂人");

        // sendRole用の平文のコマンドを作成
        const planeTextForSnedRole = MessageUtil.getMessage(
            eMessage.C03_SuggestMember,
            eCommands.SendRole,
            memberRoleStr,
            option);
        
        // --checkオプションが無ければ、確認なしで各メンバーにDMする
        if (!checkOptExists) {
            // sendRoleに渡す
            const sendRoleRet = await this.sendRole(
                true,/*trueにしてDMから送っていることにする*/ 
                user,
                new plainTextCommandAnalyser(planeTextForSnedRole));
            if (sendRoleRet.status == 'error') {
                return sendRoleRet;
            }
            // 成功時のレスポンスを追加
            sendRoleRet.sendList.forEach(snedParam => {
                result.sendList.push(snedParam);
            });
        }
        else {
            // --checkオプションがある場合
            // メッセージに sendRole用コマンドを含める
            result.sendList.push(
                MyFuncs.createReplyDM(eMessage.C03_SuggestMemberExplain),
                MyFuncs.createReplyDM(planeTextForSnedRole),
            );

            if (!isDM) {
                result.sendList.push(
                    MyFuncs.createReply(eMessage.C00_ReplyDM),
                );
            }
        }

        if (!uesPredata) {
            // 今回のパラメータを記憶
            const updSuccess = await MyFuncs.asyncUpdatePlayUser(this.connectedDB, user, {
                'play_data.prevSuggestRoleCommandString': cmd.orgString,
            });
            // これがDBエラーでもメイン処理に弊害は無いのでログだけにする
            if (!updSuccess) {
                console.log("play_data.prevSuggestRoleCommandString update failed. player_id:" + user.id);
            }
        }
        return result;
    }

    sendRole = async (isDM: boolean, user: MyUser, orgCmd: plainTextCommandAnalyser): Promise<MyResult> => {
        if (!isDM) {
            // DMで送らないと視えちゃうのでだめ
            return MyFuncs.createErrorReply(eMessage.C04_NeedDM);
        }

        // ユーザーデータ取得
        let { data, getRet } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, user,);
        if (!data || data.play_data.member_list.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberNothing,);
        }

        // コマンドチェック
        let cmd = orgCmd;
        if (cmd.getValue(1, 0) == null) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberArgNothing,);
        }

        if ((cmd.getLineNum() - 1) < data.play_data.member_list.length) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberArgNonMatch, eCommands.SuggestRole);
        }

        // コマンド情報：メンバー部分 のパース
        const memberRoleDef = cmd.parseMemberRoleDef(data.play_data.member_list);

        // 現在登録されているメンバーがコマンドに入って無ければエラー
        if (data.play_data.member_list.length != memberRoleDef.length) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberArgNonMatch, eCommands.SuggestRole);
        }

        // オプション情報
        let option: {
            targetRole: string,
            action: "canknow",
            complement: string,
        }[] = [];

        // コマンド行 + メンバー行 の次にオプション行
        const optStartIdx = 1 + memberRoleDef.length;
        for (let i = optStartIdx; i < cmd.getLineNum(); i++) {
            const strOpt = <string>cmd.getValue(i, 0);
            const sepalate = MessageUtil.getMessage(eMessage.C03_inner_1_know_to_0, "", "");
            const optArray = strOpt.split(sepalate);
            if (optArray.length == 2) {
                option.push({
                    targetRole: optArray[1],
                    action: "canknow",
                    complement: optArray[0],
                });
            }
        }

        // 送信コマンドを記憶する
        const updSuccess = await MyFuncs.asyncUpdatePlayUser(this.connectedDB, user, {
            'play_data.prevSendRoleCommandString': cmd.orgString,
        });
        if (!updSuccess) {
            return MyFuncs.createErrorReply(eMessage.C04_DBError,);
        }

        // 各メンバーにDM
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        };

        for (const mem of memberRoleDef) {
            result.sendList.push(
                MyFuncs.createDMToOtherUser(
                    mem,
                    eMessage.C04_SendRoleTmpl,
                    mem.theName, mem.role
                )
            );
        }

        // オプションの処理
        for (const opt of option) {
            if (opt.action == "canknow") {
                // △△に◆◆の役職を伝えるオプション
                for (const mem of memberRoleDef.filter(mem => mem.role == opt.targetRole)) {
                    result.sendList.push(
                        MyFuncs.createDMToOtherUser(
                            mem,
                            eMessage.C04_SendKnowTmpl,
                            mem.role,
                            opt.complement,
                            memberRoleDef
                                .filter(m => m.role == opt.complement)
                                .map(m => `${m.theName}(${m.name})`).join("、 "),
                        )
                    );
                }
            }
        }

        // 送信成功を伝えるDM
        result.sendList.push(MyFuncs.createReply(eMessage.C04_DMSuccess,));
        return result;
    }

    /**
     * 投票作成
     * @param isDM 
     * @param user 
     * @returns 
     */
    createVote = async (isDM: boolean, user: User): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(eMessage.C05_NotAllowFromDM);
        }

        // ユーザーデータ取得
        const { data, getRet } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, { id: user.id, name: user.displayName },
            eMessage.C05_MemberNothing,);
        if (!data) {
            return getRet!;
        }
        if (!data.play_data.prevSendRoleCommandString) {
            return MyFuncs.createErrorReply(eMessage.C05_RoleDataNothing);
        }

        // 前回のメンバー通知コマンドをパース
        const memberRoleDef = new plainTextCommandAnalyser(data.play_data.prevSendRoleCommandString)
            .parseMemberRoleDef(data.play_data.member_list);

        if (memberRoleDef.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C05_RoleDataNothingInData);
        }

        let msg = "";
        memberRoleDef.forEach(memRole => {
            const emoji = MyFuncs.createDiscordAlphabetEmoji(memRole.alphabet);
            msg += `${emoji} ${memRole.theName} (${memRole.name})\n`;
        });

        // 埋め込みメッセージで投票を作成
        const embed = new EmbedBuilder()
            .setColor(Colors.Aqua)
            .setAuthor({
                name: user.displayName,
                iconURL: user.avatarURL() ?? undefined,
            })
            .setTitle('今日は誰を追放しますか？')
            .setDescription(msg)
            .setFooter({ text: MessageUtil.getMessage(eMessage.C00_VoteOneOnOne) })
            .setTimestamp()
            .toJSON();

        return MyFuncs.createSuccessReply({
            embeds: [embed],
            addAction: async (rp: Message<boolean>) => {
                for (const memRole of memberRoleDef) {
                    await rp.react(MyFuncs.createDiscordAlphabetEmoji(memRole.alphabet))
                        .catch(console.error);
                }
            }
        },);
    }

    /**
     * ユーザーデータ削除
     * @param isDM 
     * @param user 
     * @returns 
     */
    clearUserData = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        // ユーザーデータ取得
        const { data, getRet } = await MyFuncs.asyncGetPlayUesr(this.connectedDB, user,);
        if (!data || data.play_data.member_list.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C06_DataNothing,);
        }

        const query = { player_id: user.id };
        const delRet = await this.connectedDB.PlayUser.deleteMany(query);

        if (!delRet.acknowledged || delRet.deletedCount == 0) {
            return MyFuncs.createErrorReply(eMessage.C06_DBError,);
        }

        return MyFuncs.createSuccessReply(eMessage.C06_ClearMemberData,);
    }

    static Log = (msg: Message): void => {
        const isDM = MyFuncs.isDM(msg.channel) ? "DM" : "not DM";
        console.log("Recept! msg:%s, sender:%s, DM?:%s", msg.content, msg.author.displayName, isDM)
    }

}


class MyFuncs {
    static isUnresponsiveMessage = (client: Client, user: User | PartialUser, guild: Guild | null, isOutputLog: boolean): boolean => {
        if (user.id == client.user?.id) {
            if (isOutputLog) console.log("これは私")
            return false;
        }
        if (user.bot) {
            if (isOutputLog) console.log("知らないbotとはお話しちゃいけないって言われました");
            return false;
        }
        // 指定のサーバー以外では反応しないようにする
        if (guild != null && !env.allowed_serv.includes(guild.id)) {
            if (isOutputLog) console.log("知らないチャネルだ…");
            return false;
        }
        return true;
    }

    static isDM = (ch: Channel | null) => {
        return ch?.type === ChannelType.DM;
    }

    static getRandomInt = (max: number): number => {
        return Math.floor(Math.random() * (max + 1));
    }

    static createDiscordAlphabetEmoji(alp: string): string {
        const uint32ToArrayBuffer = (n: number) => {
            const view = new DataView(new ArrayBuffer(4));
            view.setUint32(0, n);
            return view.buffer;
        }

        const arrayBufferToUint32 = (u8Array: Uint8Array) => {
            let u8Array4 = new Uint8Array(4);
            for (let i = 1; i <= u8Array.length; i++) {
                u8Array4[4 - i] = u8Array.slice(-i)[0];
            }
            return new DataView(u8Array4.buffer).getUint32(0);
        }

        const text_encoder = new TextEncoder();
        const text_decoder = new TextDecoder("utf-8");

        const twemojiA = [0xf0, 0x9f, 0x87, 0xa6];
        const twemojiANum = arrayBufferToUint32(Uint8Array.from(twemojiA));

        const stringANum = arrayBufferToUint32(text_encoder.encode("a"));
        const inputNum = arrayBufferToUint32(text_encoder.encode(alp.slice(0, 1).toLowerCase()));
        const alpIndex = inputNum - stringANum;

        const twemojiOutNum = twemojiANum + alpIndex;
        const twemojiOut = text_decoder.decode(uint32ToArrayBuffer(twemojiOutNum));

        return twemojiOut;
    }

    //#region DBユーティリティ

    /**
     * データを取得する
     * データのバージョンがソースと異なる場合はデータをクリアする
     * @param connectedDB 
     * @param user 
     * @returns 
     */
    static async asyncGetPlayUesr(
        connectedDB: DBAccesser,
        user: MyUser,
        nodataMsg: eMessage = eMessage.C00_NoData,
        notSameVersionMsg: eMessage = eMessage.C00_DataVersionNotSame,
    ): Promise<asyncGetPlayUesrResult> {
        const query = { player_id: user.id };
        let data = (await connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data) {
            return { data: null, getRet: MyFuncs.createErrorReply(nodataMsg) };
        }
        if (data.version != PlayUserVersion) {
            const delRet = await connectedDB.PlayUser.deleteMany(query);
            return { data: null, getRet: MyFuncs.createErrorReply(notSameVersionMsg) };
        }
        return { data: data, getRet: null };
    }

    static async asyncUpdatePlayUser(connectedDB: DBAccesser, user: MyUser, updateQuery: MatchKeysAndValues<PlayUser>): Promise<boolean> {
        const query = { player_id: user.id };
        const updRet = (await connectedDB.PlayUser.updateOne(
            query,
            {
                $set: updateQuery,
                $currentDate: {
                    player_last_ope_datatime: true,
                },
            },
        ));
        if (!updRet.acknowledged || updRet.modifiedCount == 0) {
            return false;
        }
        return true;
    }
    //#endregion

    //#region  リザルト作成ユーティリティ
    static updateMessageContent(msg: eMessage | MessageContent, ...args: unknown[]) {
        if (typeof msg === "string")
            msg = MessageUtil.getMessage(msg, ...args);
        else if (msg.content)
            msg.content = MessageUtil.getMessage(msg.content, ...args);
        return msg;
    }

    static createReply = (msg: eMessage | MessageContent, ...args: unknown[]): SendParams => {
        return {
            type: eSendType.sendReply,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createReplyDM = (msg: eMessage | MessageContent, ...args: unknown[]): SendParams => {
        return {
            type: eSendType.sendReplyByDM,
            user: { id: "", name: "" },
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createDMToOtherUser = (user: MyUser, msg: eMessage | MessageContent, ...args: unknown[]): SendParams => {
        return {
            type: eSendType.sendDMByUserId,
            user: user,
            sendMessage: MyFuncs.updateMessageContent(msg, ...args),
        };
    }

    static createErrorReply = (msg: eMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MyError,
            sendList: [MyFuncs.createReply(msg, ...args)],
        }
    }
    static createSuccessReply = (msg: eMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createReply(msg, ...args)],
        }
    }
    //#endregion
}
