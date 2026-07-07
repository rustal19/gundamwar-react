# ポータル化仕様書(デッキ公開・大会運営・エントリー)

Melee.gg のようなポータルサイトを目指す拡張の**全タスク共通の契約**。
フロントは本書の API 契約とモック仕様に従って実装する。バックエンド実装が
届くまで、ローカルでは既存の `services/savedDecks.js` と同じ
「mock モード = localStorage」パターンで動作させる。

## 1. ロール

| ロール | 権限 |
|---|---|
| `user` | デッキ保存/公開、大会閲覧、エントリー、デッキリスト提出 |
| `organizer` | 上に加えて大会の作成・運営(自分が作成した大会のみ) |
| `admin` | 上に加えてユーザーへの organizer 権限付与 |

- 認証は既存の Google ログイン(`AuthContext`)を使う。`user` オブジェクトに
  `role: "user" | "organizer" | "admin"` を追加する(未定義は `"user"` 扱い)。
- mock モードでは localStorage キー `gundamwar.auth.mockUser.v1` の JSON に
  `role` を書けば任意ロールでテストできる。モックのログインUIにロール切替を追加してよい。

### ニックネーム(必須)

- `user` に `nickname: string` を追加(2〜20文字、重複可)。**公開される場所
  (公開デッキの owner、大会の参加者一覧・ペアリング・順位表)には必ず nickname を
  表示し、Google アカウント名は本人以外に表示しない。**
- ニックネーム未設定のログインユーザーには登録モーダルを表示し、登録するまで
  公開系の操作(デッキ公開・大会エントリー)をブロックする。
- 変更API: `PUT /api/users/me/profile` — `{ nickname }`。`/profile` ページで変更可。

## 2. データモデル(バックエンド想定。フロントは JSON 形状のみ依存)

### deck(既存 saved deck の拡張)
```
{ id, title, items, isPublic: bool, description: string, publishedAt, createdAt, updatedAt,
  owner: { id, name } }   // owner は公開APIのレスポンスのみ
```
- `items` は DeckContext と同形式: `[{ cardId, count, card, zone: "main"|"side" }]`
- `card` はカード情報スナップショット(検索APIの1件と同形式)
- 公開デッキは**生きた参照**: 公開後にデッキを編集すると公開側にも反映される。
  デッキを削除すると公開も解除される。大会に提出したデッキリストのみスナップショット固定。

### tournament
```
{ id, title, description, format: "swiss" | "single_elim",
  swissRounds: number|null,        // null = 参加者数から自動(ceil(log2(n)))
  topCutSize: number|null,         // swiss のみ。null = カットなし。4/8/16
  status: "draft" | "registration" | "in_progress" | "completed" | "cancelled",
  venue: string|null,              // 開催地(自由記述。「東京・○○」「オンライン」等)
  startsAt, registrationClosesAt, capacity: number|null,
  decklistRequired: bool,
  decklistsPublic: bool,           // 終了後にデッキリストを公開するか(既定 false、主催者が設定)
  regulation: {                    // デッキ構築レギュレーション
    name: string,                  // 例 "スタンダード"
    mainMin: 50, mainMax: 50,      // メイン枚数の下限/上限(ちょうど50 = 両方50)
    sideSize: 10,                  // サイドは 0枚 か sideSize枚ちょうど
    maxCopies: 3,                  // 同名カード上限(メイン+サイド合算)
    bannedCards: string[],         // 禁止(カード名 or cardId、どちらでも一致)
    limitedCards: string[],        // 制限 = 合計1枚まで
    allowedSets: string[]|null     // 使用可能セット。null = 全セット可
  },
  createdBy: { id, name }, entryCount: number, createdAt, updatedAt }
```
- regulation の既定値: `{ name: "スタンダード", mainMin: 50, mainMax: 50, sideSize: 10,
  maxCopies: 3, bannedCards: [], limitedCards: [], allowedSets: null }`
- **フォーマットプリセット**: `src/data/formats.js` に
  `export const FORMAT_PRESETS = [{ name, regulation }]` を定義し、大会作成フォームで
  プリセット選択 → regulation に展開(展開後の個別編集も可)。具体的な禁止・制限リストは
  ユーザーから受領後に登録する(未受領の間は「スタンダード」既定値のみ)。

