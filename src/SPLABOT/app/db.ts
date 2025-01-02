import { MongoClient, Collection, ObjectId, MatchKeysAndValues } from 'mongodb'
import { Result, ResultOK, ResultUtil } from './Result';
import { eMessage } from './Const';
import { SplaJinroData, SplaJinroDataVersion, User, WorkData } from "./Model";

const MONGODB_URI = 'mongodb://root:example@mongodb:27017/appData?authSource=admin'

export class DBUtils {
  static createNewSplaJinroDataObj = (channelId: string): SplaJinroData => {
    return {
      channel_id: channelId,
      add_member_list: [],
      ignore_member_list: [],
      prev_suggest_role_command_string: "",
      prev_send_role_command_string: "",
      eject_member_list: [],
      send_role_option: "狂人>知れる>人狼",
      last_update_datatime: new Date(),
      version: SplaJinroDataVersion,
    };
  }
}

export class DBAccesser {
  private constructor(
    public SplaJinroData: Collection<SplaJinroData>,
    public WorkData: Collection<WorkData>,
  ) {
  }

  static async connect(): Promise<DBAccesser> {
    let client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('appData');
    return new DBAccesser(
      db.collection<SplaJinroData>('SplaJinroData'),
      db.collection<WorkData>("WorkData"),
    );
  }

  /**
  * 強制的にデータを取得する
  * （強制的とは？⇒もしデータが無ければ、新しいデータをDBに追加して取得します）
  * @error データのバージョンがソースと異なる場合。データはクリアされる
  * @param channel_id 
  * @returns 
  */
  async asyncSelectSplaJinroDataForce(channelId: string): Promise<Result<SplaJinroData>> {
    // 新規データを登録する関数
    const asyncInsertNewData = async (): Promise<Result<SplaJinroData>> => {
      const newData = DBUtils.createNewSplaJinroDataObj(channelId);
      const insRet = (await this.SplaJinroData.insertOne(newData));
      if (!insRet.acknowledged) {
        return ResultUtil.error(eMessage.C00_DBError);
      }
      return ResultUtil.success(newData);
    }
    const query = { channel_id: channelId };
    const data = (await this.SplaJinroData.findOne(query)) as SplaJinroData | null;
    if (!data) {
      const { status, value } = await asyncInsertNewData();
      if (status != ResultOK) {
        return ResultUtil.error(status);
      }
      return ResultUtil.success(value);
    }
    if (data.version != SplaJinroDataVersion) {
      const delRet = await this.SplaJinroData.deleteMany(query);
      // ここで新データを登録しても良いが、ユーザーが後日同じデータがあるから～と
      // 操作した時に首を傾げそうなので、明示しておく。
      return ResultUtil.error(eMessage.C00_DataVersionNotSame);
    }
    return ResultUtil.success(data);
  }

  async asyncUpdateSplaJinroData(channelId: string, updateQuery: MatchKeysAndValues<SplaJinroData>): Promise<boolean> {
    const query = { channel_id: channelId };
    const updRet = (await this.SplaJinroData.updateOne(
      query,
      {
        $set: updateQuery,
        $currentDate: {
          last_update_datatime: true,
        },
      },
    ));
    if (!updRet.acknowledged || updRet.modifiedCount == 0) {
      return false;
    }
    return true;
  }

  async asyncDeleteSplaJinroData(channelId: string): Promise<boolean> {
    const query = { channel_id: channelId };
    const delRet = await this.SplaJinroData.deleteMany(query);
    if (!delRet.acknowledged || delRet.deletedCount == 0) {
      return false;
    }
    return true;
  }

  async asyncClearWorkData(): Promise<boolean> {
    const delRet = await this.WorkData.deleteMany({});
    if (!delRet.acknowledged) {
      return false;
    }
    return true;
  }
  async asyncInsertWorkData(WorkDataList: WorkData[]): Promise<boolean> {
    const insRet = (await this.WorkData.insertMany(WorkDataList));
    if (!insRet.acknowledged) {
      return false;
    }
    return true;
  }
  async asyncSelectWorkDataForEach(uuid: string, asc: boolean, func: (data: WorkData) => Promise<void>): Promise<void> {
    const query = { process_uuid: uuid };
    const cursor = this.WorkData.find(query).sort({ sorter: asc ? 1 : -1 });
    while(await cursor.hasNext()) {
      const data = await cursor.next();
      if (data) {
        await func(data);
      }
    }
  }
  async asyncDeleteWorkData(uuid: string): Promise<boolean> {
    const delRet = await this.WorkData.deleteMany({process_uuid: uuid});
    if (!delRet.acknowledged) {
      return false;
    }
    return true;
  }

}