# 記事いいねAPI（Java / AWS Lambda + DynamoDB）

ブログ記事の「いいね」を数えるサーバーレス API です。
訪問者カウンター（Lambda + DynamoDB）と同じ構成を、バックエンド言語 **Java** で実装しています。

```
ブラウザ (site.js)
   │  GET  /?article=20260708            … いいね数の取得
   │  POST / {"article":..,"action":..}  … like / unlike（トグル）
   ▼
Lambda Function URL（CORS はここで設定）
   ▼
Lambda: LikeHandler（Java 21 / arm64）
   ▼
DynamoDB: hamachi-blog-likes（article_id → like_count）
```

## API 仕様

| メソッド | リクエスト | レスポンス |
| --- | --- | --- |
| GET | `/?article=20260708` | `{"article":"20260708","likes":12}` |
| POST | `{"article":"20260708","action":"like"}` | `{"article":"20260708","likes":13}` |
| POST | `{"article":"20260708","action":"unlike"}` | `{"article":"20260708","likes":12}` |

- 記事ID は記事フォルダ名（`pastarticles/<記事ID>/`）。英数字とハイフン・アンダースコアのみ許可し、それ以外は 400
- `unlike` で 0 未満にはならない（DynamoDB の条件式でガード）
- 加算・減算は `UpdateItem` の式で行うためアトミック（同時アクセスでもカウントがズレない）
- 「1人1いいね」の判定はフロント側の localStorage（訪問者カウンターと同じ方式）

## 構成ファイル

```
pom.xml                          Maven 設定（Java 21 / shade で単一JAR化）
src/main/java/com/hamachidaily/likes/
  LikeHandler.java               エントリーポイント（ルーティング・入力チェック）
  LikeStore.java                 カウンター操作のインターフェース
  DynamoDbLikeStore.java         DynamoDB 実装（アトミックな加算・減算）
src/test/java/…/LikeHandlerTest.java  単体テスト（インメモリ実装で検証）
terraform/like_api.tf            インフラ定義（インフラリポジトリへコピーして使う）
```

## ビルドとテスト

必要なもの: JDK 21 / Maven

```bash
cd backend/like-api
mvn package        # テスト実行 + target/like-api.jar を生成
```

## デプロイ手順

1. `mvn package` で `target/like-api.jar` を作る
2. `terraform/like_api.tf` をインフラリポジトリにコピーし、JAR へのパス（`local.like_api_jar`）を調整して `terraform apply`
3. 出力された `like_api_url` を `common/site.js` の `LIKE_API_URL` に貼る
4. ブログリポジトリを push（記事ページのカテゴリ横にいいねボタンが出ます）

コードを更新したときは `mvn package` → `terraform apply`（JAR のハッシュ変化を検知して再デプロイされます）。

## 動作確認（curl）

```bash
URL=https://xxxx.lambda-url.ap-northeast-1.on.aws/

curl "$URL?article=20260708"
curl -X POST "$URL" -H "content-type: application/json" \
     -d '{"article":"20260708","action":"like"}'
```

## 設計メモ

- **UrlConnectionHttpClient**: AWS SDK 標準の Netty/Apache クライアントを除外し、軽量な
  UrlConnection を使用（Java Lambda のコールドスタート対策の定石）
- **CORS は Function URL 側で設定**: アプリコードから CORS の関心事を分離。許可オリジンは
  `https://hamachi-daily.com` のみ
- **テスト**: `LikeStore` をインターフェースにして DynamoDB をインメモリ実装に差し替え、
  AWS なしでロジックを検証
- **改善アイデア**: Lambda SnapStart（Java は追加料金なし）でコールドスタート短縮、
  WAF / レートリミットの追加、IP 単位の重複いいね対策
