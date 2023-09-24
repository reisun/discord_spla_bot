import {
    ApplicationCommand,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder
} from "discord.js"

/**
 * 
 * @param from ループ開始の数
 * @param to ループ条件 (i < to) 相当。(ex: to=100 なら 99 で終わり)
 * @returns 
 */
const range = (from: number, to: number) => ([...Array(to - from)].map((_, i) => (from + i)));

//#region 拡張メソッド
declare module 'discord.js' {
    interface SlashCommandBuilder {
        // 「数珠つなぎ に .set～()できるよっていうのなら、同項目１、同項目２…も 便利に数珠つなぎで
        // 定義できるようにさせろよ」と怒り狂って用意した拡張メソッド。
        /**
         * 指定した配列の要素だけ処理を繰り返します。
         * @param array 
         * @param func 
         */
        forEach<T>(
            array: Array<T>,
            func: (builder: SlashCommandBuilder, item: T) => void
        ): SlashCommandBuilder;
    }
    // 「同じ分類の型どれだよめんどくさい」と怒り狂って用意した 上記と同様の range 拡張メソッド
    interface SlashCommandSubcommandBuilder {
        /**
         * 指定した配列の要素だけ処理を繰り返します。
         * @param array 
         * @param func 
         */
        forEach<T>(
            array: Array<T>,
            func: (builder: SlashCommandSubcommandBuilder, item: T) => void
        ): SlashCommandSubcommandBuilder;
    }
};
// 拡張メソッドの実体
Object.defineProperty(SlashCommandBuilder.prototype, "forEach", {
    configurable: true, enumerable: false, writable: true,
    value: function <T>(
        this: SlashCommandBuilder,
        array: Array<T>,
        func: (builder: SlashCommandBuilder, item: T) => void
    ): SlashCommandBuilder {
        array.forEach(item => func(this, item));
        return this
    }
});

Object.defineProperty(SlashCommandSubcommandBuilder.prototype, "forEach", {
    configurable: true, enumerable: false, writable: true,
    value: function <T>(
        this: SlashCommandSubcommandBuilder,
        array: Array<T>,
        func: (builder: SlashCommandSubcommandBuilder, item: T) => void
    ): SlashCommandSubcommandBuilder {
        array.forEach(item => func(this, item));
        return this
    }
});
//#endregion 拡張メソッド

export class EnumTypeGuard {
    static isMyCommands = (v: any): v is eCommands => {
        return Object.values(eCommands).some(elm => elm === v);
    }
}

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
    ClearMemberData: "spj_member_clear",
} as const;

export type eCommands = (typeof eCommands)[keyof typeof eCommands];

export type CommandDef = {
    type: ApplicationCommandType.ChatInput,
    name: eCommands,
    desc: string,
    options?: CommandOptionDef[],
};
export type CommandOptionDef = SubCommandDef;
export type SubCommandDef = {
    type: ApplicationCommandOptionType.Subcommand,
    name: string,
    desc: string,
    options?: CommandOptionDef[],
}

// スラッシュコマンドの型がガチガチ過ぎて、こちらの定義⇒discord.jsの定義への変換が
// めんどくさくてあほらしい…
// こちらで利用することはあきらめて
// ”スラッシュコマンド登録リクエストのBodyの型（笑うところ）”で定義してしまう
export const COMMAND_DEF_LIST: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
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
            .forEach(range(1, 9), (subcmd, i) => subcmd
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
            .setDescription("割り振りを作成します。")
            .addStringOption(opt => opt
                .setName("name")
                .setDescription("人狼の際のみんなに付ける共通の名前（個々の判別にはA,B,Cなどを末尾に付けます）を設定できます。\n使用しない場合は`?`（はてな）を入力してください。")
                .setRequired(true)
            )
            .forEach(range(1, 9), (build, i) => build
                .addStringOption(opt => opt
                    .setName("role" + i)
                    .setDescription("村人以外の役職の名前")
                    .setRequired(i == 1)
                )
            ) 
        )
    .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.SendRole)
        .setDescription("メンバーに名前・役職をDM送信します。\n自動で作成した文字列パラメータを使う前提のコマンドです。")
        .addStringOption(opt => opt
            .setName("member_roles")
            .setDescription("メンバーに割り振る役職を示した文字列")
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName("options")
            .setDescription("狂人に人狼が誰か伝えるなどのオプション動作を示す文字列")
            .setRequired(false)
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.CreateVote)
        .setDescription("投票フォームを作成します。")
        .toJSON(),
    new SlashCommandBuilder()
        .setName(eCommands.ClearMemberData)
        .setDescription("ユーザーごとに保存されているメンバー情報をクリアします。")
        .toJSON(),
];

export const MAX_MEMBER_COUNT: number = 14;