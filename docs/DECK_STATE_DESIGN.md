# 大会デッキリストの状態設計(#28)+ 大会紐付け(#24/#25 の土台)

起案: 2026-08-26(司令塔)。**レビュー待ち。★印はユーザーの判断が要る箇所。**
関連: [FEEDBACK_BACKLOG.md](FEEDBACK_BACKLOG.md) #28 / #24 / #25 / #31、
[AUDIT_DECK_VISIBILITY.md](AUDIT_DECK_VISIBILITY.md)、[PORTAL_SPEC.md](PORTAL_SPEC.md) §エントリー。

## 1. 現状(調査結果)

### 1.1 データモデル

- 保存デッキ: `saved_decks(id, user_id, title, items_json, is_public, description, format, published_at)`
- 大会エントリー: `tournament_entries(id, tournament_id, user_id, guest_name, deck_items JSON,
  decklist_submitted_at, status, joined_at_round, ...)`
- **提出デッキは `deck_items` に JSON スナップショットとして入るだけ**で、
  元の `saved_decks` への参照(deck_id)も、提出時のフォーマットも、順位も持たない。

### 1.2 提出可否の判定(`routes/entries.js` の `can_submit_decklist`)

```
status が registration / in_progress 以外        → 提出不可
registration_closes_at が NULL かつ registration → 提出可
registration_closes_at があり かつ 現在 < 締切    → 提出可
それ以外                                          → 提出不可
```

**ここに #28 が指す穴がある**: `registration_closes_at` を設定した大会では、
**status が `in_progress`(=大会開始後・初戦生成後)でも締切前なら提出・差し替えができる**。
締切を未設定にした大会だけ、たまたま開始と同時に締まる。つまり
「大会開始でロック」は現状**保証されていない**。

### 1.3 参照制御(#29 で監査済み・維持する前提)

提出デッキが第三者に見えるのは「`status === 'completed'` かつ `decklistsPublic`」のときだけ。
本設計はこの条件を土台にする(緩めない)。

## 2. 決めたい論点(★ユーザー判断)

