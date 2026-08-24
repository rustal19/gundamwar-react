# バックエンド設計(gundamwar.net 拡張)

フロントの契約は [PORTAL_SPEC.md](PORTAL_SPEC.md) が正。本書はそれをサーバー側で
実装するための設計。**実コードはまだ手元にない**(ユーザーがサーバーからコピーして
`gundam war homepage/gundamwar-api/` に置く予定)。届いたら「§1 確認チェックリスト」から始める。

## 1. コード到着後の確認チェックリスト

既知の情報: Node.js 製、port 3001、MySQL(port 3306)、フロント配置先 /var/www/build、
SSH接続情報は親フォルダの「マニュアル/MySQL関係.txt」。

- [ ] フレームワーク(Express か)とルーティングの構成
- [ ] DB アクセス方法(mysql2 直? ORM?)と接続設定の場所
- [ ] セッション方式(`/api/auth/session` があるので cookie セッションのはず。ミドルウェア名と `req.user` 相当の取り出し方)
- [ ] 既存 `users` / `decks` テーブルの実スキーマ(特に users.id の型 = Google sub か)
- [ ] CORS 設定(localhost:3000 からの credentials 付きリクエスト可否)
- [ ] サーバープロセスの起動方式(pm2 / systemd / nohup)と再起動手順
- [ ] `/api/decks` のレスポンス形状が PORTAL_SPEC §2 deck と一致するか

確認結果は本書に追記してから実装タスクに進む。

## 1.5 確認結果(2026-08-24 / SSH実機調査)

コードはサーバー稼働中のものを **ローカルへ git clone 済み**(`gundam war homepage/gundamwar-api/`)。
スクレイピング対策作業+DB調査で §1 の大半が判明:

- **フレームワーク**: Express。ルートは `index.js`(`/api/search`)+ `auth-routes.js`
  (`/api/auth/*`, `/api/decks`, `/api/decks/:id`)。
- **DB**: mysql2 プール(`promisePool`)。接続情報は `.env`(`DB_HOST/PORT/USER/PASSWORD/NAME`)。
- **セッション**: cookie `gw_session`。`auth_sessions` に sha256 ハッシュ保存。
  `requireAuthenticatedUser` ミドルウェアで解決。
- **CORS**: `cors()` で `localhost:3000` / `gundamwar.net`(credentials 可)。
- **起動方式**: **systemd `gundamwar-api.service`**。再起動 `sudo systemctl restart gundamwar-api`
  (pm2 は**フロント react-app 専用**。API は pm2 管理ではない)。
- **⚠ 実スキーマは設計の想定と相違**(重要):
  - ユーザーは **`auth_users`**、**`id BIGINT UNSIGNED`(自動採番)**。`google_sub` は別カラム。
    → 設計の「users.id = Google sub の VARCHAR(64)」は**誤り**。大会系の `created_by`/`user_id` は
    **`BIGINT UNSIGNED`(auth_users.id 参照)** とする。
  - デッキは **`saved_decks`**(`user_id BIGINT UNSIGNED`, `items_json LONGTEXT`)。
  - `nickname`/`role`/`is_public` 等はまだ無い → §2 の ALTER は `auth_users`/`saved_decks` を対象に修正。
  - **修正版マイグレーションは `gundamwar-api/migrations/001_portal_schema.sql` に作成済み(加算のみ・未適用)**。

### 本番を壊さないための実施方針(このプロジェクト全体の原則)
- **開発は全てローカル**(clone 済みリポジトリ+ローカル or トンネル DB)。本番へは触れない。
- **マイグレーションは加算のみ**(新規テーブル+NULL/DEFAULT カラム)。既存の検索/認証/デッキは無改変。
  適用前に必ず `mysqldump` バックアップ。
- **反映は既存の安全フロー**: バックアップ → `node --check` → scp → サーバーで `node --check`
  → `sudo systemctl restart gundamwar-api` → 読み取り curl で検証 → 問題あれば `.bak` からロールバック。
- **本番に触れる操作(DB適用・デプロイ)は都度ユーザーに確認**してから(Claude Code は本番書き込み/sudo が
  分類器でブロックされるため、実行はユーザー。読み取り SSH は可)。

## 2. DB スキーマ(MySQL)

既存テーブルは ALTER、新規4テーブルを追加。適用した SQL は `migrations/` に保存する。
※ users.id の型は実スキーマ確認後に合わせる(以下は VARCHAR(64) 仮定)。

