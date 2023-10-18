export const ALPHABET_TABLE = [
    "A", "B", "F", "H", "W", "X", "Y", "Z", "N", "L", "Q", "S", "R", "I"
] as const;

export const MAX_MEMBER_COUNT: number = 14;

export const eMessage = {
    // 汎用
    C00_DBError: "DBエラーです（冷たい業務連絡）",
    C00_NoData: "データがありませんでした。\n最初から操作しなおしてください。",
    C00_DataVersionNotSame: "保存中のデータ構成が古いためデータがクリアされました。\n最初から操作しなおしてください。",
    C00_ReplyDMFailed: "DMでの返信に失敗しました。DMは許可されていますか？",
    C00_OtherDMFailed: "以下のユーザーへのDMに失敗しました。DMが許可されていないかもしれません。\n{0}",
    C00_VoteOneOnOne: "(1人1票)",
    C00_VoteAny: "(1人複数票OK)",

    // updateMember
    C02_NotAllowFromDM: "メンバー編集はチャンネルから実行してください。（サーバー外のユーザーを登録してBOTがDMとか気まずそうなので…）",
    C02_MemberView_Zero: "現在メンバーはいません。",
    C02_MemberView: "現在登録されているメンバーは以下の通りです。\n{0}",
    C02_inner_MemberFormat: "* {0}", // markdown のリスト表記を使う
    C02_DBError: "予期せぬエラーでメンバーを更新できませんでした…。悔しい…。",
    // roleSuggest
    C03_UsePredata: "以下の前回の設定で割当を作ります！\n名前:`{0}`、村人以外の役職:`{1}`",
    C03_RorlArgNothing: "役職 の値がありません。\nコマンド: `{0} {名前} {役職(村人以外 複数OK)}`\n コマンド例： `{0} りゅう 人狼 狂人`",
    C03_ToMany: "何人でやるつもりでおまんがな。参加上限は{0}人です。",
    C03_MemberNothing: "メンバーがいない？😨",
    C03_NonAgainData: "前回の役職作成データがありませんでした。",
    C03_MemberFew: "村人以外の役職({0}個)に対してメンバーが足りません。({1}人)",
    C03_SuggestMemberExplain: "ロール割り当てコマンドを作りました。\n以下のメッセージをコピーしてBOTに送信してください。\n（必要なら修正して送信でＯＫ）",
    C03_SuggestMember: "/{0}\n{1}\n{2}\n{3}", // コマンド、チェンネルID、メンバ役割表、オプション
    C03_inner_MemberFormat: "{0}　{1}　{2}", // ゲーム内名前、役職、メンバー名
    C03_inner_1_know_to_0: "{0}>知られる>{1}",
    // roleSend
    C04_NeedDM: "DMで送らないと視えちゃうのでだめや",
    C04_MemberNothing: "メンバーがいない？😨",
    C04_ChannelIdArgNothing: "コマンドに人狼部屋のチャンネルIDがありません。",
    C04_InvalidChannelId: "チャンネルIDが正しくありません。",
    C04_MemberArgNothing: "コマンドにメンバー設定がありません。",
    C04_MemberArgNonMatch: "メンバーが更新されている？ 不整合がありました。\n{0} からやり直してみてください。",
    C04_SendRoleTmpl: "…\n次の人狼が始まります。\n\nあなたの名前と役職は\n名前：**{0}**\n役職：**{1}**\nです。\n…",
    C04_SendKnowTmpl: "…\n**{0}** のあなたにお知らせがあります。\n**{1}** は **{2}** です。\n…",
    C04_DMSuccess: "メンバーにDMしました。",
    C04_DBError: "予期せぬエラーで送信できませんでした。力不足で申し訳…", 
    // Vote
    C05_NotAllowFromDM: "チャンネルからコマンドを実行してください。",
    C05_MemberNothing: "メンバーがいない？😨",
    C05_RoleDataNothing: "メンバーにDM送信した情報がありません。ロール作成からやり直して見てください。",
    C05_RoleDataNothingInData: "メンバーにDM送信時にメンバーが０人だったようです。（そんなことある？）ロール作成からやり直して見てください。",
    // clear memberData
    C06_ClearMemberData: "登録されたメンバーデータがクリアされました。",
    C06_DataNothing: "既にデータはクリアされています。",
    C06_DBError: "予期せぬエラーでメンバーデータがクリアできませんでした。悔しい…", 
    // teambuilder
    C07_MemberNotFound: "メンバーがいない？😨",
} as const;
export type eMessage = (typeof eMessage)[keyof typeof eMessage];