export const eCommands = {
    Member: "/spjメンバー",
    SuggestRole: "/spjロール提案",
    SendRole: "/spjロールDM送信",
    CreateVote: "/spj投票",
    ClearData: "/spjクリア",
    EditRoleTemplate: "/spjロールテンプレート",
} as const;
export type eCommands = (typeof eCommands)[keyof typeof eCommands];

export class EnumTypeGuard {
    static isCommands = (v: any): v is eCommands => {
        return Object.values(eCommands).some(elm => elm === v);
    }
}

export const MAX_MEMBER_COUNT: number = 14;