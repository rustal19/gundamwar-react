# デザイン・表示内容調整の引き継ぎ

フロント実装(T1〜T10)は完了済み・テスト49件全パス。ここからは**見た目と表示内容の
調整フェーズ**。この文書は、そのために必要な地図とルールをまとめたもの。

> **要件は確定済み**: トーン・パレット・トークン定義・コンポーネント規約・実装フェーズは
> [DESIGN_SPEC.md](DESIGN_SPEC.md)(v1)を参照。実装はそちらの D1 → D2 の順で進める。

## 1. スタイルの地図

### グローバル(ここが土台)
| ファイル | 役割 |
|---|---|
| `src/App.css`(261行) | デスクトップの共通スタイル。ヘッダー以外の全体レイアウト、`search-results-*` / `results-link-button` / `deck-*` 等の共通クラス |
| `src/mobile.css`(983行) | compact(モバイル)時の上書き。`.app-shell-mobile` などのシェルクラス配下にスコープ |
| `src/index.css` | ほぼ空(bodyフォント等) |

### 機能別CSS(ページ/コンポーネントと1対1)
| ルート | ページJS | CSS |
|---|---|---|
| `/` | pages/PortalHome.js | pages/PortalHome.css |
| `/search` | pages/SearchResults.js(+App.jsが `/search` でのみ SearchForm を表示) | pages/SearchResults.css |
| `/deck` | pages/DeckBuilder.js | pages/DeckBuilder.css(772行)+ components/DeckLoadDialog.css / DeckSaveDialog.css / DeckExportDialog.css / BasicGAddDialog.css / CompactDeckSearchForm.css |
| `/decks`, `/decks/:id` | pages/PublicDecks.js / PublicDeckDetail.js | pages/PublicDecks.css(両ページ共用) |
| `/tournaments`, `/tournaments/:id`, `/tournaments/new`, `/tournaments/:id/manage` | pages/TournamentList.js / TournamentDetail.js / TournamentManage.js | pages/Tournaments.css(3ページ共用) |
| `/profile` | pages/Profile.js | pages/Profile.css |
| `/admin/users` | pages/AdminUsers.js | (専用CSSなし。App.css の共通クラス使用) |
| `/terms`, `/privacy` | pages/Terms.js / Privacy.js | (専用CSSなし。`.legal-page` クラスは未定義=素のHTML表示。**要スタイル**) |
| ヘッダー | components/AppHeader.js(PC)/ MobileAppHeader.js(モバイル、別実装) | components/AppHeader.css + mobile.css |
| フッター | components/AppFooter.js | components/AppFooter.css |
| ニックネーム登録モーダル | components/NicknameGate.js | components/NicknameGate.css |

## 2. レイアウト切替の仕組み(必読)

- `useLayoutTier`(utils/deviceLayout.js): 幅 **≤1100px で compact**。
  URL に `?mobileLayout=ios|android|1` を付けると強制モバイルOS表示。
- 各ページは `compact` prop(boolean)で分岐。モバイル専用ファイルは無い
  (AppHeader / MobileAppHeader のみ別ファイル)。
- ページ内リンクは `buildPathWithForcedMobileLayout(path, location.search)` で
  mobileLayout クエリを引き継ぐ決まり。新しいリンクを足すとき忘れない。
- シェルの状態クラス: `.app-shell-mobile` `.app-shell-compact-desktop` `.app-shell-ios`
  `.app-shell-android`(App.js 参照)。モバイル向け上書きはこれらにぶら下げる。

## 3. 作業の進め方

- **軽微な調整(CSS・文言・表示順・余白)は本体で直接編集してよい**
  (orchestrator を通さない)。1テーマ=1コミットで小さく刻む。
- **ページ構成の変更を伴う大きめの作り直し**は従来どおり task.mjs でタスク化
  (レビュー時のチェックリストは ROADMAP.md)。
- 変更のたびに: `CI=true npx react-scripts test --watchAll=false`(49件)が
  通ること+プレビューで実画面確認。

