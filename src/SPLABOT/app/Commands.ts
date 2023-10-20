import {
    ApplicationCommandOptionType,
    Client,
    Interaction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    SlashCommandBuilder,
} from "discord.js";
import "./DiscordExtentions";
import { Utils } from "./Utilis";
import { eMessage } from "./Const";
import { SendMemberRoleOption, MemberRoleInfo, User as MyUser } from "./Model";

// スラッシュコマンドは日本語に非対応……、不都合なことが多すぎないか…あっぁぁん？
// export const eCommands = {
//     Member: "/spjメンバー",
//     SuggestRole: "/spjロール",
//     SendRole: "/spjロールDM送信",
//     CreateVote: "/spj投票",
//     ClearData: "/spjクリア",
// } as const;

// スラッシュコマンドの仕様による制限（経験則）
// 日本語だめ
// 大文字だめ
export const eCommands = {
    Member: "spj_member",
    SuggestRole: "spj_role",
    SendRole: "spj_send_role",
    CreateVote: "spj_vote",
    EjectFromVote: "spj_eject",
    ClearMemberData: "spj_clear",
    TeamBuilder: "spj_team_build",
} as const;
export type eCommands = (typeof eCommands)[keyof typeof eCommands];
export const isMyCommand = (v: any): v is eCommands => Object.values(eCommands).some(elm => elm === v);

export const eCommandOptions = {
    nocheck: "--no-check",
    show: "-show",
    add: "-add",
    delete: "-delete",
}
export type eCommandOptions = (typeof eCommandOptions)[keyof typeof eCommandOptions];

const SUPPORT_OPTION_LIST = [
    { command: eCommands.SuggestRole, opts: [eCommandOptions.nocheck] },
    { command: eCommands.Member, opts: [eCommandOptions.show, eCommandOptions.add, eCommandOptions.delete] },
    { command: eCommands.EjectFromVote, opts: [eCommandOptions.show, eCommandOptions.add, eCommandOptions.delete] }
];

