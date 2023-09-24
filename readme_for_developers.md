## 開発環境構築

### dockerの起動
    docker-compose up -d --build

### dockerコンテナに入る
    docker exec -it discord_spla_bot sh

### node_modulesのインストール
    cd /home/SPLABOT
    npm i

### typescriptのビルド
    npm run compile

### botの起動
    npm run start

