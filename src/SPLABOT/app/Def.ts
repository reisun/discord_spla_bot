export const eCommands = {
    SplaJinroStart: "/スプラ人狼",
    Member: "/spメンバー",
    RolePlan: "/spロール",
    RoleSend: "/spロール送信",
    Vote: "/sp投票",
    SplaJinroEnd: "/spやめる",
} as const;
export type eCommands = (typeof eCommands)[keyof typeof eCommands];

export class EnumTypeGuard {
    static isCommands = (v: any): v is eCommands => {
        return Object.values(eCommands).some(elm => elm === v);
    }
}