### entry(大会参加)
```
{ id, tournamentId, user: { id, name },
  deckItems: [...]|null,           // 提出時点のスナップショット(items と同形式)
  decklistSubmittedAt: string|null,
  status: "registered" | "checked_in" | "dropped",
  createdAt }
```

### round / match
```
round: { id, tournamentId, number, stage: "swiss" | "top_cut",
         status: "in_progress" | "completed" }
match: { id, roundId, tableNo, player1EntryId, player2EntryId|null,  // null = 不戦勝(bye)
         result: "p1_win" | "p2_win" | "draw" | "bye" | null }
```

## 3. API 契約

すべて `credentials: "include"`、JSON。エラーは `{ error: string }` と HTTP ステータス。
一覧系は `{ items: [...], total, page, pageSize }` のページング形式。

### 公開(認証不要)
- `GET  /api/public-decks?page=&query=` — 公開デッキ一覧(新着順、query はタイトル・ユーザー名部分一致)
- `GET  /api/public-decks/:id` — 公開デッキ詳細(deck 形状)
- `GET  /api/tournaments?status=&page=` — 大会一覧(`draft` は作成者以外に非表示)
- `GET  /api/tournaments/:id` — 大会詳細
- `GET  /api/tournaments/:id/standings` — 順位表(§5 のタイブレーカー込み)
- `GET  /api/tournaments/:id/rounds` — ラウンドとマッチの一覧(`{ rounds: [{...round, matches: [...] }] }`)
  - デッキリストは「status が `completed` **かつ** `decklistsPublic` が true」の場合のみ
    本人と主催者以外に返す(entries も同じルール)
- `GET  /api/tournaments/:id/standings?round=N` — `round` 指定時は第Nラウンド終了時点の
  順位表(そのラウンドまでの matches のみで計算)。省略時は最新

### 認証ユーザー
- `PUT  /api/users/me/profile` — `{ nickname }` の変更
- `PATCH /api/decks/:id` — `{ isPublic, description }` の変更(公開/非公開切替)
- `POST /api/tournaments/:id/entries` — エントリー `{ deckItems?: [...] }`
- `PUT  /api/tournaments/:id/entries/me` — 自分のデッキリスト提出/差し替え(締切前のみ)
- `DELETE /api/tournaments/:id/entries/me` — エントリー取消(開始前のみ)
- `POST /api/tournaments/:id/entries/me/drop` — 自主ドロップ(進行中でもラウンド間なら可)
- デッキリスト提出はサーバー側で §5 の `validateDeck(items, regulation)` により検証し、
  **違反があれば 400 `{ error, violations }` で提出を拒否**する(フロントも提出前に同チェックを行い
  違反内容を表示する)。

### organizer(自分が作成した大会のみ)
- `POST /api/tournaments` / `PUT /api/tournaments/:id` — 作成・編集(status 変更含む)
- `GET  /api/tournaments/:id/entries` — 参加者一覧(デッキリスト込み)
- `PUT  /api/tournaments/:id/entries/:entryId` — `{ status }` 変更(チェックイン/ドロップ)
- `POST /api/tournaments/:id/rounds` — 次ラウンドのペアリング生成(§5 のアルゴリズム)。
  swiss の規定ラウンド(`swissRounds`、null なら `ceil(log2(参加者数))`)終了後に呼ぶと、
  `topCutSize` 指定時は順位表上位でトップカット(stage: `top_cut`)のブラケットを自動生成する
- `PUT  /api/matches/:id/result` — `{ result }` 報告
- `PUT  /api/rounds/:id` — `{ status: "completed" }`(全卓結果必須)

### admin
- `GET  /api/users?query=` / `PUT /api/users/:id/role` — organizer 権限付与
- `PATCH /api/decks/:id` — admin は他人のデッキも `{ isPublic: false }` にできる(強制非公開)
- `DELETE /api/users/:id/nickname` — ニックネームの強制リセット(該当ユーザーは次回、再登録を求められる)

## 4. フロントエンド構成

### ルート(App.js に追加)

全体のページマップと「/ = ポータルトップ、検索は /search」への変更は
[SITE_DESIGN.md](SITE_DESIGN.md) §1 を参照。

