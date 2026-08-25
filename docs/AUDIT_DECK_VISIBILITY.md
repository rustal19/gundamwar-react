# デッキ可視性の監査(#29 非公開/大会中デッキの厳格な非参照)

実施: 2026-08-26 / 対象: `gundamwar-api`(本番API)と `gundamwar-react` のモックサービス。
目的は「デッキを返す全経路が、非公開デッキと大会進行中の提出デッキを第三者に渡さないこと」の確認。

## 監査対象と結果(API)

| 経路 | 返すもの | ガード | 判定 |
|---|---|---|---|
| `GET /api/public-decks` | 公開デッキ一覧 | SQL の `WHERE d.is_public = 1` | OK |
| `GET /api/public-decks/:id` | 公開デッキ詳細 | SQL の `WHERE d.id = ? AND d.is_public = 1`(非公開は404) | OK |
| `GET /api/decks` (auth-routes.js) | 自分の保存デッキ一覧 | `WHERE user_id = ?` | OK |
| `POST/PUT/DELETE /api/decks[/:id]` | 自分の保存デッキ | 全クエリが `user_id = ?` スコープ | OK |
| `PATCH /api/decks/:id` (routes/decks.js) | 公開設定の更新 | 所有者以外は403。admin は「公開中デッキの強制非公開」のみ許可し、**デッキ本体を返さない**(id/isPublic/publishedAt のみ) | OK |
| `GET /api/tournaments/:id` | 大会詳細+エントリー | `deckItems` は `主催者 or 本人 or (status==='completed' && decklistsPublic)` のときだけ。それ以外は `null` | OK |
| `GET /api/tournaments/:id/entries` | エントリー全件(デッキ込み) | `requireAuthenticatedUser` + `loadAuthorizedTournament`(作成者 or admin のみ、他は403) | OK |
| `GET /api/users/me/tournaments` | 自分の参加大会+自分のエントリー | `WHERE e.user_id = ?` | OK |
| `GET /api/users/:id/profile` | 公開プロフィール | デッキを一切返さない | OK |
| `GET /api/tournaments/:id/rounds`, `/standings` | ラウンド・順位 | デッキを一切返さない | OK |

**結論: API 側は #29 の要件を満たしている。** 大会進行中は主催者と本人以外に `deckItems` が出ず、
`decklistsPublic` が真でも `status === 'completed'` になるまで公開されない。

## 見つかったギャップ(モック側)

`gundamwar-react/src/services/tournaments.js` の `fetchEntries()` は、モックモードで
**認可チェックなしにエントリーを生のまま返す**(`sanitizeEntryForViewer` を通していない)。
API の対応エンドポイントは作成者/admin 限定なので、モックだけ規則が緩い。

- 呼び出し元は現状 `src/pages/TournamentManage.js`(主催者コンソール)のみ
- モックストアは localStorage なので実害としてのデータ漏洩ではないが、
  画面側が「ガードされていないデータ」に依存して実装される危険があるため揃えるべき

→ **T51 で対応済み**(コミット 0e6d0af)。mock の fetchEntries は viewer(user 引数 or モックユーザー)を取り、
admin または「organizer かつ作成者」以外は 403 相当のエラーを投げる。TournamentManage は 403 を
受けて「この大会を管理する権限がありません。」を表示する。

あわせてワーカーの点検で **fetchStandings が順位表の entry に deckItems を載せて返していた**ことが
判明し、こちらも `deckItems: null` に修正済み(順位表は第三者も閲覧できるため、より広い露出だった)。

## 今後この規則を壊さないための注意点

- エントリーを返す新規経路を足すときは、必ず `sanitizeEntryForViewer`(モック)/
  `mapEntryRow(row, { revealDeckItems })`(API)を通す。生の行をそのまま返さない。
- #39(大会の共同運営)で認可を広げるときは、`loadAuthorizedTournament` と
  モックの主催者判定の**両方**を同時に更新する(片方だけ広げると齟齬が出る)。
- #28(大会デッキリストの特殊ステート+開始時ロック)を実装するときは、
  ここで確認した「completed かつ decklistsPublic でのみ公開」という条件を土台にする。
