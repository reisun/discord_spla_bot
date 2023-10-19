import { Client, Channel, User, Message, Interaction, TextBasedChannel, EmbedBuilder, Colors, MessageReaction, PartialMessageReaction, PartialUser, APIEmbed, } from 'discord.js';
import env from "../inc/env.json";
import { MAX_MEMBER_COUNT, ALPHABET_TABLE, eMessage } from "./Const";
import { User as MyUser, SplaJinroData} from "./Model";
import { eCommandOptions, eCommands, interactionCommandParser, isMyCommand, plainTextCommandParser } from "./Commands"
import { Utils } from "./Utilis";
import { DiscordUtils, MessageContent } from "./DiscordUtils";
import { DBAccesser, DBUtils } from "./db";
import { ResultOK } from './Result';

// 操作者の確認、作業を飛ばすコマンドが欲しい？
//       ⇒ むしろこちらをデフォルトにしたい…が、つまりそれはGMをBOTがやるということになり
//       ゲーム進行を全て管理する必要がでてくるので、状態を知らせるコマンドが多数必要
//       また、ゲームのアレンジにも弱い

// 操作者のメンバー情報を各メンバーに共有できないか
//      ⇒ 操作ごとにメンバーに同じ内容をコピーするというとても荒々しい処理になりそう笑
//      ⇒ ボイチャにデータを持たせればイイじゃない…
//      ⇒ 反映済み

// メンバー登録する際に、同じボイチャにいるメンバーは自動的に登録できるようにしたい
//      ⇒ 初めからこれで良かった説
//      ⇒ てか、操作者別のデータも、チャンネルごとのデータ保存で済むのでは？
//      ⇒ これだったっぽい
//      ⇒ 反映済み

// TODO 追放者の登録をしたい
// TODO 刷新したREADMEの内容に合わせて改修
//  /spj_send_role_option
//  /spj_eject
//  /spj_member （人狼参加者と、ボイスチャンネルに居るが参加者でない人、を表示）

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

