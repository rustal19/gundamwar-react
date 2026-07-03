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

## 2. データモデル(バックエンド想定。フロントは JSON 形状のみ依存)

### deck(既存 saved deck の拡張)
```
{ id, title, items, isPublic: bool, description: string, publishedAt, createdAt, updatedAt,
  owner: { id, name } }   // owner は公開APIのレスポンスのみ
```
- `items` は DeckContext と同形式: `[{ cardId, count, card, zone: "main"|"side" }]`
- `card` はカード情報スナップショット(検索APIの1件と同形式)

### tournament
```
{ id, title, description, format: "swiss" | "single_elim",
  swissRounds: number|null,        // null = 参加者数から自動(ceil(log2(n)))
  topCutSize: number|null,         // swiss のみ。null = カットなし。4/8/16
  status: "draft" | "registration" | "in_progress" | "completed" | "cancelled",
  startsAt, registrationClosesAt, capacity: number|null,
  decklistRequired: bool,
  createdBy: { id, name }, entryCount: number, createdAt, updatedAt }
```

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
  - デッキリストは大会 status が `completed` になるまで本人と主催者以外に返さない

### 認証ユーザー
- `PATCH /api/decks/:id` — `{ isPublic, description }` の変更(公開/非公開切替)
- `POST /api/tournaments/:id/entries` — エントリー `{ deckItems?: [...] }`
- `PUT  /api/tournaments/:id/entries/me` — 自分のデッキリスト提出/差し替え(締切前のみ)
- `DELETE /api/tournaments/:id/entries/me` — エントリー取消(開始前のみ)

### organizer(自分が作成した大会のみ)
- `POST /api/tournaments` / `PUT /api/tournaments/:id` — 作成・編集(status 変更含む)
- `GET  /api/tournaments/:id/entries` — 参加者一覧(デッキリスト込み)
- `PUT  /api/tournaments/:id/entries/:entryId` — `{ status }` 変更(チェックイン/ドロップ)
- `POST /api/tournaments/:id/rounds` — 次ラウンドのペアリング生成(§5 のアルゴリズム)
- `PUT  /api/matches/:id/result` — `{ result }` 報告
- `PUT  /api/rounds/:id` — `{ status: "completed" }`(全卓結果必須)

### admin
- `GET  /api/users?query=` / `PUT /api/users/:id/role` — organizer 権限付与

## 4. フロントエンド構成

### ルート(App.js に追加)
| パス | ページ | 備考 |
|---|---|---|
| `/decks` | 公開デッキ一覧 | 検索ボックス+ページング |
| `/decks/:id` | 公開デッキ詳細 | デッキビルダーと同じ種別グルーピング表示(`utils/deckExport.js` を再利用) |
| `/tournaments` | 大会一覧 | |
| `/tournaments/:id` | 大会詳細 | 概要/参加者/ペアリング/順位表タブ+エントリー導線 |
| `/tournaments/:id/manage` | 主催者コンソール | organizer のみ。403 相当はメッセージ表示 |
| `/admin/users` | 権限管理 | admin のみ |

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

### standings.js
`computeStandings(entries, matches)` → 順位表配列
- 勝点 → OMW%(オポネント・マッチ勝率、bye 除外、下限 1/3)→ 直接対決 → entryId。
- 出力: `[{ entryId, rank, wins, losses, draws, points, omwPercent }]`

## 6. タスク間の共有ルール

- 本書の JSON 形状・localStorage キー・関数シグネチャを変更したい場合は
  実装を止めて BLOCKED で司令塔に相談する(勝手に変えない)。
- ルート追加で App.js を触るのは最小限(Route 1行+import)に留める。
- スタイルは既存の `App.css` / `mobile.css` の変数・クラス命名に合わせる。
