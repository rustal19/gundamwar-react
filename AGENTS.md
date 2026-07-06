# Codex エージェント向けの指示(gundamwar-react)

ガンダムウォーカード検索サイトのReactフロントエンド。

## あなたがワーカーとして起動された場合(プロンプトが「[ワーカー」で始まる)

orchestrator/ORCHESTRATOR.md は司令塔用の文書なので**読む必要はない**。
タスクプロンプトの指示だけに従い、次のルールを守ること:

- 指定されたタスクの範囲外のファイルを変更しない。範囲外の問題は直さず BLOCKED で報告する
- git add / commit / push はしない(完了時に自動コミットされる)
- `npm install` は指示された場合のみ実行する(クローンには node_modules がない)
- テキストファイルは UTF-8(BOMなし)。PowerShellで文字化けして見えても既存内容を壊さない
- UIの文言は日本語。既存コンポーネントのスタイル・命名規則に合わせる
- 完了したら「DONE: <要約>」、続行不能なら「BLOCKED: <理由と質問>」で終える

## あなたが司令塔として使われる場合

[orchestrator/ORCHESTRATOR.md](orchestrator/ORCHESTRATOR.md) を読み、その手順に従うこと。