const eSendType = {
    sendReply: 1,
    sendReplyByDM: 2,
    sendDMByUserId: 3,
    sendSameChannel: 4,
} as const;
type eSendType = (typeof eSendType)[keyof typeof eSendType];

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
        if (!DiscordUtils.isUnresponsiveMessage(client, interaction.user, interaction.guild, env.allowed_serv, false))
            return;

        if (!isMyCommand(interaction.commandName))
            return;

        // Discord API の仕様上 3秒以内に何らかのレスポンスを返す必要あり
        // 考え中的なレスポンスを返す
        await interaction.reply( {content: "*応答中…*", ephemeral: true})
            .catch(console.error);

        // --- コマンド解析

        // 先に平文のコマンドでの動作を整備していたためそちらに合わせる。
        // 平文のコマンドにコンバート
        const {plainTextCommand, mentionUsers} = await interactionCommandParser.asyncCconvertPlaneTextCommand(client, interaction);
        // console.log("converted to plainTextCommand. \n" + plainTextCommand);

        let result: MyResult;
        try {
            result = await this.processPlaneTextCommand(plainTextCommand, interaction.user, interaction.channel!, mentionUsers);
        }
        finally {
            await interaction.deleteReply()
                .catch(console.error);
            // await DiscordUtils.asyncReply(interaction.channel!, interaction.user, plainTextCommand)
            //     .catch(console.error);
        }

        // 結果に基づき処理
        this.processResultObj(result, client, interaction.user, interaction.channel!);
    }

    processMessage = async (client: Client, message: Message) => {
        // 自分の反応やBOTの反応は無視する
        if (!DiscordUtils.isUnresponsiveMessage(client, message.author, message.guild, env.allowed_serv, false))
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
        if (!DiscordUtils.isUnresponsiveMessage(client, user, lastReaction.message.guild, env.allowed_serv, false))
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
        let cmdParser = new plainTextCommandParser(plainTextCommand);
        let isDM = DiscordUtils.isDM(channel);
        let sender: MyUser = {
            id: user.id,
            name: user.displayName,
        }

        switch (cmdParser.command) {
            case eCommands.Member:
                return await this.updateMember(isDM, channel.id, channel, sender, users);
            case eCommands.SuggestRole:
                return await this.suggestRole(isDM, channel.id, channel, sender, cmdParser);
            case eCommands.SendRole:
                return await this.sendRole(isDM, channel.client, sender, cmdParser, true/* コマンドが送られている=>GMが送っていると判断 */);
            case eCommands.CreateVote:
                return await this.createVote(isDM, channel.id, channel, sender, user);
            case eCommands.ClearMemberData:
                return await this.clearData(isDM, channel.id);
            case eCommands.TeamBuilder:
                return await this.buildTeam(isDM, channel.id, channel, sender);
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
                    await DiscordUtils.asyncReply(channel, user, sendObj.sendMessage)
                        .catch(console.error);
                    break;
                case eSendType.sendReplyByDM:
                    await DiscordUtils.asyncDM(user, sendObj.sendMessage)
                        .catch(e => DiscordUtils.asyncReply(channel, user, Utils.format(eMessage.C00_ReplyDMFailed,)))
                        .catch(console.error);
                    break;
                case eSendType.sendDMByUserId:
                    await DiscordUtils.asyncDM_fromUserId(client, sendObj.user.id, sendObj.sendMessage)
                        .catch(e => dmFailedUser.push(sendObj.user));
                    break;
                case eSendType.sendSameChannel:
                    await DiscordUtils.asyncSendSameChannel(channel, sendObj.sendMessage)
                        .catch(console.error);
                    break;
            }
        }
        if (dmFailedUser.length > 0) {
            const unique = Utils.unique(dmFailedUser, v => v.id);
            const memList = unique.map(u => "* " + u.name).join("\n").replace(/\n$/, "");
            await DiscordUtils.asyncReply(channel, user, Utils.format(eMessage.C00_OtherDMFailed, memList))
                .catch(console.error);
        }
    }

    updateMember = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, inputMenbers: MyUser[]): Promise<MyResult> => {
        if (isDM && inputMenbers.length > 0) {
            // ではだめにする。メンバーのメンションが必要なので
            return MyFuncs.createErrorReply(eMessage.C02_NotAllowFromDM);
        }

        // startGMの結果も入るのであらかじめ作成
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        let memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false);
        if (inputMenbers.length == 0) {
            // メンションが０人なら参照モード
            if (memberList.length == 0) {
                // 参照したがメンバー０人。メッセージを追加して返却
                result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView_Zero,));
                return result;
            }
            // 現在のメンバーを返却
            let msg = memberList.map(mem =>
                Utils.format(eMessage.C02_inner_MemberFormat, mem.name)
            ).join("\n");
            result.sendList.push(MyFuncs.createReply(eMessage.C02_MemberView, msg));
            return result;
        }

        // ---追加・削除モード
        // 既存メンバーと入力値メンバを重複無しで配列化
        const concatMemberList = Utils.unique(memberList.concat(inputMenbers), v => v.id);
        // "追加"・"削除"・"変わらず"、のフラグを付ける
        let concatMemberListWithFlag: { member: MyUser, status: "add" | "delete" | "none" }[] = [];
        concatMemberList.forEach(cctMen => {
            const existing = memberList.some(orgMem => orgMem.id == cctMen.id);
            const isInInput = inputMenbers.some(inpMem => inpMem.id == cctMen.id);
            // 既存メンバーにいる かつ 入力にもいた ⇒ 削除
            if (existing && isInInput) {
                concatMemberListWithFlag.push({ member: cctMen, status: "delete" });
            }
            // 既存メンバーにいない かつ 入力にいた ⇒ 追加
            else if (!existing && isInInput) {
                concatMemberListWithFlag.push({ member: cctMen, status: "add" });
            }
            // 既存メンバーにいる かつ 入力にいない ⇒ そのまま
            else if (existing && !isInInput) {
                // ボイスチャンネル以外の場合は、何もしないと元のメンバーがいないため情報が消える ⇒ add に加える
                concatMemberListWithFlag.push({ member: cctMen, status: ch.isVoiceBased() ? "none" : "add" });
            }
            // 既存メンバーにいない かつ 入力にいない ⇒ そのまま
            else {
                concatMemberListWithFlag.push({ member: cctMen, status: "none" });
            }
        });

        // メンバー更新
        const addList = concatMemberListWithFlag
            .filter(workMem => workMem.status == "add")
            .map(wMem => wMem.member);

        const ignoreList = concatMemberListWithFlag
            .filter(workMem => workMem.status == "delete")
            .map(wMem => wMem.member);

        // ここで メンバー名の空白を _ アンスコ に置換しておく
        for (let i = 0; i < addList.length; i++) {
            addList[i].name = addList[i].name.replace(/[ 　]+/, "_");
        }
        for (let i = 0; i < ignoreList.length; i++) {
            ignoreList[i].name = ignoreList[i].name.replace(/[ 　]+/, "_");
        }

        const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
            'add_member_list': addList,
            'ignore_member_list': ignoreList,
        });

        if (!updSuccess) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C02_DBError,));
            return result;
        }

        // 参照モードを利用して最終的なメンバーのメッセージを取得し、返信に追加
        (await this.updateMember(isDM, channelId, ch, sender, [])).sendList.forEach(sendObj => {
            result.sendList.push(sendObj);
        });
        return result;
    }

    suggestRole = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, orgCmd: plainTextCommandParser): Promise<MyResult> => {
        if (isDM) {
            // DMからでもOK
            console.log("dmで受信");
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,)
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        // 複数のメッセージが入る場合があるので先に作っておく
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        }

        // --no-checkオプションがあるかどうか控えておく
        // TODO --no-check は定数にしたい
        let noCheckOptExists = orgCmd.getOptions().some(opt => opt == eCommandOptions.nocheck);

        // コマンドチェック
        let cmd = orgCmd;
        let uesPredata = false;
        if (cmd.getValue(0, 1) == null) {
            // 引数が１個も無い場合は前回のデータを採用
            uesPredata = true;
            cmd = new plainTextCommandParser(data.prevSuggestRoleCommandString ?? "");
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
            result.sendList.push(MyFuncs.createReply(eMessage.C03_ToMany, MAX_MEMBER_COUNT))
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
        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, !noCheckOptExists);
        if (memberList.length == 0) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_MemberNothing,))
            return result;
        }
        // メンバー多すぎ問題
        if (memberList.length > MAX_MEMBER_COUNT) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(eMessage.C03_ToMany, MAX_MEMBER_COUNT));
            return result;
        }
        if (memberList.length < roleNameList.length) {
            result.status = MyError;
            result.sendList.push(MyFuncs.createReply(
                eMessage.C03_MemberFew,
                roleNameList.length,
                memberList.length));
            return result;
        }

        // ---ロール割り振り作成

        // 村人を初期値にして、役職ごとにランダムでメンバーに割り振り
        let workMemberList: { member: MyUser, dispName: string, role: string }[]
            = memberList.map(mem => { return { member: mem, dispName: "", role: "村人" }; });
        roleNameList.forEach(role => {
            let hitIdx = 999;
            do {
                hitIdx = Utils.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.role ?? "") != "村人"); // 村人でなければ再抽選
            workMemberList[hitIdx].role = role;
        });

        // アルファベットテーブルをランダムに回してメンバーに割り振り
        let alpList = ALPHABET_TABLE.concat();
        for (let i = 0; Utils.getRandomInt(alpList.length); i++) {
            alpList.push(alpList.shift()!);
        }
        alpList = alpList.slice(0, workMemberList.length);

        // メンバーにランダムに割り当て
        alpList.forEach(alp => {
            let hitIdx = 999;
            do {
                hitIdx = Utils.getRandomInt(workMemberList.length - 1);
            } while ((workMemberList.at(hitIdx)?.dispName ?? "-1") != ""); // 空で無ければ再抽選
            workMemberList[hitIdx].dispName = theName + alp;
        });

        // --- 文字列化
        let memberRoleStr = "";

        // 見易くなるよう文字幅調整用の数を求める
        let roleMaxlen = Math.max(...roleNameList.map(v => v.length));

        memberRoleStr = workMemberList.map(obj =>
            Utils.format(eMessage.C03_inner_MemberFormat,
                obj.dispName,
                obj.role.padEnd(roleMaxlen, "　"), // 役職は全角だろうという前提で文字幅調整
                obj.member.name),
        ).join("\n");

        // とりあえず 知らせるオプションの規定値を設定しておく
        let option = Utils.format(
            eMessage.C03_inner_1_know_to_0, "人狼", "狂人");

        // sendRole用の平文のコマンドを作成
        const planeTextForSnedRole = Utils.format(
            eMessage.C03_SuggestMember,
            eCommands.SendRole,
            ch.id,
            memberRoleStr,
            option);

        // --no-checkオプションがあるなら、確認なしで各メンバーにDMする
        if (noCheckOptExists) {
            // sendRoleに渡す
            const sendRoleRet = await this.sendRole(
                true,/*trueにしてDMから送っていることにする*/
                ch.client,
                sender,
                new plainTextCommandParser(planeTextForSnedRole),
                false, /* isSenderRoleChecked */
            );
            if (sendRoleRet.status == 'error') {
                return sendRoleRet;
            }
            // 成功時のレスポンスを追加
            sendRoleRet.sendList.forEach(snedParam => {
                result.sendList.push(snedParam);
            });
        }
        else {
            // --no-checkオプションがない場合
            // メッセージに sendRole用コマンドを含める
            result.sendList.push(
                MyFuncs.createReplyDM(eMessage.C03_SuggestMemberExplain),
                MyFuncs.createReplyDM(planeTextForSnedRole),
            );
        }

        if (!uesPredata) {
            // 今回のパラメータを記憶
            const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
                'prevSuggestRoleCommandString': cmd.orgString,
            });
            // これがDBエラーでもメイン処理に弊害は無いのでログだけにする
            if (!updSuccess) {
                console.log("prevSuggestRoleCommandString update failed. channelid:" + channelId);
            }
        }
        return result;
    }

    sendRole = async (isDM: boolean, client: Client, sender: MyUser, cmd: plainTextCommandParser, isSenderRoleChecked: boolean): Promise<MyResult> => {
        if (!isDM) {
            // DMで送らないと視えちゃうのでだめ
            return MyFuncs.createErrorReply(eMessage.C04_NeedDM);
        }

        // コマンドチェック
        const channelId = cmd.getValue(1, 0);
        if (channelId == null) {
            return MyFuncs.createErrorReply(eMessage.C04_ChannelIdArgNothing,);
        }

        if (cmd.getValue(2, 0) == null) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberArgNothing,);
        }

        // メンバー情報を取得するため、人狼部屋のチャンネルを取得
        const ch = await client.channels.fetch(channelId).catch(() => console.log("invalid channel id. [" + channelId + "]"));
        if (!ch || ch.isDMBased() || !env.allowed_serv.includes(ch.guildId)) {
            return MyFuncs.createErrorReply(eMessage.C04_InvalidChannelId,);
        }

        // メンバー取得
        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, isSenderRoleChecked);
        if (memberList.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C04_MemberNothing,);
        }

        // コマンド情報から、メンバー情報とオプションをパース
        const {memberRoleList, option} = cmd.parseMemberRoleSetting(memberList);

        // メンバーより少ない分には良しとする。参加者以外がメンバーに入っている場合はエラー
        if (memberRoleList.some(mr => !memberList.some(m => m.id == mr.id))) {
            return MyFuncs.createErrorReply(eMessage.C04_UnknownMemberContain, eCommands.SuggestRole);
        }

        // 送信コマンドを記憶する
        const updSuccess = await this.connectedDB.asyncUpdateSplaJinroData(channelId, {
            'prevSendRoleCommandString': cmd.orgString,
        });
        if (!updSuccess) {
            return MyFuncs.createErrorReply(eMessage.C04_DBError,);
        }

        // 各メンバーにDM
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        };

        for (const mem of memberRoleList) {
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
                for (const mem of memberRoleList.filter(mem => mem.role == opt.targetRole)) {
                    result.sendList.push(
                        MyFuncs.createDMToOtherUser(
                            mem,
                            eMessage.C04_SendKnowTmpl,
                            mem.role,
                            opt.complement,
                            memberRoleList
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
    createVote = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser, user: User): Promise<MyResult> => {
        if (isDM) {
            return MyFuncs.createErrorReply(eMessage.C05_NotAllowFromDM);
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            return MyFuncs.createErrorReply(status);
        }

        if (!data.prevSendRoleCommandString) {
            return MyFuncs.createErrorReply(eMessage.C05_RoleDataNothing);
        }

        // isSenderRoleChecked(=GMかどうか) は 両方受けれるように false にしておく。
        // GMがいた場合でも、役職コマンドにGMがいなければ、後続処理で投票には出てこないので良しとする。
        const memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false/* isSenderRoleChecked */);

        // 前回のメンバー通知コマンドをパース
        const {memberRoleList, option} = new plainTextCommandParser(data.prevSendRoleCommandString)
            .parseMemberRoleSetting(memberList);

        if (memberRoleList.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C05_RoleDataNothingInData);
        }

        let msg = "";
        memberRoleList.forEach(memRole => {
            const emoji = DiscordUtils.createDiscordAlphabetEmoji(memRole.alphabet);
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
            .setFooter({ text: Utils.format(eMessage.C00_VoteOneOnOne) })
            .setTimestamp()
            .toJSON();

        return MyFuncs.createSuccessSendSameChannel({
            embeds: [embed],
            addAction: async (rp: Message<boolean>) => {
                for (const memRole of memberRoleList) {
                    await rp.react(DiscordUtils.createDiscordAlphabetEmoji(memRole.alphabet))
                        .catch(console.error);
                }
            }
        },);
    }

    /**
     * データ削除
     * @param isDM 
     * @param user 
     * @returns 
     */
    clearData = async (isDM: boolean, channelId: string): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId,);
        if (!data) {
            return MyFuncs.createErrorReply(eMessage.C06_DataNothing,);
        }

        const delSuccess = await this.connectedDB.asyncDeleteSplaJinroData(channelId);
        if (!delSuccess) {
            return MyFuncs.createErrorReply(eMessage.C06_DBError,);
        }

        return MyFuncs.createSuccessReply(eMessage.C06_ClearMemberData,);
    }


    buildTeam = async (isDM: boolean, channelId: string, ch: Channel, sender: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        // メンバーの取得
        let memberList = [];
        const { status, value: data } = await this.connectedDB.asyncSelectSplaJinroDataForce(channelId);
        if (status != ResultOK) {
            memberList = MyFuncs.getSplaJinroMemberList(DBUtils.createNewSplaJinroDataObj(channelId), ch, sender, false);
        }
        else {
            memberList = MyFuncs.getSplaJinroMemberList(data, ch, sender, false);
        }

        if (memberList.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C07_MemberNotFound);
        }

        let teamA: string[] = [];
        let teamB: string[] = [];
        let other: string[] = [];

        // ランダムで一つ取り出す
        let members_work = memberList.concat(); // コピー
        const picMember = (): MyUser | undefined => {
            if (members_work.length <= 0) {
                return undefined;
            }
            // ランダムで一つ取り出す
            let i = Utils.getRandomInt(members_work.length - 1);
            const mem = members_work[i];
            // 取り出されたらフィルターで除く
            members_work = members_work.filter((v, idx) => idx != i).map(v => v);
            return mem;
        };

        const max = Math.min(4, Math.ceil(memberList.length / 2));
        let mem = picMember();
        while (mem && teamA.length < max) {
            teamA.push(mem.name);
            mem = picMember();
        }
        while (mem && teamB.length < max) {
            teamB.push(mem.name)
            mem = picMember();
        }
        while (mem) {
            other.push(mem.name);
            mem = picMember();
        }

        // 埋め込みメッセージでチームを表示
        const embedA = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Aチーム！')
            .setDescription(teamA.length == 0 ? "メンバー無し" : teamA.join("\n"))
            .toJSON();

        const embedB = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Bチーム！')
            .setDescription(teamB.length == 0 ? "メンバー無し" : teamB.join("\n"))
            .toJSON();

        let embeds: APIEmbed[] = [embedA, embedB];

        if (other.length > 0) {
            const embedOther = new EmbedBuilder()
                .setColor(Colors.Grey)
                .setTitle('観戦・休憩')
                .setDescription(other.join("\n"))
                .toJSON();
            embeds.push(embedOther);
        }

        return MyFuncs.createSuccessSendSameChannel({ embeds: embeds, },);
    }

    static Log = (msg: Message): void => {
        const isDM = DiscordUtils.isDM(msg.channel) ? "DM" : "not DM";
        console.log("Recept! msg:%s, sender:%s, DM?:%s", msg.content, msg.author.displayName, isDM)
    }

}

