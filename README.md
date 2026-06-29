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
about/                          このブログについて
pastarticles/                   記事一覧 + 各記事フォルダ
secret/                         隠しページ（謎解き）
assets/                         画像など
.github/workflows/deploy.yml    自動デプロイ設定
```

## 記事の追加方法

1. `pastarticles/` に記事フォルダを作り、`index.html` を置く
2. `common/site.js` の `ARTICLES` 配列の先頭に記事情報を追記
3. `git push` すると自動で公開される
