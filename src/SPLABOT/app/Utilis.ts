import { eCommands, isMyCommand } from "./Commands"
import { User as MyUser } from "./db"


export class plainTextCommandAnalyser {
    private static readonly OPTION_LIST = [
        { command: eCommands.SuggestRole, opts: ["--check"] }
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
        if (plainTextCommandAnalyser.OPTION_LIST.some(v => v.command == this.command)) {
            const opts = plainTextCommandAnalyser.OPTION_LIST.filter(v => v.command == this.command)[0].opts;
            const ret = plainTextCommandAnalyser.separatOptionsAndValues(this._value, opts);
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

    parseMemberRoleDef = (memberList: MyUser[]): {
        id: string,
        name: string,
        alphabet: string,
        theName: string,
        role: string,
    }[] => {
        const cmd = this;

        let memberRoleDef: {
            id: string,
            name: string,
            alphabet: string,
            theName: string,
            role: string,
        }[] = [];

        for (const dataMem of memberList) {
            for (let i = 1; i < cmd.getLineNum(); i++) {
                if (cmd.getLength(i) != 3)
                    continue;

                const theName = <string>cmd.getValue(i, 0);
                const role = <string>cmd.getValue(i, 1);
                const nameInCmd = <string>cmd.getValue(i, 2);
                if (dataMem.name != nameInCmd)
                    continue;

                memberRoleDef.push({
                    id: dataMem.id,
                    alphabet: theName.trim().slice(-1),
                    name: dataMem.name,
                    theName: theName,
                    role: role,
                });
            }
        }

        return memberRoleDef;
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