| # | 論点 | 選択肢 | 起案者の推奨 |
|---|---|---|---|
| ★A | ロックのタイミング | (1) status が `in_progress` になった時 / (2) 初戦(第1ラウンド)生成時 / (3) 受付締切時刻 | **(2) 初戦生成時**。#6 で「スイス回数は初戦生成時に確定」と決めており、基準を揃えられる。開始前の準備中に status だけ進めても事故らない |
| ★B | ロック後の修正 | (1) 誰も不可 / (2) 主催者のみ修正可(記録を残す) / (3) 本人も締切前なら可 | **(2) 主催者のみ**。デッキ登録ミスの救済は運営判断で行われる実務がある。監査のため `deck_locked_at` と別に「主催者が上書きした」記録を残す |
| ★C | 途中参加(late entry)のロック | (1) 参加時点で即ロック / (2) その回戦のペアリング生成時 | **(1) 即ロック**。途中参加は提出とほぼ同時なので単純な方が安全 |
| ★D | 終了後の公開導線 | (1) 自動公開しない(本人が明示的に公開) / (2) `decklistsPublic` の大会は自動で公開デッキ化 | **(1) 自動公開しない**。`decklistsPublic` は「大会ページで閲覧できる」という意味に留め、公開デッキ一覧への掲載は本人の意思で行う(#31 のフォーマット必須チェックも通す) |
| ★E | 1つの保存デッキを複数大会に出した場合、デッキ詳細に出す大会 | (1) 全部(新しい順) / (2) 直近1件のみ | **(1) 全部**。戦績の履歴として意味がある。ただし §4 の可視条件を必ず通す |

## 3. 提案する状態機械

エントリー1件につき、デッキリストの状態は次の4つ。**状態は保存せず、既存列+新列から導出する**
(状態列を持つと更新漏れで実態とズレるため)。

| 状態 | 導出条件 | 本人の操作 | 主催者の操作 |
|---|---|---|---|
| `none`(未提出) | `decklist_submitted_at IS NULL` かつ `deck_locked_at IS NULL` | 提出できる | 代理提出できる |
| `submitted`(提出済み・差し替え可) | `decklist_submitted_at` あり かつ `deck_locked_at IS NULL` | 差し替えできる | 差し替えできる |
| `locked`(ロック済み) | `deck_locked_at` あり かつ 大会が `completed` でない | **不可** | ★B次第(推奨: 可・記録あり) |
| `revealed`(公開可) | 大会が `completed` かつ `decklists_public` | 不可 | 不可 |

未提出のままロック時刻を迎えた場合は `deck_locked_at` を入れたうえで `none` のまま扱い、
「未提出でロックされた」= 主催者が代理提出しない限り提出不能、とする。

## 4. スキーマ変更(加算のみ・既存列は変更しない)

```sql
ALTER TABLE tournament_entries
  ADD COLUMN deck_id BIGINT UNSIGNED NULL,        -- 提出元 saved_decks.id(削除されても snapshot は残る)
  ADD COLUMN deck_format VARCHAR(50) NULL,        -- 提出時のフォーマット名(検証の記録)
  ADD COLUMN deck_locked_at DATETIME NULL,        -- ロック時刻(§3)
  ADD COLUMN deck_updated_by BIGINT UNSIGNED NULL,-- ロック後に上書きした主催者(★B=(2)のとき)
  ADD COLUMN final_rank INT NULL,                 -- 確定順位(大会完了時に書き込む。#25用)
  ADD KEY idx_entry_deck (deck_id);
```

- `deck_items`(スナップショット)は**引き続き正**。`deck_id` は「どの保存デッキから出したか」の
  参照でしかなく、保存デッキを後から編集しても提出内容は変わらない(現在の挙動を明文化)。
- `final_rank` は大会を `completed` にする処理で順位表から書き込む。
  順位表から都度導出してもよいが、SE(トップカット)導入後は再計算コストと定義揺れが出るため確定値を持つ。
- 参加人数(#25)は `tournaments` に列を足さず `COUNT(tournament_entries)` で出す
  (途中参加・ドロップで変動するため、確定値を持つ意味が薄い)。

## 5. API の変更

### 5.1 ロックの実行
- 初戦生成(`POST /api/tournaments/:id/rounds` 相当)の中で、対象大会の全エントリーに
  `deck_locked_at = CURRENT_TIMESTAMP`(NULL のものだけ)を一括セット。★A=(2) の場合。
- 途中参加の追加時は、その大会が `in_progress` なら作成と同時に `deck_locked_at` をセット(★C)。

### 5.2 提出ゲートの修正
`can_submit_decklist` に `AND e.deck_locked_at IS NULL` を加える。
これにより「締切未到来でも開始後は提出不可」になり、#28 の穴が閉じる。

### 5.3 レスポンス契約(PORTAL_SPEC §エントリーに追記)
```
entry: {
  ...既存,
  deckId: string|null,          // 参照のみ。deckItems が正
  deckFormat: string|null,
  decklistState: 'none'|'submitted'|'locked'|'revealed',   // §3 の導出結果
  deckLockedAt: string|null,
  finalRank: number|null,
}
```
`decklistState` はサーバーで導出して返す(フロントに条件を再実装させない)。

### 5.4 大会紐付けの逆引き(#24/#25)
公開デッキ詳細 `GET /api/public-decks/:id` に `tournaments[]` を追加する。

```sql
SELECT t.id, t.title, e.final_rank,
       (SELECT COUNT(*) FROM tournament_entries x WHERE x.tournament_id = t.id) AS entry_count
FROM tournament_entries e
INNER JOIN tournaments t ON t.id = e.tournament_id
WHERE e.deck_id = ?
  AND t.status = 'completed'        -- ★進行中の大会参加を漏らさないための必須条件
ORDER BY t.starts_at DESC
```

**`t.status = 'completed'` は #29 の要請そのもの**なので外さないこと。
進行中の大会に出しているという事実自体がメタゲーム情報になるため、
「デッキは公開だが大会は進行中」のケースでは大会名を出さない。

> なお `decklists_public` はここでは条件に**入れない**。公開デッキ一覧に出ているデッキは
> 本人が公開を選んだものであり、「そのデッキがどの完了大会で使われたか」は
> 本人の公開範囲に含まれると解釈する。★この解釈でよいか要確認。

## 6. モック側(gundamwar-react/src/services)

モックは API と同じ状態機械・同じ可視条件を実装する(#29 の教訓)。
- `tournaments.js`: エントリーに `deckId` / `deckFormat` / `deckLockedAt` / `finalRank` を持たせ、
  `decklistState` を導出して返す。初戦生成時に一括ロック。
- `publicDecks.js`: `fetchPublicDeck` の戻りに `tournaments[]` を足す(条件は §5.4 と同一)。
- #24 で入れた `normalizeTournamentReference` は、この `tournaments[]` を読む形に置き換える。

## 7. 実装タスク分割(案)

| 順 | 内容 | 担当 | 依存 |
|---|---|---|---|
| 1 | モック側に状態機械+ロックを実装(UI表示含む) | W | ★A〜C 確定後 |
| 2 | 大会詳細/マイページに `decklistState` に応じた表示(提出済み・ロック済み・締切後) | W | 1 |
| 3 | 公開デッキ詳細の `tournaments[]` 表示(#24 の大会名・#25 の順位/参加人数) | W | 1 |
| 4 | マイグレーション 002 と API 実装(§4/§5) | 司 | ★A〜E 確定後 |
| 5 | 本番適用(バックアップ→適用→再起動→検証) | ユーザー実行・司が手順提示 | 4 |

モックを先に完成させてから API を実装する(既存の進め方と同じ。ローカルで挙動を固めてから本番へ)。

## 8. この設計で解決すること / しないこと

**解決する**: #28(開始時ロックの保証・状態の明確化)、#24 の大会名、#25 の順位・参加人数、
「提出後に元デッキを編集すると提出内容が変わるのか」という曖昧さの明文化。

**解決しない(別項目)**: #31(公開時のフォーマット必須+適合チェック。既に一部実装あり)、
#18(禁止/制限の構造化入力)、#39(共同運営に伴う認可拡張。§5.1 のロック操作も対象になる)。
