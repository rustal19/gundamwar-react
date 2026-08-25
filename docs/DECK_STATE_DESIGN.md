# 大会デッキリストの状態設計(#28)+ 大会デッキの公開(#24/#25 の土台)

起案: 2026-08-26(司令塔) / ユーザー回答を反映: 2026-08-26。
関連: [FEEDBACK_BACKLOG.md](FEEDBACK_BACKLOG.md) #28 / #24 / #25 / #31 / #16、
[AUDIT_DECK_VISIBILITY.md](AUDIT_DECK_VISIBILITY.md)、[PORTAL_SPEC.md](PORTAL_SPEC.md) §エントリー。

## 0. 決定事項(ユーザー回答済み)

| 論点 | 決定 |
|---|---|
| ロックのタイミング | **チェックイン時**(エントリー単位)。主催者チェックイン・セルフチェックインのどちらでも同じ |
| ロック後の修正 | **主催者のみ可**。誰がいつ上書きしたかを記録する。加えて**主催者はロックを解除して「再提出可能」に戻せる**(本人に出し直させる経路) |
| 途中参加のロック | **参加(追加)時点で即ロック** |
| 終了後の公開 | 大会の「終了後にデッキリストを公開」チェックボックスに従う(参加者ごとの追加の同意は取らない) |
| 大会が複数ある場合の並び | 新しい順 |
| **保存デッキと大会提出デッキの関係** | **別の実体**。保存デッキは後から編集できるため、提出デッキと同一視・逆引きしない |

最後の1点が本設計の背骨。**「保存デッキ(saved_decks)」と「大会提出デッキ(提出時スナップショット)」は
別物**として扱い、保存デッキの詳細ページに大会名や順位を出すことはしない。
大会名・順位・参加人数が付くのは、**大会提出デッキそのものを表示するとき**だけ。

## 1. 現状(調査結果)

### 1.1 データモデル

- 保存デッキ: `saved_decks(id, user_id, title, items_json, is_public, description, format, published_at)`
- 大会エントリー: `tournament_entries(id, tournament_id, user_id, guest_name, deck_items JSON,
  decklist_submitted_at, status, joined_at_round, ...)`
- 提出デッキは `deck_items` に JSON スナップショットとして入る。**この形自体は正しい**
  (§0 の決定どおり、保存デッキとは独立した実体になっている)。
  足りないのは「いつロックされたか」「どのフォーマットで出したか」「最終順位」の3つ。

### 1.2 提出可否の判定(`routes/entries.js` の `can_submit_decklist`)

```
status が registration / in_progress 以外        → 提出不可
registration_closes_at が NULL かつ registration → 提出可
registration_closes_at があり かつ 現在 < 締切    → 提出可
それ以外                                          → 提出不可
```

**ここに #28 が指す穴がある**: `registration_closes_at` を設定した大会では、
**status が `in_progress`(=初戦生成後)でも締切前ならデッキを差し替えられる**。
チェックインとも無関係に判定しているため、「チェックインしたらロック」は現状まったく効いていない。

### 1.3 参照制御(#29 で監査済み・維持する前提)

提出デッキが第三者に見えるのは「`status === 'completed'` かつ `decklistsPublic`」のときだけ。
本設計はこの条件を土台にする(緩めない)。

## 2. 提案する状態機械

エントリー1件につき、デッキリストの状態は次の4つ。**状態列は持たず、既存列+新列から導出する**
(状態列を持つと更新漏れで実態とズレるため)。

| 状態 | 導出条件 | 本人 | 主催者 |
|---|---|---|---|
| `none`(未提出) | `decklist_submitted_at IS NULL` かつ `deck_locked_at IS NULL` | 提出できる | 代理提出できる |
| `submitted`(提出済み・差し替え可) | `decklist_submitted_at` あり かつ `deck_locked_at IS NULL` | 差し替えできる | 差し替えできる |
| `locked`(ロック済み) | `deck_locked_at` あり かつ `revealed` でない | **不可** | 可(記録が残る。ただし completed 後は不可) |
| `revealed`(公開中) | 大会が `completed` かつ `decklists_public` | 不可 | 不可 |

- **ロックの契機はチェックイン**。`status` が `checked_in` になった瞬間に `deck_locked_at` を打つ。
- **完了したが `decklists_public` が false の大会は `locked` のまま**(`revealed` にはならない)。
  ここを `submitted` に落とすと画面が「差し替え可」と誤表示するため、`locked` は completed かどうかで
  切らず「公開されていないロック済み」を指す状態とする。
