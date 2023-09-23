import { EnumTypeGuard, eCommands } from "./Def"

export class CommandMessageAnalysis {
    private _value: string[][];
    constructor(public orgString: string) {
        this._value = orgString.split("\n").map(elm => 
            // 半角 or 全角 のスペースがパラメータの区切りとする
            elm.split(/[ 　]/)
            );
    }
    get command(): eCommands | null {
        const v = this.getValue(0, 0);
        return EnumTypeGuard.isCommands(v) ? v : null;
    }
    getValue(rowIdx: number, itemIdx: number): string | null {
        return this._value.at(rowIdx)?.at(itemIdx) ?? null;
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

    static isMention(value: string) {
        return /^@.*/g.test(value);
    }
}