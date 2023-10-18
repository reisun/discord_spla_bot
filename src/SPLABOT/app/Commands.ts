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
    ClearMemberData: "spj_clear",
    TeamBuilder: "spj_team_build",
} as const;
export type eCommands = (typeof eCommands)[keyof typeof eCommands];
export const isMyCommand = (v: any): v is eCommands => Object.values(eCommands).some(elm => elm === v);

export const eCommandOptions = {
    nocheck: "--no-check",
}
export type eCommandOptions = (typeof eCommandOptions)[keyof typeof eCommandOptions];


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
        .setDescription("メンバーを参照したり追加・削除ができます。")
        .addSubcommand(subcmd => subcmd
            .setName("show")
            .setDescription("現在のメンバーを参照します。")
        )
        .addSubcommand(subcmd => subcmd
            .setName("edit")
            .setDescription("メンバーを追加・削除します。")
            .forEach(Utils.range(1, 9), (subcmd, i) => subcmd
                .addUserOption(opt => opt
                    .setName("user" + i)
                    .setDescription("追加・削除するユーザーを指定します。")
                    .setRequired(i == 1)
                )
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
                .setDescription("人狼の際のみんなに付ける共通の名前（個々の判別にはA,B,Cなどを末尾に付けます）を設定できます。\n使用しない場合は`?`（はてな）を入力してください。")
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
        .addSubcommand(subcmd => subcmd
            .setName("create_no_check")
            .setDescription("名前・役職の割り振りを誰の確認もなしに参加者にDMします。")
            .addStringOption(opt => opt
                .setName("name")
                .setDescription("人狼の際のみんなに付ける共通の名前（個々の判別にはA,B,Cなどを末尾に付けます）を設定できます。\n使用しない場合は`?`（はてな）を入力してください。")
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
    // スラッシュコマンドでは非公開にする。簡単に実行できてしまうので
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
export class interactionCommandParser {
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

        plainTextCommand = "/" + interaction.commandName;
        for (const opt of interaction.options.data) {
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "edit") {
                if (!opt.options) {
                    continue;
                }
                for (const subopt of opt.options) {
                    if (subopt.type == ApplicationCommandOptionType.User) {
                        const userid = <string>subopt.value;
                        const user = (await client.users.fetch(userid));
                        mentionUsers.push({id: userid, name: user.displayName});
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
                        plainTextCommand += " " + subopt.value;
                    }
                    if (subopt.type == ApplicationCommandOptionType.String && subopt.name.match(/^role/)) {
                        plainTextCommand += " " + subopt.value;
                    }
                }
            }
            if (opt.type == ApplicationCommandOptionType.Subcommand && opt.name == "create_no_check") {
                if (!opt.options) {
                    continue;
                }
                plainTextCommand += " " + eCommandOptions.nocheck;
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
        return { plainTextCommand: plainTextCommand, mentionUsers: mentionUsers };
    }
}
/**
 * 平文のコマンドパーサ
 */
export class plainTextCommandParser {
    private static readonly OPTION_LIST = [
        { command: eCommands.SuggestRole, opts: [eCommandOptions.nocheck] }
    ];
    private _value: string[][];
    private _options: string[];
    constructor(public orgString: string) {
        this._value = orgString.split("\n").map(elm =>
            // 半角 or 全角 のスペースがパラメータの区切りとする
            elm.split(/[ 　]+/)
        );
        this._options = [];

        // オプションがある場合は、オプションと値を分離する
        if (plainTextCommandParser.OPTION_LIST.some(v => v.command == this.command)) {
            const opts = plainTextCommandParser.OPTION_LIST.filter(v => v.command == this.command)[0].opts;
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
    getOptions(): string[] {
        return this._options;
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

    parseMemberRoleSetting = (memberList: MyUser[]): { memberRoleList: MemberRoleInfo[], option: SendMemberRoleOption[]} => {
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

        return { memberRoleList: memberRoleInfoList, option: sendRoleOptionList};
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