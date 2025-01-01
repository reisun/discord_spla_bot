import {
    ApplicationCommandOptionType,
    Client,
    Interaction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    SlashCommandBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType
} from "discord.js";
import "./DiscordExtentions";
import { Utils } from "./Utilis";
import { MemberRoleInfo, User as MyUser } from "./Model";
import { TEAMBUILD_DEFAULT_NUM } from "./Const";

// スラッシュコマンドの仕様による制限（経験則）
// 日本語だめ 不都合なことが多すぎないか…あっぁぁん？
// 大文字だめ
export const eCommands = {
    Member: "spj_member",
    SuggestRole: "spj_role",
    SendRole: "spj_send_role",
    CreateVote: "spj_vote",
    EjectFromVote: "spj_eject",
    SendRoleOption: "spj_send_role_option",
    ClearMemberData: "spj_clear",
    TeamBuilder: "spj_team_build",
    MessageCopy: "msg_copy",
} as const;
export type eCommands = (typeof eCommands)[keyof typeof eCommands];
export const isMyCommand = (v: any): v is eCommands => Object.values(eCommands).some(elm => elm === v);

export const eCommandOptions = {
    nocheck: "--no-check",
    show: "-show",
    add: "-add",
    delete: "-delete",
    single: "-single",
    datetimeRange: "--datetime-range",
}
export type eCommandOptions = (typeof eCommandOptions)[keyof typeof eCommandOptions];

const SUPPORT_OPTION_LIST = [
    { command: eCommands.SuggestRole, opts: [eCommandOptions.nocheck] },
    { command: eCommands.Member, opts: [eCommandOptions.show, eCommandOptions.add, eCommandOptions.delete] },
    { command: eCommands.EjectFromVote, opts: [eCommandOptions.show, eCommandOptions.add, eCommandOptions.delete] },
    { command: eCommands.MessageCopy, opts: [eCommandOptions.single, eCommandOptions.datetimeRange] },
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
        .setDescription("名前・役職の割り振りリストを作成できます。")
        .addSubcommand(subcmd => subcmd
            .setName("again")
            .setDescription("前回と同じ条件で割り振りリストを作成できます。\n（このコマンドめんどくさいもんね）")
        )
        .addSubcommand(subcmd => subcmd
            .setName("create")
            .setDescription("指定された内容で参加者に名前・役職を割り振りリストを作成します。")
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
        .setDescription("（スプラ人狼とは関係ない機能）メンバーを[Aチーム][Bチーム][観戦ほか]にチーム分けします。")
        .addIntegerOption(opt => opt
            .setName("count")
            .setDescription(`１チームの最大人数。指定無しなら ${TEAMBUILD_DEFAULT_NUM}人。`)
            .setRequired(false)
        )
        .toJSON(),


    new SlashCommandBuilder()
        .setName(eCommands.MessageCopy)
        .setDescription("メッセージを他のチャンネルにコピーします。")
        .addSubcommand(subcmd => subcmd
            .setName(eCommandOptions.single)
            .setDescription("指定されたメッセージリンクのメッセージをコピーします。")
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('コピー先のチャンネル名を入力してください。')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName("message_link")
                .setDescription("コピーしたいメッセージのリンクをメッセージの右クリックからコピペしてください。")
                .setRequired(true)
            )
        )
        .addSubcommand(subcmd => subcmd
            .setName(eCommandOptions.datetimeRange)
            .setDescription("指定された日時の範囲のメッセージをコピーします。")
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('コピー先のチャンネル名を入力してください。')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName("from_ymd")
                .setDescription("開始日を YYYY-MM-DD 形式で入力してください")
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName("from_hm")
                .setDescription("開始時刻を HH:MM 形式で入力してください")
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName("to_ymd")
                .setDescription("終了日を YYYY-MM-DD 形式で入力してください")
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName("to_hm")
                .setDescription("終了時刻を HH:MM 形式で入力してください")
                .setRequired(true)
            )
        )
        .toJSON(),

];

/**
 * コマンドパーサ
 */