// スラッシュコマンドの型がガチガチ過ぎて、こちらの定義⇒discord.jsの定義への変換が
// めんどくさくてあほらしい…
// 上手い感じに利用しようと考えたがあきらめて
// スラッシュコマンド登録リクエストで使用するBodyの型(???) で定義してしまう
export const COMMAND_JSONBODYS: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
    // .set～() は 加工後の SlashCommandBuilder が戻り値になっているので
    // 数珠つなぎにできるみたい。
    // .set～() の前にオブジェクトが無いのは、数珠つなぎを改行しているから。

    new SlashCommandBuilder()
        .setName(eCommands.Member)
        .setDescription("人狼参加メンバーの追加、削除、参照ができます。")
        .addStringOption(opt => opt
            .setName("option")
            .setDescription("実施する操作を指定します。")
            .setChoices(
                { name: "メンバーの追加", value: eCommandOptions.add },
                { name: "メンバーの削除", value: eCommandOptions.delete },
                { name: "確認のみ", value: eCommandOptions.show },
            )
            .setRequired(true)
        )
        .forEach(Utils.range(1, 9), (build, i) => build
            .addUserOption(opt => opt
                .setName("user" + i)
                .setDescription("追加する（または削除する）ユーザー。未指定の場合は確認のみになります。")
                .setRequired(false)
            )
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.SuggestRole)
        .setDescription("名前・役職の割り振りを作成できます。")
        .addSubcommand(subcmd => subcmd
            .setName("again")
            .setDescription("前回と同じ条件で割り振りを作成できます。\n（このコマンドめんどくさいもんね）")
        )
        .addSubcommand(subcmd => subcmd
            .setName("create")
            .setDescription("指定された内容で参加者に名前・役職を割り振ったリストを作成します。")
            .addStringOption(opt => opt
                .setName("name")
                .setDescription("人狼の際のみんなに付ける共通の名前")
                .setRequired(true)
            )
            .forEach(Utils.range(1, 9), (build, i) => build
                .addStringOption(opt => opt
                    .setName("role" + i)
                    .setDescription("村人以外の役職の名前")
                    .setRequired(i == 1)
                )
            )
        )
        // 今のところＧＭは必ず必要なので、使うことがない
        // .addSubcommand(subcmd => subcmd
        //     .setName(eCommandOptions.nocheck)
        //     .setDescription("名前・役職の割り振りを誰の確認もなしに参加者にDMできます。")
        //     .addStringOption(opt => opt
        //         .setName("name")
        //         .setDescription("人狼の際のみんなに付ける共通の名前")
        //         .setRequired(true)
        //     )
        //     .forEach(Utils.range(1, 9), (build, i) => build
        //         .addStringOption(opt => opt
        //             .setName("role" + i)
        //             .setDescription("村人以外の役職の名前")
        //             .setRequired(i == 1)
        //         )
        //     )
        // )
        .toJSON(),
    // DMからの送信が前提なので スラッシュコマンドは非公開とする
    // new SlashCommandBuilder()
    //     .setName(eCommands.SendRole)
    //     .setDescription("メンバーに名前・役職をDM送信します。\n自動で作成した文字列パラメータを使う前提のコマンドです。")
    //     .addStringOption(opt => opt
    //         .setName("member_roles")
    //         .setDescription("メンバーに割り振る役職を示した文字列")
    //         .setRequired(true)
    //     )
    //     .addStringOption(opt => opt
    //         .setName("options")
    //         .setDescription("狂人に人狼が誰か伝えるなどのオプション動作を示す文字列")
    //         .setRequired(false)
    //     )
    //     .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.CreateVote)
        .setDescription("前回メンバーに知らせた役職を元に、投票フォームを作成します。")
        .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.EjectFromVote)
        .setDescription("指定したメンバーを次回の投票から除きます。")
        .addStringOption(opt => opt
            .setName("option")
            .setDescription("実施する操作を指定します。")
            .setChoices(
                { name: "除外メンバーの追加", value: eCommandOptions.add },
                { name: "除外の取り消し", value: eCommandOptions.delete },
                { name: "確認のみ", value: eCommandOptions.show },
            )
            .setRequired(true)
        )
        .forEach(Utils.range(1, 9), (build, i) => build
            .addUserOption(opt => opt
                .setName("user" + i)
                .setDescription("除外する（または除外を取り消す）ユーザー。未指定の場合は確認のみになります。")
                .setRequired(false)
            )
        )
        .toJSON(),
    // スラッシュコマンドでは非公開にする。簡単に実行できてしまうのは良くないので
    // TODO メッセージに対する数秒間待ち受けを作って、本当に消して良いか回答させるような処理ができないか
    // new SlashCommandBuilder()
    //     .setName(eCommands.ClearMemberData)
    //     .setDescription("ユーザーごとに保存されている情報をクリアします。（メンバーをクリアしたい時や、不具合時に利用する想定）")
    //     .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.TeamBuilder)
        .setDescription("メンバーで、Aチーム、Bチーム、観戦ほか、にチーム分けします。")
        .toJSON(),
];

/**
 * インタラクションのコマンドパーサー
 */
export class InteractionCommandParser {
    /**
     * スラッシュコマンドのインタラクションから平文のコマンドへ変換する
     * @param client 
     * @param interaction 
     * @returns 
     */
    static asyncCconvertPlaneTextCommand = async (client: Client, interaction: Interaction): Promise<{
        plainTextCommand: string,
        mentionUsers: MyUser[]
    }> => {
        let plainTextCommand = "";
        let mentionUsers: MyUser[] = [];

        if (!interaction.isCommand()) {
            return { plainTextCommand: plainTextCommand, mentionUsers: mentionUsers };
        }

        if (!isMyCommand(interaction.commandName)) {
            return { plainTextCommand: plainTextCommand, mentionUsers: mentionUsers };
        }

        plainTextCommand = "/" + interaction.commandName;
        for (const opt of interaction.options.data) {
            if (interaction.commandName == eCommands.Member){
                if (opt.type == ApplicationCommandOptionType.String && opt.name == "option"){
                    plainTextCommand += " " + opt.value;
                }
                else if (opt.type == ApplicationCommandOptionType.User) {
                    const userid = <string>opt.value;
                    const user = (await client.users.fetch(userid));
                    mentionUsers.push({ id: userid, name: user.displayName });
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
                        plainTextCommand += " " + subopt.value;
                    }
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name.match(/^role/)) {
                        plainTextCommand += " " + subopt.value;
                    }
                }
            }
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == eCommandOptions.nocheck) {
                plainTextCommand += " " + opt.name;
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
            if (interaction.commandName == eCommands.EjectFromVote){
                if (opt.type == ApplicationCommandOptionType.String && opt.name == "option"){
                    plainTextCommand += " " + opt.value;
                }
                else if (opt.type == ApplicationCommandOptionType.User) {
                    const userid = <string>opt.value;
                    const user = (await client.users.fetch(userid));
                    mentionUsers.push({ id: userid, name: user.displayName });
                }
            }
        }
        return { plainTextCommand: plainTextCommand, mentionUsers: mentionUsers };
    }
}
/**
 * 平文のコマンドパーサ
 */
