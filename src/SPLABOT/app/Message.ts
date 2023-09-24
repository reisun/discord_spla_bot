
export const eMessage = {
    // StartGM ⇒ DBに登録されたという意味合いに変更
    C01_BecameGM: "ようこそ、{0}。", //あなたがGM(Game Master😊)になりました。",
    C01_AlreadyGM: "既に操作者としてデータが登録されています。", //"もうこれ以上のGMにはなれません。",
    C01_DBError: "予期せぬエラーで操作者として登録できませんでした。ごめんね…", //"予期せぬエラーでGMとして登録できませんでした。ごめんね…。",
    // updateMember
    C02_NotAllowFromDM: "チャンネルからコマンドを実行してください。",
    C02_MemberView_Zero: "現在メンバーはいません。",
    C02_MemberView: "現在の登録されているメンバーは以下の通りです。\n{0}",
    C02_inner_MemberFormat: "* {0}", // markdown のリスト表記を使う
    C02_UpdatedMember: "メンバーを更新しました。",
    C02_ToMany: "何人でやるつもりでおまんがな",
    C02_DBError: "予期せぬエラーでメンバーを更新できませんでした…。悔しい…。",
    // roleSuggest
    C03_UsePredata: "以下の前回の設定で割当を作ります！\n名前:`{0}`、村人以外の役職:`{1}`",
    C03_RorlArgNothing: "役職 の値がありません。\nコマンド: `{0} {名前} {役職(村人以外 複数OK)}`\n コマンド例： `{0} あきと 人狼 狂人`",
    C03_ToMany: "何人でやるつもりでおまんがな",
    C03_MemberNothing: "メンバーを決定してね😨",
    C03_NonAgainData: "前回のデータを使用しようとしましたが、前回のデータがありませんでした。",
    C03_MemberFew: "村人以外の役職({0}個)に対してメンバーが足りません。({1}人)",
    C03_SuggestMemberExplain: "ロール割り当てコマンドを作りました。\n以下のメッセージをコピーしてBOTに送信してください。\n（必要なら修正して送信でＯＫ）",
    C03_SuggestMember: "/{0}\n{1}\n{2}", // コマンド、メンバ役割表、オプション
    C03_inner_MemberFormat: "{0}\t{1}\t{2}", // ゲーム内名前、役職、メンバー名
    C03_inner_1_know_to_0: "{0}=>知られる=>{1}",
    // roleSend
    C04_NeedDM: "DMで送らないと視えちゃうのでだめや",
    C04_MemberNothing: "メンバーを決定してね😨",
    C04_MemberArgNothing: "コマンドにメンバー設定がありません。",
    C04_MemberArgNonMatch: "メンバーが更新されている？ 不整合がありました。\n{0} からやり直してみてください。",
    C04_SendRoleTmpl: "…\n次の人狼が始まります。\n\nあなたの名前と役職は\n名前：**{0}**\n役職：**{1}**\nです。",
    C04_SendKnowTmpl: "…\n**{0}** のあなたにお知らせがあります。\n**{1}** は **{2}** です。",
    C04_DMSuccess: "メンバーにDMしました。",
    // Vote
    C05_MemberNothing: "メンバーを決定してね😨",
    C05_MemberUpdated: "メンバーが更新されている？ {0} からやり直してね",
    // end ⇒ DBに登録したデータをクリアする立ち位置に変更
    C06_ClearMemberData: "登録されたメンバーデータがクリアされました。", // "GMから外れました。おつかれさま！",
    C06_IsNotGM: "既にメンバーデータはクリアされています。", //"GMでは無いのでやめることができません。自動でやめたかも。それとも人間やめますか？",
    C06_DBError: "予期せぬエラーでメンバーデータがクリアできませんでした。悔しい…", // "予期せぬエラーでGMから外せませんでした。ごめんね…。",
}
export type eMessage = (typeof eMessage)[keyof typeof eMessage];

export class MessageUtil {
    static getMessage = (eMessage: eMessage, ...args: unknown[]) => {
        let msg = eMessage;
        args.forEach((val, idx) => {
            let regx = new RegExp(`\\{${idx}\\}`, "g");
            msg = msg.replace(regx, val?.toString() ?? "");
        });
        return msg;
    }
}