### 変えてよいもの / いけないもの
- ✅ 自由: CSS全般、表示文言、並び順、セクション構成、クラス名の追加
- ⚠️ 変える場合は要注意: 既存クラス名のリネーム(App.css の共通クラスは複数ページが
  参照)、App.test.js / PortalHome.test.js が参照するテキスト(「Gundam War Database」
  「カード名」「利用規約」等 → テストも一緒に直す)
- ❌ 変えない: localStorage キー、services/ の関数シグネチャ、API 形状
  (docs/PORTAL_SPEC.md の契約。バックエンド実装がこれを前提に進む)

## 4. プレビューでの確認方法(この環境の癖)

- 起動: launch.json の `gundamwar-react`(port 3000)。
- **preview_screenshot はタイムアウトする** → 見た目の数値確認は preview_inspect
  (computed style)、構造・文言は preview_eval / preview_snapshot。
- レスポンシブ確認は preview_resize(mobile=375 / tablet=768 / desktop=1280)+
  `?mobileLayout=ios` での強制表示。
- クリックは preview_eval 内で `.click()`、入力は native setter+input イベント
  (詳細は ROADMAP.md「検証のノウハウ」)。

### モックデータ投入レシピ(localStorage)
```js
// ログイン(role: user / organizer / admin、nickname 必須※無いとゲートが出る)
localStorage.setItem("gundamwar.auth.mockUser.v1",
  JSON.stringify({ id: "u1", name: "本名太郎", email: "t@example.com",
                   role: "organizer", nickname: "テスト主催者" }));

// 大会: キーを消してリロードすると日本語シード(ローカルスイス杯=進行中3人、
// 週末エントリー受付大会=受付中)が自動生成される
localStorage.removeItem("gundamwar.tournaments.v1");

// 公開デッキ(1件投入する例)。カードは card_type_name(UNIT/CHARACTER/...)と
// sets(収録弾の配列)が実データの形
localStorage.setItem("gundamwar.publicDecks.v1", JSON.stringify([{
  id: "9001", title: "テスト青単", isPublic: true, description: "説明文",
  publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  owner: { id: "u1", name: "テスト太郎" },
  items: [{ cardId: "U-1", count: 3, zone: "main",
            card: { cardId: "U-1", name: "ガンダム", card_type_name: "UNIT", sets: ["第1弾"] } }]
}]));
```
確認が終わったら投入したキーは削除して片付けること。

## 5. 既知の見た目・表示の課題(調整候補)

1. **/terms /privacy が未スタイル** — `.legal-page` クラスにCSSが無く素のHTML。
2. **SearchForm が `<th>/<td>` をテーブル外で使用** — React が console 警告を出す
   (前回リファクタからの持ち越し)。`.form-label` 等の div 化+CSS修正で解消できるが、
   検索フォームのレイアウトに直結するので慎重に。
3. **古い「Loading...」表記** — pages/SearchResults.js と components/DeckSearchResults.js
   に英語のまま残存(新規ページは「読み込み中...」で統一済み)。
4. ポータルトップ(PortalHome)は機能優先の簡素なカード並び。ポータルの顔として
   要ブラッシュアップ。
5. TournamentManage(677行)は機能満載だが視覚的整理は最小限。運営動線
   (ステータス→参加者→ラウンド→順位表)が縦に長い。
6. モバイル(compact)は各新ページとも「崩れない」レベルの対応。実機幅(375px)での
   微調整は未実施。
7. デッキ公開トグル(DeckLoadDialog 内)は保存デッキ選択後にしか見えず、導線が分かりにくい。

## 6. 表示内容(文言・データ)の所在

- 検索フォームの選択肢: `src/data/searchOptions.js`
- デッキ種別の並び・ラベル: `src/utils/deckExport.js`(DECK_TYPE_ORDER 等)
- 大会ステータスのラベル: 各ページ内の `TOURNAMENT_STATUS_LABELS` 定数(3箇所に重複あり。
  まとめるなら `src/data/` に抽出)
- 規約・プライバシー文面: pages/Terms.js / Privacy.js(公開前にユーザー承認が必要な
  ドラフト。削除依頼窓口が「準備中」)
- モックのシードデータ: services/tournaments.js の `createInitialStore()`
