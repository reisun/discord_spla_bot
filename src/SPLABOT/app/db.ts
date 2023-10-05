import { MongoClient, Collection, MongoClientOptions, ObjectId } from 'mongodb'

const MONGODB_URI = 'mongodb://root:example@mongodb:27017/appData?authSource=admin'

export const ePlayMode = {
  SplaJinro: "スプラ人狼",
  SplaJinroHowToUser: "スプラ人狼_チュートリアル",
} as const;
export type ePlayMode = (typeof ePlayMode)[keyof typeof ePlayMode];

export type User = {
  id: string, name: string
}

export type PlayUserVersion = 1;
export const PlayUserVersion = 1;
export type PlayUser = {
  _id?: ObjectId
  player_id: string, // キーにしたいので 単独の項目にする オブジェクトにしない
  player: User,
  player_last_ope_datatime: Date,
  play_mode: ePlayMode,
  play_data: {
    member_list: User[],
    prevSuggestRoleCommandString: string,
    prevSendRoleCommandString: string,
  },
  version: PlayUserVersion,
};

export class PlayUserUtil {
  static createNewPlayUserObj = (user: User): PlayUser => {
    return {
      player_id: user.id,
      player: user,
      player_last_ope_datatime: new Date(),
      play_mode: ePlayMode.SplaJinro,
      play_data: {
        member_list: [],
        prevSuggestRoleCommandString: "",
        prevSendRoleCommandString: "",
      },
      version: PlayUserVersion,
    };
  }
}

export class DBAccesser {
  private constructor(
    public PlayUser: Collection<PlayUser>,
  ) {
  }

  static async connect(): Promise<DBAccesser> {
    let client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('appData');
    return new DBAccesser(
      db.collection<PlayUser>('PlayUser'),
    );
  }
}
