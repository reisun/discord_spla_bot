# discord_spla_bot

## 概要
スプラ人狼でGMを支援する便利コマンドを提供します。
#### スラッシュコマンドに対応
スラッシュコマンドに対応しています。  
各コマンドの使い方はコマンド打つ時に出てきますので、そちらを参照ください。  

## 使い方

以下、使えるコマンドの説明です。  
説明内容は平文で入力した場合のため、スラッシュコマンドとは若干異なる場合があります。  
スラッシュコマンドで入力する際は、入力時に表示されるガイドに従ってください。  
一部、平文専用のコマンドがあります。  
DMでの送信前提であったり、簡易な入力を防ぐためです。

#### メンバーの追加・削除
    /spj_member @一人目のメンバーのメンション @二人目のメンション @三人… @…
既にメンバーにいる場合は削除、いない場合は追加します。

#### メンバー確認
    /spj_member

#### メンバーの名前・役割の割り当て作成  
    /spj_role 名前 村人以外の役職(複数指定可)
名前・役割の割り当てを自動で作成してコマンドを打った人にDMします。  
各メンバーにはまだDMされません。

#### 送信コマンド例 その１
    /spj_role りゅう 狂人 人狼 

#### 送信コマンド例 その２  
    /spj_role りゅう 占い師 ハンター 人狼 人狼
役職は好きに追加OKです。同じ役職が２人必要なら「人狼 人狼」のように２個書いてください。

#### 前回の名前・役割の割り当てで作成
    /spj_role
前回使用した名前・割り当てのコマンド内容で再実行します。
同じルールで続ける時に便利です。

#### 各メンバーに名前・役割をDM送信（スラッシュコマンド非対応）
    /spj_send_role  
    りゅうA 村人 メンバー１  
    りゅうB 狂人 メンバー２ 
    りゅうC 村人 メンバー３
    狂人=>知らせる=>人狼
`/spj_role` を行うと、上記の役割送信コマンドを返信します。  
こちらをコピペしてBOTにDM送信すると、各メンバーにDMが送信されます。  
割り当てが気に入らない場合は、役職などを手で変更してから  
コマンド送信できます。  
※サーバーのチャンネル上で送信すると丸見えですので  
BOTにDMで送ってください。

#### 投票用のメッセージを表示する。  
    /spj_vote
こちらはDMからでは無く、みんなが見れるチャンネル上でやってください。

#### メンバー情報をクリアする（スラッシュコマンド非対応）
    /spj_clear   
コマンド実行者ごとに保存されている、登録情報がクリアされます。   
保存している登録情報は以下の通りです。 
* コマンド実行者のID/表示名
* 登録しているメンバー情報(ID/表示名)
* 直近の役割作成内容(/spj_role の内容)
* 直近の役割メンバー送信内容(/spj_send_role の内容)