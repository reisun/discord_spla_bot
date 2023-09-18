# discord_spla_bot

## 概要
スプラ人狼でGMを支援する便利コマンドを提供します。

## 使い方

以下のコマンドが使えます 

#### スプラ人狼のGMが使う便利コマンドの利用開始  
（基本的にこのコマンドから始めないと以降のコマンドは動きません）
    /スプラ人狼

#### メンバーの決定
    /spメンバー @一人目のメンバーのメンション @二人目のメンション @三人… @…

#### メンバーの追加
    /spメンバー追加 @追加するメンバーのメンション

#### メンバーの削除
    /spメンバー削除 @削除するメンバーのメンション

#### メンバー確認
    /spメンバー確認


#### メンバーの名前・役割の提案  
（名前・役割を割り振ってGMにDMします。各メンバーにはまだDMしません）
    /spロール みんなの名前 村人以外の役職１ 村人以外の役職２ ...

・送信コマンド例 その１
    /spロール Ａさん 狂人 人狼 

・送信コマンド例 その２  
（役職は好きに追加OKです。役職が２人必要なら「人狼 人狼」のように２個書いてください。）
    /spロール Ｂさん 占い師 ハンター 人狼 人狼

・GMにDMされるメッセージ例
    /spロール送信  
    ABCDFEG123456ABCDEFG123456  
    メンバー１のメンション あきとA 村人  
    メンバー２のメンション あきとB 狂人  
    メンバー３のメンション あきとC 人狼  
    狂人=>知らせる=>人狼

#### 各メンバーの名前・役割をDM送信  
（/spロール でDMされたメッセージは、各メンバーへ名前・役割をDMするための専用コマンドにもなっています。）  
（GMはDMされた内容を確認してからコピペして、DMからBOTに送信してください。各メンバーに名前・役割がDMされます。）  
（役職を修正したい場合は、コマンドの役職名の部分を好きに書き換えて送信してＯＫ。）

#### 投票用のメッセージを表示する。  
（これはDMからでは無く、みんなが見れるスレッド上でやってください。）
    /sp投票

#### GMをやめる（GMをやめないうちは、別のモードのコマンドは使えません。３０分未操作で自動でやめます。）
    /spやめる

#### GMを入れ替える  
（ /spメンバー コマンドで登録されているメンバーとしか入れ替えられません ）
    /sp代わる @次にGMにしたいメンバーのメンション

---

## 開発環境構築

### dockerの起動
    cd {このディレクトリ}
    docker-compose up -d --build

### dockerコンテナに入る
    docker exec -it {コンテナ名} bash

### node_modulesのインストール
    cd /home/SPLABOT
    npm i

### botの起動
    node app.js

