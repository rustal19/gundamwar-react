# ポータル化ロードマップ・司令塔引き継ぎメモ

設計は完了済み。本書+[PORTAL_SPEC.md](PORTAL_SPEC.md)(機能仕様)+
[BACKEND_DESIGN.md](BACKEND_DESIGN.md)(サーバー側設計)を読めば、以降は
orchestrator/ORCHESTRATOR.md の手順どおりに回すだけでよい。

## 現在地(2026-07-04 時点)

**フロントエンドのタスク T1〜T10 はすべてマージ済み**(本体テスト 49件全パス)。
統合確認も実施済み: モックで「主催者ログイン → 管理画面 → ラウンド生成(スイス2ラウンド、
bye配分正常)→ 結果入力 → ラウンド完了 → 規定ラウンド後の自動完了 → 順位表(OMW%手計算と
一致)」の通しを確認。ポータルトップ・ニックネームゲート・フッター・公開ページも実画面確認済み。

## 残作業(順番どおりに)

1. フォーマットプリセット登録: ユーザーから禁止・制限・使用可能セットのリストを
   もらい `src/data/formats.js` に追加し、大会作成フォームにプリセット選択を付ける
   (軽作業。司令塔が直接やってよい)
2. 規約・プライバシーの文面承認をユーザーから得る(/terms /privacy、SITE_DESIGN §4 #4)
3. バックエンド: コード到着後 BACKEND_DESIGN.md の B1〜B6
4. デプロイ+本番切替(BACKEND_DESIGN.md §5)
5. 任意の改善: 大会の中止(cancelled)機能(SITE_DESIGN §4 #12)、
   プレイヤー側エントリー+デッキ提出フローの実機通し確認(検証済みなのは主催者側の通し)

※サイト全体の方針と**未決事項リスト(ユーザーに確認するタイミング付き)**は
[SITE_DESIGN.md](SITE_DESIGN.md) §4 を参照。該当タイミングが来たら必ず確認する。

## レビュー時の頻出指摘(ワーカーの癖。毎回チェックすること)

1. **package.json の jest.moduleNameMapper が `../../../node_modules` に書き換えられていないか**。
   クローンに node_modules がないためワーカーが入れるハック。本体では壊れるので必ず戻させる。
   T2・T3 で2回発生済み。差し戻し文例は orchestrator/logs の過去フィードバック参照。
2. **UI 文言が日本語か**(ワーカーは英語文言を入れがち。エラーメッセージ含む)
3. **存在しないファイルの import がないか**。クローンは分岐時点のスナップショットなので、
   他タスクの成果物やリネーム後のファイルを参照していると本体でビルドが壊れる。
   疑わしい import は必ず本体側で Glob して実在確認する
   (なお `src/pages/SearchResults.css` は既存ファイル、公開デッキ用は `PublicDecks.css`)
4. App.js の変更が最小限(import+Route)か
5. localStorage キー・API 形状・関数シグネチャが PORTAL_SPEC.md と一致しているか
6. マージは1件ずつ。マージ後に本体で全テスト(`CI=true npx react-scripts test --watchAll=false`)

## 検証のノウハウ

- **クローンでのテスト実行**: node_modules がないので本体からジャンクション共有する。
  ```
  cmd /c mklink /J "orchestrator\workspaces\<ID>\node_modules" "<本体絶対パス>\node_modules"
  cd orchestrator\workspaces\<ID>; $env:CI="true"; npx react-scripts test --watchAll=false
  ```
  終わったら **merge-task.mjs の前に必ず** `cmd /c rmdir "...\node_modules"` でジャンクションを
  外す(実体ディレクトリになっていたら Remove-Item -Recurse -Force)。
  ※ジャンクション経由だと App.test.js の react-router 解決だけ失敗することがある
  (本体では通る)。その場合はマージ後の本体テストで最終確認すればよい。
- **merge-task.mjs がクローン削除で EPERM になることがある**が、マージと done 化は
  完了している(git log と task.mjs status で確認)。残骸フォルダは手で消す。
- **プレビュー確認**: launch.json の `gundamwar-react`(port 3000)。
  preview_screenshot はこの環境でタイムアウトするので preview_eval で DOM を読む。
  モックデータは localStorage に直接投入(キーは PORTAL_SPEC §4)。
  カード種別判定は `card.card_type_name` / `card.card_type`(`type` ではない)。
  モックログインは `gundamwar.auth.mockUser.v1` に `{ id, name, email, role }` を書くのが速い。
- git の dubious ownership は解消済み(safe.directory 登録済み)。

## ユーザーへの確認待ち

- **フォーマット定義**: フォーマット名ごとの禁止カード・制限カード・使用可能セット
- **バックエンドコード**: サーバーから `gundam war homepage/gundamwar-api/` へコピー
  (SSH 情報は親フォルダ「マニュアル/MySQL関係.txt」)
- デプロイ実施やサーバーへの接続はユーザーの明示了解を得てから