```sql
ALTER TABLE users
  ADD COLUMN nickname VARCHAR(20) NULL,
  ADD COLUMN role ENUM('user','organizer','admin') NOT NULL DEFAULT 'user';

ALTER TABLE decks
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN format VARCHAR(50) NULL,
  ADD COLUMN published_at DATETIME NULL;

CREATE TABLE tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  format ENUM('swiss','single_elim') NOT NULL DEFAULT 'swiss',
  swiss_rounds INT NULL,           -- NULL = ceil(log2(参加者数))
  top_cut_size INT NULL,           -- swiss のみ有効
  status ENUM('draft','registration','in_progress','completed','cancelled')
    NOT NULL DEFAULT 'draft',
  venue VARCHAR(200) NULL,
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  self_checkin TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  registration_closes_at DATETIME NULL,
  capacity INT NULL,
  decklist_required TINYINT(1) NOT NULL DEFAULT 1,
  decklists_public TINYINT(1) NOT NULL DEFAULT 0,
  announcement TEXT NULL,
  round_time_minutes INT NULL,
  late_entry TINYINT(1) NOT NULL DEFAULT 0,
  regulation JSON NOT NULL,        -- PORTAL_SPEC §2 の regulation 形状
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status)
);

CREATE TABLE tournament_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  user_id VARCHAR(64) NULL,        -- NULL = ゲスト(主催者の手動追加)
  guest_name VARCHAR(20) NULL,     -- ゲストの表示名(user_id が NULL のとき必須)
  deck_items JSON NULL,            -- 提出時スナップショット(items 形式)
  decklist_submitted_at DATETIME NULL,
  status ENUM('pending','registered','checked_in','dropped') NOT NULL DEFAULT 'registered',
  joined_at_round INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entry (tournament_id, user_id),
  KEY idx_tournament (tournament_id)
);

CREATE TABLE rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  number INT NOT NULL,
  stage ENUM('swiss','top_cut') NOT NULL DEFAULT 'swiss',
  status ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  timer_started_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_round (tournament_id, number)
);

CREATE TABLE matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  round_id INT NOT NULL,
  table_no INT NOT NULL,
  player1_entry_id INT NOT NULL,
  player2_entry_id INT NULL,       -- NULL = bye
  player1_games INT NULL,          -- BO3スコア(2-1 の 2)
  player2_games INT NULL,
  result ENUM('p1_win','p2_win','draw','bye') NULL,  -- スコアから導出して保存
  reported_at DATETIME NULL,
  KEY idx_round (round_id)
);
```

## 3. 実装方針

- **ルーター分割**: `routes/publicDecks.js` / `routes/tournaments.js` / `routes/users.js` を追加。
  エンドポイントと入出力は PORTAL_SPEC §3 のとおり。
- **認可ミドルウェア**: 既存のセッション→ユーザー解決を再利用し、
  `requireAuth` / `requireOrganizer`(+対象大会の created_by 一致チェック) / `requireAdmin` を追加。
- **ロジックの共有**: `src/utils/tournament/*.js` と `src/utils/deckValidation.js`(T7 成果物)は
  純粋関数・依存ゼロなので、**react 側を正としてサーバーへコピー**して使う
  (`server/lib/` 等に配置。ESM/CJS 差異があれば変換)。変更時は必ず両方を更新する。
- **サーバーが最終判定**: 提出デッキの validateDeck、status 遷移の妥当性、締切・定員・権限は
  フロントに関係なくサーバー側で検証する(400/403 と `{ error }`、検証violationは
  `{ error, violations }`)。
- **順位表・ペアリング**: standings は GET のたびに matches から計算(キャッシュ不要の規模)。
  ラウンド生成は POST /rounds 時にサーバーで pairSwissRound / buildBracket を実行して
  matches を INSERT。
- **認証レスポンス拡張**: `/api/auth/session` / `/api/auth/google` の user に
  `nickname` と `role` を含める(フロントの normalizeUser は対応済み)。
- **ニックネーム公開**: 公開系レスポンス(public-decks の owner、entries の user、standings)では
  `name` に **nickname を入れて返す**(Google 名は本人向け `/api/auth/session` のみ)。
  フロント側の変更を不要にするための方針。

## 4. バックエンドタスク分解(コード到着後に登録)

| ID | 内容 | 依存 |
|---|---|---|
| B1 | §1 チェックリストの調査+本書更新+DBマイグレーション適用(migrations/ 作成) | — ※司令塔直轄推奨 |
| B2 | users: profile API・role API・auth レスポンスへの nickname/role 追加 | B1 |
| B3 | public-decks API(一覧/詳細)+ decks PATCH(公開切替) | B1 |
| B4 | tournaments 閲覧系(一覧/詳細/standings/rounds、デッキリスト秘匿) | B1 |
| B5 | entries(エントリー/提出/取消/ドロップ、validateDeck 統合) | B4 |
| B6 | 運営系(作成/編集/参加者管理/ラウンド生成/結果/完了)+ admin users | B4 |

実施体制は次のいずれか:
1. `gundamwar-api/` に `gundamwar-react/orchestrator/` を丸ごとコピーし
   (config.json の projectName を "gundamwar-api" に変更。projectRoot は ".." のままで可)、
   同じ「司令塔+ワーカー」で回す(api リポジトリが git 管理なら clone モードが効く。
   git 管理でなければ `git init` してから)
2. 規模が小さいと判断すれば司令塔が直接実装

## 5. 開発時の接続とデプロイ

- ローカル開発: SSH トンネル `ssh -i ~/.ssh/id_rsa -L 3307:127.0.0.1:3306 rustal19@34.168.173.251`
  で本番 DB に接続(または ローカル MySQL)。フロントは `.env` に
  `REACT_APP_API_BASE_URL=http://localhost:3001` を設定すると mock ではなく実 API を叩く。
- フロントのデプロイ(既存手順): `npm run build` → サーバーの `~/uploads/build` へアップ →
  `sudo rm -rf /var/www/build && sudo mv ~/uploads/build /var/www/`
- バックエンドのデプロイ: 起動方式を §1 で確認後にここへ追記する。
- DB マイグレーション: §2 の SQL を手動適用(適用前にバックアップ:
  `mysqldump` を推奨。既存 users/decks に触るため)。
