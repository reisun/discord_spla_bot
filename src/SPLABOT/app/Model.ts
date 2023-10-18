export type User = {
  id: string, name: string
}

export type SplaJinroDataVersion = 1;
export const SplaJinroDataVersion = 1;
export type SplaJinroData = {
  channel_id: string,
  add_member_list: User[],
  ignore_member_list: User[],
  prevSuggestRoleCommandString: string,
  prevSendRoleCommandString: string,
  eject_member_list: User[],
  last_update_datatime: Date,
  version: SplaJinroDataVersion,
}

// メンバー情報
export type MemberRoleInfo = {
  id: string,
  name: string,
  alphabet: string,
  theName: string,
  role: string,
};

// オプション情報
export type MemberRoleOptionCanKnow = {
  targetRole: string,
  action: "canknow",
  complement: string,
}
export type SendMemberRoleOption = MemberRoleOptionCanKnow /* | その他の型 */;