| パス | ページ | 備考 |
|---|---|---|
| `/decks` | 公開デッキ一覧 | 検索ボックス+ページング |
| `/decks/:id` | 公開デッキ詳細 | デッキビルダーと同じ種別グルーピング表示(`utils/deckExport.js` を再利用) |
| `/tournaments` | 大会一覧 | |
| `/tournaments/:id` | 大会詳細 | 概要/参加者/ペアリング/順位表タブ+エントリー導線 |
| `/tournaments/:id/manage` | 主催者コンソール | organizer のみ。403 相当はメッセージ表示 |
| `/admin/users` | 権限管理 | admin のみ |
| `/profile` | プロフィール | ニックネーム設定・変更 |

- 公開デッキ詳細には「このデッキをコピー」ボタン(DeckContext の `replaceDeck` で
  デッキビルダーへ取り込み → `/deck` へ遷移。ログイン不要)。

- 各ページは既存パターンに従い `compact` prop でモバイル対応する。
- ヘッダー(AppHeader / MobileAppHeader)に「デッキ」「大会」リンクを追加。

### サービス層(mock パターン必須)
`services/savedDecks.js` と同じ構造: `authMode === "mock"` なら localStorage、
それ以外は fetch。**公開系(ログイン不要)の閲覧はモック時、ダミーデータ+
localStorage 上の公開デッキ/大会を合成して返す。**

| ファイル | 対象 | mock 用 localStorage キー |
|---|---|---|
| `services/publicDecks.js` | 公開デッキ一覧/詳細/公開切替 | `gundamwar.publicDecks.v1` |
| `services/tournaments.js` | 大会 CRUD/エントリー/ラウンド/結果 | `gundamwar.tournaments.v1` |

## 5. ペアリング・順位計算(`src/utils/tournament/`)

**純粋関数**として実装し、Jest テストを付ける(バックエンドでも同じファイルを使うため
React/DOM に依存しないこと)。

### swissPairing.js
`pairSwissRound(entries, previousMatches)` → `[{ player1EntryId, player2EntryId|null }]`
- dropped を除外。勝点順(勝ち3/分け1/負け0、bye は勝ち扱い)にグループ化し、
  同グループ内で未対戦の相手を優先してペアリング。奇数なら最下位グループの
  bye 未経験者に bye。再戦は全探索で回避できない場合のみ許容。
- 決定的にするため、同条件の並びは entryId 昇順。

### singleElimination.js
`buildBracket(entryIds)` → 1回戦マッチ配列(2の冪に満たない分は上位シードに bye)
`nextRoundPairs(matches)` → 勝者同士の次ラウンドペア
- シード順は引数の配列順(swiss からのトップカット時は順位表順を渡す)。

### deckValidation.js
`validateDeck(items, regulation)` → 違反配列 `[{ code, message, cardName? }]`(空配列 = 合格)
- チェック内容(regulation は §2 の形状):
  - `main_count`: メイン合計枚数が `mainMin`〜`mainMax` の範囲内
  - `side_count`: サイド合計枚数が 0 または `sideSize` ちょうど
  - `max_copies`: 同名カード(`card.name`)のメイン+サイド合算が `maxCopies` 以下
  - `banned` / `limited`: `bannedCards` は0枚、`limitedCards` は合計1枚まで
    (カード名・cardId のどちらで指定されても一致させる)
  - `allowed_sets`: `allowedSets` 指定時、全カードの収録セットが範囲内。
    カードのセット情報の取り出しは `getCardSets(card)` ヘルパーに閉じ込める
    (検索APIのカード形状のセット関連フィールドを確認して実装)
- `message` は日本語でユーザーに表示できる文言にする。

### standings.js
`computeStandings(entries, matches)` → 順位表配列
- 勝点 → OMW%(オポネント・マッチ勝率、bye 除外、下限 1/3)→ 直接対決 → entryId。
- 出力: `[{ entryId, rank, wins, losses, draws, points, omwPercent }]`

## 6. タスク間の共有ルール

- 本書の JSON 形状・localStorage キー・関数シグネチャを変更したい場合は
  実装を止めて BLOCKED で司令塔に相談する(勝手に変えない)。
- ルート追加で App.js を触るのは最小限(Route 1行+import)に留める。
- スタイルは既存の `App.css` / `mobile.css` の変数・クラス命名に合わせる。