- 未提出のままチェックインした場合も `deck_locked_at` を打ち、`none` のまま扱う
  (= 主催者が代理提出しない限り提出不能)。デッキ必須の大会でこれを許すかは運用判断に委ねる。
- **チェックインの取り消しではロックを解除しない**。解除は主催者の明示操作(§4.3)だけで起きる。
- ロック後に直す手段は2つ。主催者が状況で選ぶ:
  1. **代理で上書き**(その場で主催者が直す。会場で口頭確認しながら直すケース)
  2. **ロックを解除して再提出可能に戻す**(本人に出し直させるケース)。解除すると状態は
     `submitted`(提出済みなら)または `none` に戻り、本人が差し替えられる。
     **本人が出し直した時点で自動的に再ロック**する(解除は一度きりの許可として扱う)。
     主催者は手動での再ロックもできる。

## 3. スキーマ変更(加算のみ・既存列は変更しない)

```sql
ALTER TABLE tournament_entries
  ADD COLUMN deck_format VARCHAR(50) NULL,         -- 提出時のフォーマット名(検証の記録)
  ADD COLUMN deck_locked_at DATETIME NULL,         -- チェックイン時に打つ(§2)
  ADD COLUMN deck_updated_by BIGINT UNSIGNED NULL, -- ロック後に上書きした主催者
  ADD COLUMN deck_updated_at DATETIME NULL,        -- その上書き時刻
  ADD COLUMN deck_unlocked_by BIGINT UNSIGNED NULL,-- ロックを解除した主催者
  ADD COLUMN deck_unlocked_at DATETIME NULL,       -- その解除時刻
  ADD COLUMN final_rank INT NULL;                  -- 確定順位(大会完了時に書き込む。#25用)
```

- **`deck_id`(保存デッキへの参照)は持たない**。§0 の決定どおり両者は別実体であり、
  参照を持つと「編集済みの保存デッキ」と「提出時の中身」が混同される。
