import { EnumTypeGuard, eCommands } from "./Def"

export class CommandMessageAnalysis {
    private _value: string[][];
    constructor(strArg: string) {
        this._value = strArg.split("\n").map(elm => elm.split(" "));
    }
    get command(): eCommands | null {
        const v = this.getValue(0, 0);
        return EnumTypeGuard.isCommands(v) ? v : null;
    }
    getValue(rowIdx: number, itemIdx: number): string | null {
        return this._value.at(rowIdx)?.at(itemIdx) ?? null;
    }
    isMention(rowIdx: number, itemIdx: number): boolean {
        const v = this.getValue(rowIdx, itemIdx);
        return v ? CommandMessageAnalysis.isMention(v) : false;
    }


    static isMention(value: string) {
        return /^@.*/g.test(value);
    }


    test() {
        // this._value.at(0).slice(1, );
    }
}