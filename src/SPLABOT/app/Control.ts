import { Client, Channel, User, Message, ChannelType, Interaction, TextChannel, DMChannel, TextBasedChannel, ApplicationCommandOptionType, ApplicationCommandOptionBase, ApplicationCommandType } from 'discord.js';
import env from "../inc/env.json";
import { EnumTypeGuard, MAX_MEMBER_COUNT, eCommands } from "./Def"
import { CommandMessageAnalysis as CommandMessageAnalyser } from "./Utilis";
import { DBAccesser, User as MyUser, PlayUser, ePlayMode } from "./db";
import { MessageUtil, eMessage } from "./Message";

// TODO 投票は quick poll に渡すけど、自分であれこれやった方が面白そうだなぁ… メッセージを修正したりできるし
// TODO メッセージは組み込みにしたい。本文説明（or 導入メッセージ）<改行> 組み込みメッセージ みたいなフォーマットで。
// TODO 組み込みメッセージで複数をなるべく一つにしたいし、エラーメッセージには色を付けたりした。
// TODO 普通の人狼でも使えるようにしたい
// TODO 名前付きはあくまでも オプションにしたい。
//      ⇒ hide_name オプション common_name role1 role2…
//      ⇒ basic オプション role1 role2
// TODO ゲーム名とチャット名を同時に出す仕様は面倒なので、どちらかが出る仕様としたい。
//      ⇒ 共通名前付き にするなら、ちゃんと共通名前でやり取りして、
//          必要なら議論タイムで名乗るってのがゲームだと思うし。
// TODO sendRoleのパラメータチェックが甘いっぽい。一行一行ちゃんとチェックするのが良さそう
//      まずデータの移送を先に済ませてから移送先の変数でチェックしてみよう
// TODO 再起動後はDBの整合性を考えるとグローバルデータ以外は全件削除が良いか？不具合が出たら /spjクリアをしてもらう運用か？
//     再起動後のコメント使いまわしでエラーになるため、プレイヤーIDが代わっている可能性
//     まぁBOT相手でそうなっているだけだから実際の仕様では問題ない……になると予見しているが
// TODO controler　は inner と外用で分けたい。例外処理も controlerがわで

const GLOBAL_USER_DATA = {
    player_id: "-1",
    player: { id: "-1", name: "global" },
    player_last_ope_datatime: new Date(),
    play_mode: ePlayMode.SplaJinro,
    play_data: {
        member_list: [],
        suggestRoleTemplate: `${eCommands.SuggestRole} あきと 人狼 狂人`,
    }
};