export class CommandParser {
    private _value: string[][];
    private _options: string[];
    private constructor(public orgString: string) {
        this._value = orgString.split("\n").map(elm =>
            // 半角 or 全角 のスペースがパラメータの区切りとする
            elm.split(/[ 　]+/)
        );
        this._options = [];

        // オプションがある場合は、オプションと値を分離する
        if (SUPPORT_OPTION_LIST.some(v => v.command == this.command)) {
            const opts = SUPPORT_OPTION_LIST.filter(v => v.command == this.command)[0].opts;
            const ret = CommandParser.separatOptionsAndValues(this._value, opts);
            this._options = ret.options;
            this._value = ret.values;
        }
    }

    /**
     * 平文のコマンドをパース
     * @param command 
     * @returns 
     */
    static fromPlaneText = (command: string): CommandParser => {
        return new CommandParser(command);
    }

    /**
     * インタラクションのコマンド（=スラッシュコマンド）をパース
     * @param client 
     * @param interaction 
     * @returns 
     */
    static asyncFromInteraction = async (client: Client, interaction: Interaction): Promise<{
        parsedCommand: CommandParser,
        mentionUsers: MyUser[]
    }> => {
        let plainTextCommand = "";
        let mentionUsers: MyUser[] = [];

        if (!interaction.isCommand()) {
            return { parsedCommand: new CommandParser(""), mentionUsers: mentionUsers };
        }

        if (!isMyCommand(interaction.commandName)) {
            return { parsedCommand: new CommandParser(""), mentionUsers: mentionUsers };
        }

        plainTextCommand = "/" + interaction.commandName;
        for (const opt of interaction.options.data) {
            switch (interaction.commandName) {
                case eCommands.Member: {
                    if (opt.type == ApplicationCommandOptionType.String && opt.name == "option") {
                        plainTextCommand += " " + opt.value;
                    }
                    else if (opt.type == ApplicationCommandOptionType.User) {
                        const userid = <string>opt.value;
                        const user = (await client.users.fetch(userid));
                        mentionUsers.push({ id: userid, name: user.displayName });
                    }
                }
                    break;
                case eCommands.SuggestRole: {
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
                }
                    break;
                case eCommands.SendRole: {
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
                }
                    break;
                case eCommands.EjectFromVote: {
                    if (opt.type == ApplicationCommandOptionType.String && opt.name == "option") {
                        plainTextCommand += " " + opt.value;
                    }
                    else if (opt.type == ApplicationCommandOptionType.User) {
                        const userid = <string>opt.value;
                        const user = (await client.users.fetch(userid));
                        mentionUsers.push({ id: userid, name: user.displayName });
                    }
                }
                    break;
                case eCommands.SendRoleOption: {
                    if (opt.type == ApplicationCommandOptionType.String && opt.name == "option") {
                        plainTextCommand += " " + opt.value;
                    }
                }
                    break;
                case eCommands.TeamBuilder: {
                    if (opt.type == ApplicationCommandOptionType.Integer && opt.name == "count") {
                        plainTextCommand += " " + opt.value;
                    }
                }
                case eCommands.MessageCopy: {
                    if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == eCommandOptions.single) {
                        plainTextCommand += " " + opt.name;
                        if (!opt.options) {
                            continue;
                        }
                        for (const subopt of opt.options) {
                            if (subopt.type == ApplicationCommandOptionType.Channel) {
                                plainTextCommand += " " + subopt.value;
                            }
                            if (subopt.type == ApplicationCommandOptionType.String) {
                                plainTextCommand += " " + subopt.value;
                            }
                        }
                    }
                    if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == eCommandOptions.datetimeRange) {
                        plainTextCommand += " " + opt.name;
                        if (!opt.options) {
                            continue;
                        }
                        for (const subopt of opt.options) {
                            if (subopt.type == ApplicationCommandOptionType.Channel) {
                                plainTextCommand += " " + subopt.value;
                            }
                            if (subopt.type == ApplicationCommandOptionType.String) {
                                plainTextCommand += " " + subopt.value;
                            }
                        }
                    }
                }
                    break;
            }
        }
        return { parsedCommand: new CommandParser(plainTextCommand), mentionUsers: mentionUsers };
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

    parseMemberRoleSetting = (memberList: MyUser[]): MemberRoleInfo[] => {
        const cmd = this;

        // メンバー情報
        let memberRoleInfoList: MemberRoleInfo[] = [];
        for (let i = 1; i < cmd.getLineNum(); i++) {
            // メンバー情報は３つの要素
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

        return memberRoleInfoList;
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