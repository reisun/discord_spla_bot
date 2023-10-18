import {
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
} from "discord.js"

// 拡張メソッドI/F定義
declare module 'discord.js' {
    interface SlashCommandBuilder {
        // 「数珠つなぎ に .set～()できるよっていうのなら、同項目１、同項目２…も 便利に数珠つなぎで
        // 定義できるようにさせろよ」と怒り狂って用意した拡張メソッド。
        /** 指定した配列の要素だけ処理を繰り返します。 */
        forEach<T>(
            array: Array<T>,
            func: (builder: SlashCommandBuilder, item: T) => void
        ): SlashCommandBuilder;
    }
    // 「同じ分類の型どれだよめんどくさい」と怒り狂って用意した 上記と同様の range 拡張メソッド
    interface SlashCommandSubcommandBuilder {
        /** 指定した配列の要素だけ処理を繰り返します。 */
        forEach<T>(
            array: Array<T>,
            func: (builder: SlashCommandSubcommandBuilder, item: T) => void
        ): SlashCommandSubcommandBuilder;
    }
};
// 拡張メソッド実体
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