export class plainTextCommandParser {
    private _value: string[][];
    private _options: string[];
    constructor(public orgString: string) {
        this._value = orgString.split("\n").map(elm =>
            // 半角 or 全角 のスペースがパラメータの区切りとする
            elm.split(/[ 　]+/)
        );
        this._options = [];

        // オプションがある場合は、オプションと値を分離する
        if (SUPPORT_OPTION_LIST.some(v => v.command == this.command)) {
            const opts = SUPPORT_OPTION_LIST.filter(v => v.command == this.command)[0].opts;
            const ret = plainTextCommandParser.separatOptionsAndValues(this._value, opts);
            this._options = ret.options;
            this._value = ret.values;
        }
    }
    get command(): eCommands | null {
        const v = this.getValue(0, 0)?.replace(/^\//, "");
        return isMyCommand(v) ? v : null;
    }
    getValue(rowIdx: number, itemIdx: number): string | null {
        return this._value.at(rowIdx)?.at(itemIdx) ?? null;
    }
    existsOption(opt: eCommandOptions): boolean {
        return this._options.includes(opt);
    }
    isEmpty(): boolean {
        return this.orgString ? false : true;
    }
    /**
     * 指定した行に格納された要素の数を返却します。
     * @warning
     * コマンドが空かどうか確認する場合は isEmpty() を使用してください。
     * ⇒ コマンド文字列が空でも１行目のLengthは 0 ではなく 1 になるため（空文字が１番目の要素に入る）
     * @param rowIdx 
     * @returns 
     */
    getLength(rowIdx: number): number {
        return this._value.at(rowIdx)?.length ?? 0;
    }

    getLineNum(): number {
        return this._value.length;
    }

    parseMemberRoleSetting = (memberList: MyUser[]): { memberRoleList: MemberRoleInfo[], option: SendMemberRoleOption[] } => {
        const cmd = this;

        // メンバー、オプション情報
        let memberRoleInfoList: MemberRoleInfo[] = [];
        let sendRoleOptionList: SendMemberRoleOption[] = [];

        for (let i = 1; i < cmd.getLineNum(); i++) {
            const firstValue = <string>cmd.getValue(i, 0);

            // オプションか判定
            {
                const sepalate = Utils.format(eMessage.C03_inner_1_know_to_0, "", "");
                const optArray = firstValue.split(sepalate);
                if (optArray.length == 2) {
                    sendRoleOptionList.push({
                        targetRole: optArray[1],
                        action: "canknow",
                        complement: optArray[0],
                    });
                    continue;
                }
            }

            // オプションでないならメンバー情報かも
            if (cmd.getLength(i) != 3)
                continue;

            const theName = <string>cmd.getValue(i, 0);
            const role = <string>cmd.getValue(i, 1);
            const nameInCmd = <string>cmd.getValue(i, 2);
            const mem = memberList.find(m => m.name == nameInCmd);
            if (!mem)
                continue;

            memberRoleInfoList.push({
                id: mem.id,
                alphabet: theName.trim().slice(-1),
                name: mem.name,
                theName: theName,
                role: role,
            });
        }

        return { memberRoleList: memberRoleInfoList, option: sendRoleOptionList };
    }

    private static separatOptionsAndValues(
        values: string[][],
        opts: string[]
    ): { options: string[], values: string[][] } {

        if (values.length <= 0) {
            return { options: [], values: [] };
        }

        const isOption = (val: string) => opts.some(o => o == val);

        // ややこしくなるので、オプションは１行目に限ることにする。
        let options = values[0]
            .filter(val => isOption(val))
            .map(v => v);

        // コピー オプション以外を抽出
        let newValues: string[][] = values.map(row => row.filter(val => !isOption(val)).map(vv => vv));

        return { options: options, values: newValues };
    }
}