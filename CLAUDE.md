# このプロジェクトについて

ガンダムウォーカード検索サイトのReactフロントエンド。

このリポジトリは Claude(司令塔)+ Codex(ワーカー)の並列開発体制を使用する。
開発要件を受けたら、必ず先に [orchestrator/ORCHESTRATOR.md](orchestrator/ORCHESTRATOR.md) を読み、
そこに書かれた手順(要件明確化 → タスク分解 → ワーカー起動 → レビュー → マージ)に従うこと。
orchestrator/ はローカル専用ツールで、gitには含めない(.gitignore済み)。

- 開発サーバー: `npm start`(port 3000)
- カードデータ等は親フォルダ(gundam war homepage)の csv/ と scripts/ にある(別リポジトリ)

## 進行中: ポータル化(デッキ公開・大会運営)

設計済み。着手前に必ず読むこと:

- [docs/ROADMAP.md](docs/ROADMAP.md) — 現在地・残作業・レビューチェックリスト・検証ノウハウ
- [docs/DESIGN_HANDOFF.md](docs/DESIGN_HANDOFF.md) — **デザイン・表示調整フェーズの引き継ぎ**(スタイル地図・作業ルール・確認方法・調整候補)
- [docs/SITE_DESIGN.md](docs/SITE_DESIGN.md) — サイト全体の情報設計・運用方針・**未決事項リスト(要ユーザー確認)**
- [docs/PORTAL_SPEC.md](docs/PORTAL_SPEC.md) — 機能仕様(全タスク共通の契約)
- [docs/BACKEND_DESIGN.md](docs/BACKEND_DESIGN.md) — サーバー側の設計(コード到着待ち)