const eSendType = {
    sendReply: 1,
    sendReplyByDM: 2,
    sendDMByUserId: 3,
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
        await message.reply(sendMessage);
    }
    static async asyncDM(user: User, sendMessage: string) {
        await user.send(sendMessage);
    }
    static async asyncDM_fromUserId(client: Client, userId: string, sendMessage: string) {
        let dmChannel = await client.users.createDM(userId);
        await dmChannel.send(sendMessage);
    }
    static async asyncSendSameChannel(ch: TextBasedChannel, sendMessage: string) {
        await ch.send(sendMessage);
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
        // グローバルデータが無ければメソッド内で作成してくれるので、これを呼んでおく
        await this.getGlobalData();
        console.log('bot MyDB connected!');
    }

    processCommand = async (client: Client, interaction: Interaction) => {
        if (!interaction.isCommand())
            return;

        if (!EnumTypeGuard.isMyCommands(interaction.commandName))
            return;

        // Discord API の仕様上 3秒以内に何らかのレスポンスを返す必要あり
        // 考え中的なレスポンスを返す
        let waitExists = true;
        await interaction.reply("応答中…");

        console.log("コマンド受付：" + interaction.commandName);
        console.log(interaction.command);

        let isDM = MyFuncs.isDM(interaction.channel);
        let sender: MyUser = {
            id: interaction.user.id,
            name: interaction.user.displayName,
        }
        let mentionUsers: MyUser[] = [];

        let messageCommand = "/" + interaction.commandName;
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
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "create") {
                if (!opt.options) {
                    continue;
                }
                for (const subopt of opt.options) {
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name == "name") {
                        messageCommand += " " + subopt.value;
                    }
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name.match(/^role/)) {
                        messageCommand += " " + subopt.value;
                    }
                }
            }
        }

        let analyser = new CommandMessageAnalyser(messageCommand);
        console.log("restore to messageCommand. \n" + messageCommand);

        let result: MyResult;
        switch (interaction.commandName) {
            case eCommands.Member:
                result = await this.updateMember(isDM, sender, mentionUsers);
                break;
            case eCommands.SuggestRole:
                result = await this.suggestRole(isDM, sender, analyser);
                break;
            case eCommands.SendRole:
                result = await this.sendRole(isDM, sender, analyser);
                break;
            // TODO 投票機能の実装
            case eCommands.CreateVote:
                result = await this.createVote(isDM, sender);
                break;
            case eCommands.ClearMemberData:
                result = await this.clearUserData(isDM, sender);
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
        for (const sendObj of result.sendList) {
            switch (sendObj.type) {
                case eSendType.sendReply:
                    if (waitExists) {
                        waitExists = false;
                        await interaction.editReply(sendObj.sendMessage);
                    }
                    else {
                        await interaction.followUp(sendObj.sendMessage);
                    }
                    break;
                case eSendType.sendReplyByDM:
                    if (waitExists) {
                        waitExists = false;
                        await interaction.editReply("DMにて返信しました。");
                    }
                    await Sender.asyncDM(interaction.user, sendObj.sendMessage);
                    break;
                case eSendType.sendDMByUserId:
                    if (waitExists) {
                        waitExists = false;
                        await interaction.editReply("DMに送信しました。");
                    }
                    await Sender.asyncDM_fromUserId(client, sendObj.userId, sendObj.sendMessage);
                    break;
            }
        }
    }

    processMessage = async (client: Client, message: Message) => {
        if (!MyFuncs.isUnresponsiveMessage(client, message, true))
            return;

        let analyser = new CommandMessageAnalyser(message.content);
        let isDM = MyFuncs.isDM(message.channel);
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
            case eCommands.Member:
                result = await this.updateMember(isDM, sender, mentionUsers);
                break;
            case eCommands.SuggestRole:
                result = await this.suggestRole(isDM, sender, analyser);
                break;
            case eCommands.SendRole:
                result = await this.sendRole(isDM, sender, analyser);
                break;
            //     // TODO 投票機能の実装
            // case eCommands.CreateVote:
            //     result = await this.crewateVote(isDM, sender, analyser);
            //     break;
            case eCommands.ClearMemberData:
                result = await this.clearUserData(isDM, sender);
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
        for (const sendObj of result.sendList) {
            switch (sendObj.type) {
                case eSendType.sendReply:
                    await Sender.asyncReply(message, sendObj.sendMessage);
                    break;
                case eSendType.sendReplyByDM:
                    await Sender.asyncDM(message.author, sendObj.sendMessage);
                    break;
                case eSendType.sendDMByUserId:
                    await Sender.asyncDM_fromUserId(client, sendObj.userId, sendObj.sendMessage);
                    break;
                default:
                    break;
            }
        }
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
                member_list: [],
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
        for (let i = 0; i < newMember.length; i++){
            newMember[i].name = newMember[i].name.replace(/[ 　]+/, "_");
        }

        const updRet = (await this.connectedDB.PlayUser.updateOne(
            query,
            {
                $set: {
                    'play_data.member_list': newMember,
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
        let uesPredata = false;
        if (cmd.getValue(0, 1) == null) {
            // 引数が１個も無い場合は前回のデータを採用
            uesPredata = true;
            cmd = new CommandMessageAnalyser(data?.play_data.suggestRoleTemplate ?? "");
            if (cmd.isEmpty()) {
                return MyFuncs.createErrorReply(eMessage.C03_NonAgainData,);
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

        // ---ロール割り振り提案

        // 全員村人にして、役職ごとにランダムで決定
        let workMemberList: { member: MyUser, dispName: string, role: string }[]
            = data.play_data.member_list.map(mem => { return { member: mem, dispName: "", role: "村人" }; });
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
        let memberRoleStr = "";
        let option = MessageUtil.getMessage(
            eMessage.C03_inner_1_know_to_0, "人狼", "狂人");

        // 文字幅調整
        let roleMaxlen = Math.max(...roleNameList.map(v => v.length));

        memberRoleStr = workMemberList.map(obj =>
            MessageUtil.getMessage(eMessage.C03_inner_MemberFormat,
                obj.dispName,
                obj.role.padEnd(roleMaxlen, "　"), // 役職は全角だろうという前提
                obj.member.name),
        ).join("\n");

        result.sendList.push(
            MyFuncs.createReplyDM(eMessage.C03_SuggestMemberExplain),
            MyFuncs.createReplyDM(
                eMessage.C03_SuggestMember,
                eCommands.SendRole,
                memberRoleStr,
                option),
        );

        if (!uesPredata) {
            // 今回のパラメータを記憶
            const updRet = (await this.connectedDB.PlayUser.updateOne(
                query,
                {
                    $set: {
                        'play_data.suggestRoleTemplate': cmd.orgString,
                    },
                    $currentDate: {
                        player_last_ope_datatime: true,
                    },
                },
            ));
            // これがDBエラーでもメイン処理に弊害は無いのでログだけにする
            if (!updRet.acknowledged || updRet.modifiedCount == 0) {
                console.log("play_data.suggestRoleTemplate update failed. player_id:" + query.player_id);
            }
        }
        return result;
    }

    sendRole = async (isDM: boolean, user: MyUser, orgCmd: CommandMessageAnalyser): Promise<MyResult> => {
        // スラッシュコマンドなら他ユーザーに見えないようにできるのか？
        // ⇒ DM送信の方がその後の手順としても良いか。
        if (!isDM) {
            // DMで送らないと視えちゃうのでだめ
            return MyFuncs.createErrorReply(eMessage.C04_NeedDM);
        }

        // ユーザーデータ取得
        const query = { player_id: user.id };
        let data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data) {
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

        // エラーチェックと合わせて情報を保持してしまう
        let memberRoleDef: {
            id: string,
            name: string,
            theName: string,
            role: string,
        }[] = [];

        for (const dataMem of data.play_data.member_list) {
            for (let i = 1; i < cmd.getLineNum(); i++) {
                if (cmd.getLength(i) != 3)
                    continue;

                const theName = <string>cmd.getValue(i, 0);
                const role = <string>cmd.getValue(i, 1);
                const nameInCmmand = <string>cmd.getValue(i, 2);
                if (dataMem.name != nameInCmmand)
                    continue;

                memberRoleDef.push({
                    id: dataMem.id,
                    name: dataMem.name,
                    theName: theName,
                    role: role,
                });
            }
        }

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

        // 各メンバーにDM
        let result: MyResult = {
            status: MySuccess,
            sendList: [],
        };

        for (const mem of memberRoleDef) {
            result.sendList.push(
                MyFuncs.createDMToOtherUser(
                    mem.id,
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
                            mem.id,
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

    createVote = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM){
            // 投票用のコマンドを作るだけなので DM から送られてもOK
        }

        let result = MyFuncs.createSuccessReply("次のメッセージをコピペしてください。", );
        let msg ="";
        msg += "?expoll [今日は誰を追放しますか？]\n";
        msg += " :regional_indicator_g: テストｇ\n";
        msg += " :regional_indicator_j: テストｊ\n";
        result.sendList.push(MyFuncs.createReply(msg, ));
        return result;
    }

    clearUserData = async (isDM: boolean, user: MyUser): Promise<MyResult> => {
        if (isDM) {
            // でもOK
            console.log("dmで受信");
        }

        // ユーザーデータ取得
        const query = { player_id: user.id };
        let data = (await this.connectedDB.PlayUser.findOne(query)) as PlayUser | null;
        if (!data || data.play_data.member_list.length == 0) {
            return MyFuncs.createErrorReply(eMessage.C06_DataNothing,);
        }

        // メンバーデータを削除
        const updRet = (await this.connectedDB.PlayUser.updateOne(
            query,
            {
                $set: {
                    'play_data.member_list': [],
                },
                $currentDate: {
                    player_last_ope_datatime: true,
                },
            },
        ));

        if (!updRet.acknowledged || updRet.modifiedCount == 0) {
            return MyFuncs.createErrorReply(eMessage.C06_DBError,);
        }

        return MyFuncs.createSuccessReply(eMessage.C06_ClearMemberData,);
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

    static MessageLog = (msg: Message): void => {
        const isDM = MyFuncs.isDM(msg.channel) ? "DM" : "not DM";
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
            if (isOutputLog) console.log(message.content);
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

    static isDM = (ch: Channel | null) => {
        return ch?.type === ChannelType.DM;
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

    static createReplyDM = (msg: eMessage, ...args: unknown[]): {
        type: eSendType,
        userId: string,
        sendMessage: eMessage,
    } => {
        return {
            type: eSendType.sendReplyByDM,
            userId: "",
            sendMessage: MessageUtil.getMessage(msg, ...args),
        };
    }

    static createDMToOtherUser = (id: string, msg: eMessage, ...args: unknown[]): {
        type: eSendType,
        userId: string,
        sendMessage: eMessage,
    } => {
        return {
            type: eSendType.sendDMByUserId,
            userId: id,
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