/**
 * 当処理の頻出箇所まとめ
 */
class MyFuncs {
    //#region  専用リザルト関連
    private static updateMessageContent(msg: eMessage | MessageContent, ...args: unknown[]) {
        if (typeof msg === "string")
            msg = Utils.format(msg, ...args);
        else if (msg.content)
            msg.content = Utils.format(msg.content, ...args);
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

    static createSendSameChannel = (msg: eMessage | MessageContent, ...args: unknown[]): SendParams => {
        return {
            type: eSendType.sendSameChannel,
            user: { id: "", name: "" },
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
    static createSuccessSendSameChannel = (msg: eMessage | MessageContent, ...args: unknown[]): MyResult => {
        return {
            status: MySuccess,
            sendList: [MyFuncs.createSendSameChannel(msg, ...args)],
        }
    }
    //#endregion

    /**
     * 参加者取得
     * @param data 
     * @param ch 
     * @param sender コマンド送信者
     * @param isSenderRoleChecked 送信者がロールの内容を確認したかどうか(=GMかどうか)
     * @returns 
     */
    static getSplaJinroMemberList(data: SplaJinroData, ch: Channel, sender: MyUser, isSenderRoleChecked: boolean): MyUser[] {
        let members: MyUser[] = [];
        if (ch.isVoiceBased()) {
            ch.members.forEach(m => members.push({ id: m.id, name: m.displayName }));
        }
        data.add_member_list.forEach(adm => members.push(adm));
        members = Utils.unique(members, v => v.id);
        data.ignore_member_list.forEach(igm => {
            members = members.filter(m => m.id != igm.id);
        });
        // コマンド送信者がロールを確認している場合は、GMとみなすため、参加者からは省く
        if (isSenderRoleChecked) {
            members = members.filter(m => m.id != sender.id);
        }
        return members;
    }
}
