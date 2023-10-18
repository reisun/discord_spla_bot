# discord_spla_bot

スプラ人狼でGMを支援するコマンドを提供します。

## 動作範囲
このBOTは、以下のチャンネルでコマンドを受け付けます。
* 許可しているサーバー上のボイスチャンネル（テキストチャンネルでも動くが想定した動作にならないかも）
* GMのDMチャンネル（メンバーの役職リストの送信など）

このBOTは、上記チャンネル以外に以下のチャンネルにメッセージを送信します。
* 人狼参加者のDMチャンネル（役職の通知）  

## スラッシュコマンド
このBOTは、スラッシュコマンドに対応しています。  
スラッシュコマンドとは、メッセージ入力欄で ```/``` (スラッシュ) を入力すると、コマンドのガイドが出てきて簡単に入力できる機能です。  
  
ただし以下の注意点があります。  
* サーバー上でのチャンネルにのみ対応。  
DM上では対応していないため、通常のコマンドで入力してください。  
* 通常のコマンドと少し書き方が異なる。  
スラッシュコマンドを打つ時に出てくるガイドを確認すれば問題無い範囲です。  


## よく使うコマンド

### ○メンバーに割り当てる名前・役職を考えるとき
#### メンバーの名前・役職の作成  
    /spj_role 共通の名前 村人以外の役職(複数指定可)
人狼で使用する共通の名前と、村人以外の役職を入力します。  
コマンド実行すると、コマンド実行者（GM）を除いた、人狼参加者各メンバーの名前・役職のリストを作成します。  
作成したリストはコマンド実行者にDM送信されます。  

#### (コマンド送信例)  
    /spj_role りゅう 占い師 ハンター 人狼 人狼
役職は好きに追加OKです。同じ役職が２人必要なら「人狼 人狼」のように２個書いてください。

#### 前回のルールの再利用
    /spj_role
前回使用した名前・役職の設定内容で再実行します。  
同じルールで続ける時に便利です。

### ○名前・役職の割り当てをメンバーに通知するとき

#### 各メンバーにDMを送信（スラッシュコマンド非対応）
    /spj_send_role  
    123123123123123123
    りゅうA  村人 メンバー１  
    りゅうB  狂人 メンバー２ 
    りゅうC  人狼 メンバー３
`/spj_role` を行うと、上記のような名前・役職リストを返信します。  
こちらはコマンドにもなっているため、コピペしてBOTにDM送信すると、各メンバーにDMが送信されます。  
割り当てが気に入らない場合は、役職などを手で変更してからコマンドを送信して大丈夫です。  
（※２行目の数字は人狼部屋を示すボイスチャンネルの番号なので変更しないでください。）  

### ○投票するとき

#### 投票用のメッセージを表示  
    /spj_vote
最後に実施した `/spj_send_role` の内容を元に投票フォームを作成します。

### ○追放するとき

#### 追放
    /spj_eject @ユーザーのメンション
次の `/spj_vote` で表示される投票フォームに出てこないようになります。
もう一度指定すると取り消せます。

---

<br/>

## おまけ

#### チーム作成
    /spj_team_build
ボイスチャットにいるメンバーで、Aチーム、Bチーム、観戦、にチーム分けします。

<br/>
<br/>

## あまり使わないコマンド

#### メンバーの追加・削除（スラッシュコマンド非対応）
    /spj_member @メンバーのメンション（複数指定可能）
初期状態の人狼参加者はボイスチャンネルのメンバー全員となりますが  
このコマンドでは、ボイスチャンネル内でありながら指定のユーザーを不参加にしたり、  
ボイスチャンネルにいないユーザーを参加状態にさせたりできます。（需要は無さそう）  
  
コマンドで指定したユーザーが、既に参加していれば削除、参加していなければ追加、となります。

#### メンバー確認（スラッシュコマンド非対応）
    /spj_member
人狼参加者と、ボイスチャンネルに居るが参加者でない人、を表示します。

<br/>

#### 役職のメンバー通知時のオプション動作を設定する（スラッシュコマンド非対応）
    /spj_send_role_option オプション内容(複数指定可能)
`/spj_send_role` の役職通知の際に、特殊な動作を指定できます。

#### オプション：役職通知  
    役職名>知られる>役職名

    （コマンド例）
    /spj_send_role_option 人狼>知られる>狂人
`/spj_send_role` の役職通知の際に、ある役職に別の役職が誰かを知らせることができます。  
上記の例では、狂人に人狼が誰なのかを合わせて通知します。  

その他オプションの種類は今のところなし。  

<br/>

#### 保存情報をクリアする（スラッシュコマンド非対応）
    /spj_clear   
チャンネルごとに保存されている情報がクリアされます。   
保存している情報は以下の通りです。 
* チャンネルのID
* 追加・除外しているメンバーの情報(ID/表示名) (/spj_member の内容)
* 直近の役職作成内容 (/spj_role の内容)
* 直近の役職通知内容 (/spj_send_role の内容)
* 追放メンバーID (/spj_eject の内容)
* 役職通知時のオプション動作 (/spj_send_role_option の内容)

<br/>

## **/spj_role のオプション**
#### 作成した役職割り当てを確認せずにメンバーにすぐDMする（スラッシュコマンド非対応）
    --no-check
役職を誰も知らないまま、人狼参加者にDMできます。  
このオプションを付けた場合、コマンド実行者はGMと判断されないため、役職が付きます。

#### コマンド送信例  
    /spj_role --no-check りゅう 占い師 ハンター 人狼 人狼

<br/>