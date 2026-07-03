# このプロジェクトについて

ガンダムウォーカード検索サイトのReactフロントエンド。

このリポジトリは Claude(司令塔)+ Codex(ワーカー)の並列開発体制を使用する。
開発要件を受けたら、必ず先に [orchestrator/ORCHESTRATOR.md](orchestrator/ORCHESTRATOR.md) を読み、
そこに書かれた手順(要件明確化 → タスク分解 → ワーカー起動 → レビュー → マージ)に従うこと。
orchestrator/ はローカル専用ツールで、gitには含めない(.gitignore済み)。

- 開発サーバー: `npm start`(port 3000)
- カードデータ等は親フォルダ(gundam war homepage)の csv/ と scripts/ にある(別リポジトリ)
