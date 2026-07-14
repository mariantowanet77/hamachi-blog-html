# はまち日和 — サーバーレス静的ブログ

[hamachi-daily.com](https://hamachi-daily.com) で公開している個人ブログのコンテンツです。
素の HTML / CSS / JavaScript で構築し、AWS 上にサーバーレス構成でホスティングしています。

## 構成

- **配信**: S3（非公開バケット）+ CloudFront + OAC。バケットは公開せず CloudFront 経由のみ
- **ドメイン / HTTPS**: Route 53（独自ドメイン）+ ACM（証明書）。CloudFront Function でセキュリティヘッダーを付与
- **IaC**: インフラ一式を Terraform でコード化（別リポジトリで管理）
- **CI/CD**: このリポジトリの main に push すると、GitHub Actions + OIDC で
  自動的に S3 へ同期し、CloudFront のキャッシュを無効化（長期アクセスキーは不使用）

## 構造

```
index.html                      トップ
common/style.css, site.js       共通スタイル・スクリプト
common/anim.js                  アニメーション共通基盤（SVG + GSAP）
common/vendor/                  GSAP 本体（同梱・CDN非依存）
about/                          このブログについて
pastarticles/                   記事一覧 + 各記事フォルダ（例: 20260708/）
secret/                         隠しページ（マインスイーパー）
assets/                         画像など
backend/like-api/               記事いいねAPI（Java / Lambda + DynamoDB｜S3には同期しない）
.github/workflows/deploy.yml    自動デプロイ設定
```

## 記事の追加方法

1. `pastarticles/` に記事フォルダを作り、`index.html` を置く
2. `common/site.js` の `ARTICLES` 配列の先頭に記事情報を追記
3. `git push` すると自動で公開される

## 記事いいねAPI（Java / サーバーレス）

記事ページのカテゴリ横に「いいね」ボタンがあり、Lambda（**Java 21**）+ DynamoDB +
Function URL で数を管理しています。訪問者カウンターと同じサーバーレス構成の Java 実装版です。
詳細・デプロイ手順は [backend/like-api/README.md](backend/like-api/README.md) を参照。

- ビルド: `cd backend/like-api && mvn package`（単体テスト付き）
- インフラ: `backend/like-api/terraform/like_api.tf`（Terraform リポジトリへコピーして apply）
- フロント: `common/site.js` の `LIKE_API_URL` に Function URL を設定すると表示されます

## アニメーション（SVG + GSAP）

アニメーションは「使う記事だけ」有効にする方式です。各記事フォルダ（日付ごと）に
その記事専用の `anim.js` を置けるので、記事によって演出を自由に変えられます。

### 記事でアニメを有効にする

`index.html` の末尾（`/common/site.js` の後）に読み込みます。

```html
<script src="/common/vendor/gsap.min.js"></script>
<script src="/common/vendor/ScrollTrigger.min.js"></script>
<script src="/common/anim.js"></script>
<script src="anim.js"></script>   <!-- その記事だけの演出（同じ日付フォルダ内・任意） -->
```

### プリセット（HTML に data 属性を付けるだけ）

| `data-anim` | 効果 |
| ----------- | ---- |
| `fade-up`   | 下からふわっと表示 |
| `fade-in`   | その場でフェード |
| `scale-in`  | 拡大しながら表示 |
| `stagger`   | 子要素を順番に表示 |
| `draw`      | SVG を線画（線を描くように） |

細かい調整は `data-anim-*`：`-duration` `-delay` `-distance` `-ease` `-start` `-once` `-stagger` `-target`。
既定では ScrollTrigger により「画面に入ったら」発火します。

```html
<h1  data-anim="fade-up">見出し</h1>
<ul  data-anim="stagger" data-anim-stagger="0.1"> ... </ul>
<svg data-anim="draw"><path d="..." fill="none" stroke="#b5651d"/></svg>
```

### 記事専用の演出（拡張）

記事フォルダの `anim.js` から、独自プリセットの追加や個別演出ができます
（実例は `pastarticles/20260708/anim.js`）。

```js
// data-anim="pop" を新設（register はトップレベルで呼ぶ）
Anim.register('pop', function (el, opts, gsap) {
  gsap.from(el, { scale: 0, ease: 'back.out(2)', duration: 0.6 });
});

// GSAP 準備後に個別の要素を動かす
Anim.ready(function (gsap) {
  gsap.to('#hero-icon', { y: -6, repeat: -1, yoyo: true, duration: 1.6, ease: 'sine.inOut' });
});
```

`prefers-reduced-motion: reduce` の環境では演出を自動的にオフにします。
GSAP は同梱（`common/vendor/`）なので CDN やビルド不要で動きます。