- `deck_items` スナップショットが唯一の正。提出後に保存デッキを編集しても提出内容は変わらない。
- `final_rank` は大会を `completed` にする処理で順位表から書き込む(SE 導入後の再計算・定義揺れを避ける)。
- 参加人数(#25)は列を足さず `COUNT(tournament_entries)` で出す(途中参加・ドロップで変動するため)。

## 4. API の変更

### 4.1 ロックの実行
- `POST /api/tournaments/:id/entries/me/checkin`(セルフ)と主催者側のチェックイン操作の**両方**で、
  `status` を `checked_in` にする UPDATE と同じトランザクションで
  `deck_locked_at = COALESCE(deck_locked_at, CURRENT_TIMESTAMP)` をセットする。
- 途中参加の手動追加(`POST /api/tournaments/:id/entries/manual`)では、大会が `in_progress` なら
  作成時に `deck_locked_at` をセットする。

### 4.1.1 チェックイン前の確認ダイアログ(ユーザー要望 2026-08-26)

チェックインするとデッキリストがロックされて本人では直せなくなるため、**セルフチェックインの前に
確認ダイアログを出す**。文言はロックされる事実と、後から直すには主催者に頼む必要があることを含める。

- 例: 「チェックインするとデッキリストがロックされ、以降は自分で変更できなくなります。
  修正が必要になった場合は主催者に連絡してください。チェックインしますか?」
- 未提出のままチェックインしようとした場合は、その旨も併せて警告する
  (例: 「デッキリストが未提出です。このままチェックインすると自分では提出できなくなります。」)
- **主催者側のチェックイン操作にはダイアログを出さない**。当日は多人数を連続で処理するため
  毎回の確認は運用の妨げになる。主催者はロック仕様を理解している前提。

### 4.2 提出ゲートの修正
`can_submit_decklist` に `AND e.deck_locked_at IS NULL` を加える。
これで「締切未到来でもチェックイン後は提出不可」になり、#28 の穴が閉じる。

### 4.3 主催者による上書き / ロック解除

**上書き**: `PUT /api/tournaments/:id/entries/:entryId` の `deckItems` 更新時、`deck_locked_at` が
入っていれば `deck_updated_by = 操作者` / `deck_updated_at = 現在` を記録する。
記録は主催者コンソールのエントリー一覧に「主催者が修正(日時)」として出す。

**ロック解除**: 同エンドポイントに `decklistLocked: false` を受け付ける(専用EPは作らない)。

- `deck_locked_at = NULL` にし、`deck_unlocked_by` / `deck_unlocked_at` を記録する
  (解除も監査対象。誰が再提出を許可したかを残す)
- 解除中は本人の提出ゲート(§4.2)が通るため、本人が差し替えられる
- **本人が提出した時点で `deck_locked_at` を再度打つ**(解除は一度きりの許可)
- `decklistLocked: true` で主催者が手動再ロックもできる
- 解除できるのは大会が `completed` になる前まで

### 4.4 レスポンス契約(PORTAL_SPEC §エントリーに追記)
```
entry: {
  ...既存,
  deckFormat: string|null,
  decklistState: 'none'|'submitted'|'locked'|'revealed',   // §2 の導出結果
  deckLockedAt: string|null,
  deckUpdatedBy: { id, name }|null,
  deckUpdatedAt: string|null,
  finalRank: number|null,
}
```
`decklistState` はサーバーで導出して返す(フロントに条件を再実装させない)。

### 4.5 大会デッキの公開(#24 / #25)

大会デッキは**保存デッキとは別系統の公開デッキ**として扱う。
公開条件は §1.3 のまま「`status = 'completed'` かつ `decklists_public`」。

- 新規: `GET /api/tournament-decks/:entryId` — 大会提出デッキ1件。
  返す情報は デッキ中身 + 大会名 + 開催日 + **順位(final_rank)** + **参加人数** + 提出者名 + フォーマット。
- 公開デッキ一覧 `GET /api/public-decks` は、保存デッキ由来と大会デッキ由来の**2系統を混ぜて返す**。
  ID が衝突するので、一覧・詳細URLでは接頭辞付き ID(`saved:123` / `entry:456`)を使う。
  ※ 既存 URL `/decks/:id` の互換のため、数値のみの ID は従来どおり保存デッキとして解決する。
- **一覧に混ぜる方針で確定**(2026-08-26 ユーザー決定)。#16(公開デッキ検索を晴れる屋手本に)へ
  素直に繋がるため。フォーマットタブ(#14)はそのまま効かせ、大会デッキか保存デッキかは
  カード上のバッジで区別する。

## 5. モック側(gundamwar-react/src/services)

モックは API と同じ状態機械・同じ可視条件を実装する(#29 の教訓)。

- `tournaments.js`: エントリーに `deckFormat` / `deckLockedAt` / `deckUpdatedBy` / `finalRank` を持たせ、
  `decklistState` を導出して返す。チェックイン処理でロックを打つ。提出ゲートにロック判定を足す。
- `publicDecks.js`: 大会デッキ系統を追加(完了 かつ decklistsPublic の大会のエントリーから生成)。
- #24 で入れた `normalizeTournamentReference`(保存デッキに大会を紐付ける前提の実装)は
  **§0 の決定に反するので削除**し、大会デッキ側のメタとして作り直す。

## 6. 実装タスク分割(案)

| 順 | 内容 | 担当 | 依存 |
|---|---|---|---|
| 1 | モックに状態機械+チェックイン時ロック+提出ゲート修正 | W | — |
| 2 | 参加者側・主催者側の表示(提出済み/ロック済み/主催者修正の表示) | W | 1 |
| 3 | モックに大会デッキ系統(#24 の大会名・#25 の順位/参加人数)と保存デッキ側の紐付け撤去 | W | 1 |
| 4 | マイグレーション 002 と API 実装(§3/§4) | 司 | 1〜3 |
| 5 | 本番適用(バックアップ→適用→再起動→検証) | ユーザー実行・司が手順提示 | 4 |

モックを先に完成させてから API を実装する(ローカルで挙動を固めてから本番へ、という既存方針どおり)。

## 7. 未決(実装前に決める)

- デッキ必須の大会で、未提出のままチェックインを許すか(現状は許す前提で設計)。
- #39(共同運営)が入ったら、§4.3 の「主催者による上書き」の認可も共同運営者に広げる必要がある。

## 8. この設計で解決すること / しないこと

**解決する**: #28(チェックイン時ロックの保証・状態の明確化・主催者上書きの記録)、
#24 の大会名、#25 の順位・参加人数、「提出後に保存デッキを編集したら提出内容はどうなるか」の明文化。

**解決しない(別項目)**: #31(公開時のフォーマット必須+適合チェック)、#18(禁止/制限の構造化入力)、
#16(公開デッキ検索の拡張)、#39(共同運営に伴う認可拡張)。
