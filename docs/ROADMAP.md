# ポータル化ロードマップ・司令塔引き継ぎメモ

設計は完了済み。本書+[PORTAL_SPEC.md](PORTAL_SPEC.md)(機能仕様)+
[BACKEND_DESIGN.md](BACKEND_DESIGN.md)(サーバー側設計)を読めば、以降は
orchestrator/ORCHESTRATOR.md の手順どおりに回すだけでよい。

## 現在地(2026-07-09 時点)

**フロントエンドは全フェーズ完了**:

- 機能実装 T1〜T10(2026-07-04)+ **デザイン・UI実装 T11〜T26 = D/V/U/M/P 系16タスク
  (2026-07-08〜09)すべてマージ済み**
- 本体テスト **85件全パス**、`CI=true` の本番ビルド成功
- 全機能がモック(localStorage)で動作: サイドバー・道具箱トップ・大会運営
  (BO3・途中参加・タイマー・アナウンス・掲示用表示)・マイページ・公開プロフィール・404
- レビューで捕捉して直した代表例: ログインボタンの機能喪失(U1)・テーマ外の色温存(D1)・
  英語見出し・CIビルドを壊す react-hooks 警告(司令塔が直接修正)

## 残作業(順番どおりに)

1. **ユーザーによる実機確認**: プレビューで全画面を触ってもらい、気になる箇所を
   調整タスク化(モックログインのロール切替で organizer/admin も確認可能)
2. フォーマットプリセット登録: ユーザーからリストをもらい `src/data/formats.js` へ
   (現在は「スタンダード+その他」)
3. 規約・プライバシーの文面承認をユーザーから得る(SITE_DESIGN §4 #4)
4. バックエンド: コード到着後 BACKEND_DESIGN.md の B1〜B6(スキーマは最新化済み)
5. デプロイ+本番切替(BACKEND_DESIGN.md §5)

### 運用メモ(今回の教訓)

- ワーカーをシェルの `&` で起動する場合は **nohup 必須**(シェル終了で殺されて
  in_progress のまま宙に浮く。復旧は `run-task <ID> --feedback "中断から再開"` —
  thread_id とクローンが残っていればセッションごと再開できる)
- Codex の5時間利用上限に当たると blocked になる → リセット後に `task.mjs retry <ID>`

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
