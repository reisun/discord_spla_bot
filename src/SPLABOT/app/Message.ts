
export const eMessage = {
    // StartGM
    C01_BecameGM: "ようこそ、{0}。あなたがGM(Game Master😊)になりました。",
    C01_AlreadyGM: "もうこれ以上のGMにはなれません。",
    C01_DBError: "予期せぬエラーでGMとして登録できませんでした。ごめんね…。",
    // role
    C02_NotAllowFromDM: "チャンネルからコマンドを実行してください。",
    C02_MemberView_Zero: "現在メンバーはいません。",
    C02_MemberView: "現在のメンバーをお知らせします。",
    C02_AddMember: "メンバーを追加しました。現在のメンバーをお知らせします。",
    C02_DeleteMember: "メンバーを削除しました。現在のメンバーをお知らせします。",
    C02_ToMany: "何人でやるつもりでおまんがな",
    // roleSend
    C03_MemberNothing: "メンバーを決定してね😨",
    C03_MemberUpdated: "メンバーが更新されている？ {0} からやり直してね",
    // Vote
    C04_MemberNothing: "メンバーを決定してね😨",
    C04_MemberUpdated: "メンバーが更新されている？ {0} からやり直してね",
    // end
    C05_QuitGM: "GMから外れました。おつかれさま！",
    C05_IsNotGM: "GMでは無いのでやめることができません。自動でやめたかも。それとも人間やめますか？",
    C05_DBError: "予期せぬエラーでGMから外せませんでした。ごめんね…。",
}
export type eMessage = (typeof eMessage)[keyof typeof eMessage];

export class MessageUtil {
    static getMessage = (eMessage: eMessage, ...args: unknown[]) => {
        let msg = eMessage;
        args.forEach((val, idx) => {
            let regx = new RegExp(`\\{${idx}\\}`, "g");
            msg = eMessage.replace(regx, val?.toString() ?? "");
        });
        return msg;
    }
}