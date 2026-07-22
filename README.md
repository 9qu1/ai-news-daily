# AIデイリー — 毎日5分でわかるAIニュース

毎朝自動更新されるAIニュースメディア。Claudeのスケジュール実行が記事を生成し、GitHub Actionsがビルド・公開・SNS告知まで自動で行う。

- 公開URL: https://9qu1.github.io/ai-news-daily/
- 収益化: アフィリエイト(もしも/A8) + 将来的にGoogle AdSense

## 仕組み

```
毎朝7時(JST) Claudeスケジュール実行
  → Web検索でAIニュース収集 → articles/YYYY-MM-DD-daily.md を生成 → git push
    → GitHub Actions: build.js で dist/ 生成 → GitHub Pages へデプロイ
    → 新着記事があれば scripts/post-bluesky.mjs がBlueskyに自動投稿
```

- 日曜: 週間まとめ記事も生成
- 水曜: 入門ガイド/ツール記事も1本生成
- 記事生成ルールの詳細: [CLAUDE.md](CLAUDE.md)

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `articles/*.md` | 記事(フロントマター+Markdown)。エージェントが毎日追加 |
| `pages/*.md` | 固定ページ(サイトについて・プライバシーポリシー・お問い合わせ) |
| `config/site.json` | サイト名・URL・SNSハンドル。独自ドメイン移行時はここの `url` を変更 |
| `config/ads.json` | 広告コード置き場。貼るだけで全記事に反映(空なら非表示) |
| `build.js` | 静的サイトジェネレーター(Node + marked) |
| `src/styles.css` | サイトデザイン(ライト/ダーク対応) |
| `scripts/serve.mjs` | ローカルプレビュー(ポート4500) |
| `scripts/post-bluesky.mjs` | Bluesky自動投稿(要シークレット設定) |
| `.github/workflows/deploy.yml` | ビルド→Pages公開→Bluesky告知 |

## コマンド

```bash
npm install        # 初回のみ
npm run build      # dist/ にサイト生成
npm run serve      # http://localhost:4500 でプレビュー
```

## 運用メモ

- 広告掲載時はステマ規制(景表法)対応のPR表記をテンプレートが自動挿入する
- X(Twitter)はAPI無料枠廃止のため自動投稿しない(手動シェアのみ)。Blueskyは無料APIで自動投稿
- ユーザー側の残作業は [TODO-あなたの作業.md](TODO-あなたの作業.md) を参照
