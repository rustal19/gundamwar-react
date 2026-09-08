import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import TournamentDetail, { formatCardCountRange } from "./TournamentDetail";
import {
  checkInMyEntry,
  createEntry,
  fetchRounds,
  fetchStandings,
  fetchTournament,
  getTournamentPermissions,
  updateMyEntry,
} from "../services/tournaments";
import { fetchSavedDecks } from "../services/savedDecks";

let mockAuthState = {
  authMode: "mock",
  isAuthenticated: false,
  user: null,
};
let mockDeckItems = [];
let mockTournament;

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({ items: mockDeckItems }),
}));

jest.mock("../services/tournaments", () => ({
  checkInMyEntry: jest.fn(),
  createEntry: jest.fn(),
  deleteMyEntry: jest.fn(),
  updateMyEntry: jest.fn(),
  fetchTournament: jest.fn(),
  fetchRounds: jest.fn(),
  fetchStandings: jest.fn(),
  getTournamentPermissions: jest.fn(),
}));

jest.mock("../services/savedDecks", () => ({
  fetchSavedDecks: jest.fn(),
}));

function renderDetail(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t-detail"]}>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetail {...props} />} />
      </Routes>
    </MemoryRouter>
  );
}

async function selectNoDeck() {
  fireEvent.click(await screen.findByRole("button", { name: "デッキを選ぶ" }));
  fireEvent.click(screen.getByRole("button", { name: "デッキを添付せずに参加する" }));
}

function SwitchableDetailRoute() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/tournaments/t-next")}>大会を切り替える</button>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
      </Routes>
    </>
  );
}

function renderSwitchableDetail() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t-detail"]}>
      <SwitchableDetailRoute />
    </MemoryRouter>
  );
}

function registrationTournament(overrides = {}) {
  return {
    id: "t-detail",
    title: "提出テスト大会",
    description: "",
    format: "swiss",
    status: "registration",
    startsAt: "2099-07-20T10:00:00.000Z",
    registrationClosesAt: "2099-07-19T10:00:00.000Z",
    checkinOpensAt: null,
    capacity: 16,
    venue: "テスト会場",
    isOnline: false,
    decklistsPublic: false,
    decklistRequired: false,
    regulation: {},
    entries: [],
    ...overrides,
  };
}

function validDeck() {
  return Array.from({ length: 50 }, (_, index) => ({
    cardId: `card-${index}`,
    count: 1,
    zone: "main",
    card: { id: `card-${index}`, name: `カード${index}` },
  }));
}

function setMyDecklistState(decklistState, overrides = {}) {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  const submitted = decklistState !== "none";
  const entry = {
    id: "entry-mine",
    user: { id: "player-1", name: "テストユーザー" },
    status: "registered",
    decklistState,
    deckItems: submitted ? validDeck() : null,
    decklistSubmittedAt: submitted ? "2026-08-25T10:00:00.000Z" : null,
    deckLockedAt: ["locked", "revealed"].includes(decklistState)
      ? "2026-08-26T10:00:00.000Z"
      : null,
    ...overrides.entry,
  };
  mockTournament = registrationTournament({
    entries: [entry],
    myEntry: entry,
    ...(overrides.tournament || {}),
  });
}

function setSelfCheckInState(decklistState) {
  setMyDecklistState(decklistState, {
    tournament: {
      selfCheckin: true,
      startsAt: new Date().toISOString(),
      registrationClosesAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
}

beforeEach(() => {
  mockAuthState = { authMode: "mock", isAuthenticated: false, user: null };
  mockDeckItems = [];
  mockTournament = null;
  fetchTournament.mockImplementation(() =>
    Promise.resolve(
      mockTournament ||
        registrationTournament({
          title: "参加者表示テスト大会",
          entries: [
            {
              id: "entry-1",
              user: { id: "player-1", name: "公開ニックネーム" },
              status: "checked_in",
              deckItems: null,
              decklistSubmittedAt: null,
            },
            {
              id: "entry-2",
              user: { id: "player-2", name: "申請者ニックネーム" },
              status: "pending",
              deckItems: null,
              decklistSubmittedAt: null,
            },
          ],
        })
    )
  );
  createEntry.mockReset().mockResolvedValue({});
  checkInMyEntry.mockReset().mockResolvedValue({});
  updateMyEntry.mockReset().mockResolvedValue({});
  fetchRounds.mockReset().mockResolvedValue({ rounds: [] });
  fetchStandings.mockReset().mockResolvedValue({ items: [] });
  fetchSavedDecks.mockReset().mockResolvedValue([]);
  getTournamentPermissions.mockReset().mockImplementation((tournament, viewer) => {
    const viewerId = viewer?.id == null ? "" : String(viewer.id);
    const canManage = Boolean(
      viewerId &&
        (viewer?.role === "admin" ||
          String(tournament?.createdBy?.id) === viewerId ||
          (tournament?.coOrganizers || []).some(
            (operator) => String(operator.id) === viewerId
          ))
    );
    return { canManage };
  });
});

test("レギュレーション枚数は同値を単一表記、異なる値を範囲表記にする", () => {
  expect(formatCardCountRange(50, 50)).toBe("50枚");
  expect(formatCardCountRange(50, 60)).toBe("50 - 60枚");
});

test("モバイルでは案内と参加操作を縮約し、タブと内容を隣接させる", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-mobile", name: "モバイル利用者" },
  };
  mockTournament = registrationTournament({
    announcement: "受付で参加賞を受け取ってください。",
  });

  renderDetail({ compact: true });
  await screen.findByRole("heading", { name: "提出テスト大会" });

  const priorityStack = screen.getByRole("region", {
    name: "大会のお知らせとマイステータス",
  });
  const announcementDisclosure = screen.getByLabelText("大会アナウンス");
  const myStatusDisclosure = screen.getByLabelText("マイステータス操作");
  const tabs = screen.getByLabelText("大会詳細");
  const tabPanel = screen.getByRole("region", { name: "大会詳細内容" });
  const myStatusSummary = within(myStatusDisclosure).getByText(/エントリー・デッキ提出/);

  // アナウンスは主催者が見せるために出すもの(会場変更など)なので既定で開く。
  // マイステータスは縦に長いので畳んでおく。
  expect(announcementDisclosure).toHaveAttribute("open");
  expect(
    within(announcementDisclosure).getByText("受付で参加賞を受け取ってください。")
  ).toBeVisible();
  expect(myStatusDisclosure).not.toHaveAttribute("open");
  expect(myStatusSummary).toBeVisible();
  /* DOMの縦順と隣接関係そのものが、このレイアウト回帰テストの対象。 */
  /* eslint-disable testing-library/no-node-access */
  expect(
    priorityStack.compareDocumentPosition(tabs) & window.Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(tabs.nextElementSibling).toBe(tabPanel);
  /* eslint-enable testing-library/no-node-access */

  fireEvent.click(myStatusSummary);
  expect(myStatusDisclosure).toHaveAttribute("open");
  expect(screen.getByRole("button", { name: "エントリー" })).toBeInTheDocument();

  const scrollIntoView = jest.fn();
  tabPanel.scrollIntoView = scrollIntoView;
  fireEvent.click(screen.getByRole("button", { name: "参加者" }));

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  expect(within(tabPanel).getByText("参加者はまだ登録されていません。")).toBeInTheDocument();
});

test("デスクトップでは案内とマイステータスの既存表示順を維持する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-desktop", name: "デスクトップ利用者" },
  };
  mockTournament = registrationTournament({ announcement: "大会からのお知らせです。" });

  renderDetail();
  await screen.findByRole("heading", { name: "提出テスト大会" });

  expect(
    screen.queryByRole("region", { name: "大会のお知らせとマイステータス" })
  ).not.toBeInTheDocument();
  /* DOMの既存順を直接確認するため、対象sectionを可視文言から取得する。 */
  /* eslint-disable testing-library/no-node-access */
  const announcement = screen.getByText("大会からのお知らせです。").closest("section");
  const myStatus = screen.getByText("マイステータス").closest("section");
  const tabs = screen.getByLabelText("大会詳細");
  expect(
    announcement.compareDocumentPosition(myStatus) & window.Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    myStatus.compareDocumentPosition(tabs) & window.Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  /* eslint-enable testing-library/no-node-access */
  expect(screen.getByRole("button", { name: "エントリー" })).toBeInTheDocument();
});

test("ラウンド取得だけ失敗しても大会情報を表示し、空状態と区別して再試行できる", async () => {
  fetchRounds.mockRejectedValueOnce(new Error("Failed to fetch"));

  renderDetail();

  expect(await screen.findByRole("heading", { name: "参加者表示テスト大会" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ペアリング" }));

  expect(await screen.findByText("ペアリングを読み込めませんでした。")).toBeInTheDocument();
  expect(screen.queryByText("ペアリングはまだ作成されていません。")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("ペアリングはまだ作成されていません。")).toBeInTheDocument();
  expect(screen.queryByText("ペアリングを読み込めませんでした。")).not.toBeInTheDocument();
  expect(fetchRounds).toHaveBeenCalledTimes(2);
});

test("順位取得だけ失敗しても大会情報を残し、順位0件を同時表示しない", async () => {
  fetchStandings.mockRejectedValueOnce(new Error("Failed to fetch"));

  renderDetail();

  expect(await screen.findByRole("heading", { name: "参加者表示テスト大会" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "順位表" }));

  expect(await screen.findByText("順位表を読み込めませんでした。")).toBeInTheDocument();
  expect(screen.queryByText("順位データはまだありません。")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "参加者表示テスト大会" })).toBeInTheDocument();
});

test("大会URL切替前の遅い応答で切替後の大会を上書きしない", async () => {
  let resolveOldTournament;
  fetchTournament.mockImplementation((tournamentId) => {
    if (tournamentId === "t-detail") {
      return new Promise((resolve) => {
        resolveOldTournament = resolve;
      });
    }
    return Promise.resolve(
      registrationTournament({ id: "t-next", title: "切替後の大会" })
    );
  });

  renderSwitchableDetail();
  fireEvent.click(screen.getByRole("button", { name: "大会を切り替える" }));

  expect(await screen.findByRole("heading", { name: "切替後の大会" })).toBeInTheDocument();

  await act(async () => {
    resolveOldTournament(registrationTournament({ title: "切替前の大会" }));
  });

  expect(screen.getByRole("heading", { name: "切替後の大会" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "切替前の大会" })).not.toBeInTheDocument();
});

test("大会URL切替前の書込完了後に旧大会の再取得を開始しない", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  let resolveEntry;
  createEntry.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveEntry = resolve;
      })
  );
  fetchTournament.mockImplementation((tournamentId) =>
    Promise.resolve(
      registrationTournament({
        id: tournamentId,
        title: tournamentId === "t-detail" ? "切替前の大会" : "切替後の大会",
      })
    )
  );

  renderSwitchableDetail();
  await selectNoDeck();
  fireEvent.click(await screen.findByRole("button", { name: "エントリー" }));
  fireEvent.click(screen.getByRole("button", { name: "大会を切り替える" }));
  expect(await screen.findByRole("heading", { name: "切替後の大会" })).toBeInTheDocument();

  await act(async () => {
    resolveEntry({ id: "old-entry" });
  });

  expect(screen.getByRole("heading", { name: "切替後の大会" })).toBeInTheDocument();
  expect(screen.queryByText("エントリーしました。")).not.toBeInTheDocument();
  expect(fetchTournament.mock.calls.map(([tournamentId]) => tournamentId)).toEqual([
    "t-detail",
    "t-next",
  ]);
});

test("参加者0人では見出しだけの表を残さず理由を表示する", async () => {
  mockTournament = registrationTournament({ entries: [] });

  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  expect(screen.getByText("参加者はまだ登録されていません。")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "プレイヤー" })).not.toBeInTheDocument();
});

test("対戦0件のラウンドでは見出しだけの表を残さない", async () => {
  fetchRounds.mockResolvedValue({
    rounds: [{ id: "round-empty", number: 1, stage: "swiss", status: "in_progress", matches: [] }],
  });

  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "ペアリング" }));
  expect(await screen.findByText("このラウンドには対戦がありません。")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "卓" })).not.toBeInTheDocument();
});

test("保存済みデッキ取得失敗をデッキ0件と区別して再試行できる", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-saved-deck", name: "保存デッキ利用者" },
  };
  mockTournament = registrationTournament({ entries: [] });
  fetchSavedDecks.mockRejectedValueOnce(new Error("Failed to fetch"));

  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "デッキを選ぶ" }));
  expect(await screen.findByText("保存済みデッキを読み込めませんでした。")).toBeInTheDocument();
  expect(screen.queryByText("保存済みデッキはありません。")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));
  await waitFor(() => expect(fetchSavedDecks).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("保存済みデッキはありません。")).toBeInTheDocument();
});

test("大会情報のレギュレーションにデッキ枚数を表示し同名上限は表示しない", async () => {
  mockTournament = registrationTournament({
    regulation: { mainMin: 50, mainMax: 50, sideSize: 10, maxCopies: 3 },
  });

  renderDetail();

  expect(await screen.findByText("50枚")).toBeInTheDocument();
  expect(screen.getByText("10枚")).toBeInTheDocument();
  expect(screen.queryByText("同名上限")).not.toBeInTheDocument();
  expect(screen.queryByText("3枚")).not.toBeInTheDocument();
  expect(screen.queryByText("50 - 50")).not.toBeInTheDocument();
});

test("大会情報にチェックイン開始時刻を月日と時刻で表示する", async () => {
  mockTournament = registrationTournament({
    checkinOpensAt: new Date(2030, 0, 2, 9, 0).toISOString(),
  });

  renderDetail();

  expect(await screen.findByText("チェックイン開始")).toBeInTheDocument();
  expect(screen.getByText("1月2日 09:00")).toBeInTheDocument();
});

test("大会詳細に主催者と共同運営者をプロフィールリンク付きで表示する", async () => {
  mockTournament = registrationTournament({
    createdBy: { id: "creator-user", name: "大会主催者" },
    coOrganizers: [
      { id: "co-user-1", name: "共同運営者1" },
      { id: "co-user-2", name: "共同運営者2" },
    ],
  });

  renderDetail();

  expect(await screen.findByRole("link", { name: "大会主催者" })).toHaveAttribute(
    "href",
    "/users/creator-user"
  );
  expect(screen.getByRole("link", { name: "共同運営者1" })).toHaveAttribute(
    "href",
    "/users/co-user-1"
  );
  expect(screen.getByRole("link", { name: "共同運営者2" })).toHaveAttribute(
    "href",
    "/users/co-user-2"
  );
});

test("共同運営者には大会詳細から管理画面への導線を表示する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "co-user", name: "共同運営者", role: "user" },
  };
  mockTournament = registrationTournament({
    createdBy: { id: "creator-user", name: "大会主催者" },
    coOrganizers: [{ id: "co-user", name: "共同運営者" }],
  });

  renderDetail();

  expect(await screen.findByRole("link", { name: "大会管理" })).toHaveAttribute(
    "href",
    "/tournaments/t-detail/manage"
  );
});

test("参加者向け大会情報にスイス総回戦数と終了条件を表示する", async () => {
  mockTournament = registrationTournament({
    swissRounds: 4,
    swissEndCondition: "undefeated",
  });

  renderDetail();

  expect(await screen.findByText("スイス回戦数")).toBeInTheDocument();
  expect(screen.getByText("全4回戦")).toBeInTheDocument();
  expect(screen.getByText("終了条件")).toBeInTheDocument();
  expect(screen.getByText("全勝者が1人以下になったら終了")).toBeInTheDocument();
});

test("参加者ステータスを日本語ラベルで表示する", async () => {
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  expect(screen.getByText("公開ニックネーム")).toBeInTheDocument();
  expect(screen.getByText("チェックイン済み")).toBeInTheDocument();
  expect(screen.getByText("申請中")).toBeInTheDocument();
  expect(screen.queryByText("checked_in")).not.toBeInTheDocument();
  expect(screen.queryByText("pending")).not.toBeInTheDocument();
});

test("提出済み枚数を共通表記にし、公開デッキ表に列見出しとモバイルラベルを表示する", async () => {
  mockTournament = registrationTournament({
    status: "completed",
    decklistsPublic: true,
    entries: [
      {
        id: "entry-public",
        user: { id: "player-public", name: "公開選手" },
        status: "checked_in",
        deckItems: [
          {
            cardId: "unit-main",
            count: 3,
            zone: "main",
            card: {
              name: "メインカード",
              cardNumber1: "U",
              cardNumber2: "123",
            },
          },
          {
            cardId: "unit-side",
            count: 1,
            zone: "side",
            card: {
              name: "サイドカード",
              cardNumber1: "U",
              cardNumber2: "456",
            },
          },
        ],
        decklistSubmittedAt: "2026-08-25T10:00:00.000Z",
      },
    ],
  });

  const { container } = renderDetail({ compact: true });
  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  const participantRow = screen.getByRole("row", { name: /公開選手.*提出済み/ });
  const participantTable = screen.getAllByRole("table")[0];
  expect(participantTable).toHaveClass("tournament-card-table", "tournament-entries-table");
  expect(within(participantRow).getAllByRole("cell").map((cell) => cell.dataset.label)).toEqual([
    "番号",
    "プレイヤー",
    "ステータス",
    "デッキ",
  ]);
  expect(participantRow).toHaveTextContent("提出済み（メイン3枚 / サイド1枚）");
  const deckHeading = screen.getByRole("heading", { name: /公開選手.*のデッキリスト/ });
  const deckSection = deckHeading.closest("section");
  expect(within(deckSection).getByText("メイン3枚 / サイド1枚")).toBeInTheDocument();

  const deckTable = within(deckSection).getByRole("table");
  expect(deckTable).toHaveClass("tournament-card-table", "tournament-public-decklist-table");
  expect(
    within(deckTable).getAllByRole("columnheader").map((header) => header.textContent)
  ).toEqual(["区分", "カード番号", "カード名", "枚数"]);
  const mainRow = within(deckTable).getByRole("row", { name: /メイン.*U-123.*メインカード.*3枚/ });
  expect(within(mainRow).getByText("区分:")).toHaveClass("tournament-deck-cell-label");
  expect(within(mainRow).getByText("カード番号:")).toHaveClass("tournament-deck-cell-label");
  expect(within(mainRow).getByText("カード名:")).toHaveClass("tournament-deck-cell-label");
  expect(within(mainRow).getByText("枚数:")).toHaveClass("tournament-deck-cell-label");
  expect(within(mainRow).getAllByRole("cell").map((cell) => cell.dataset.label)).toEqual([
    "区分",
    "カード番号",
    "カード名",
    "枚数",
  ]);
  expect(container.querySelector(".tournament-page")).toHaveClass("compact");
});

test("ペアリング・リザルト・順位表は1件内にモバイル用ラベルと全情報を保持する", async () => {
  const entries = [
    { id: "entry-1", user: { id: "player-1", name: "カード選手1" }, status: "checked_in" },
    { id: "entry-2", user: { id: "player-2", name: "カード選手2" }, status: "checked_in" },
  ];
  mockTournament = registrationTournament({
    status: "completed",
    swissRounds: 1,
    entries,
  });
  fetchRounds.mockResolvedValue({
    rounds: [
      {
        id: "round-card-1",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          {
            id: "match-card-1",
            tableNo: 3,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 2,
            player2Games: 1,
            result: "p1_win",
          },
        ],
      },
    ],
  });

  renderDetail({ compact: true });
  await screen.findByRole("heading", { name: "提出テスト大会" });

  fireEvent.click(screen.getByRole("button", { name: "ペアリング" }));
  const pairingsTable = await screen.findByRole("table");
  expect(pairingsTable).toHaveClass("tournament-card-table", "tournament-pairings-table");
  const pairingCard = within(pairingsTable).getAllByRole("row")[1];
  expect(within(pairingCard).getAllByRole("cell").map((cell) => cell.dataset.label)).toEqual([
    "卓",
    "プレイヤー1",
    "プレイヤー2",
    "結果",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "リザルト" }));
  const resultsTable = await screen.findByRole("table");
  expect(resultsTable).toHaveClass("tournament-card-table", "tournament-results-table");
  const resultCard = within(resultsTable).getAllByRole("row")[1];
  expect(within(resultCard).getAllByRole("cell").map((cell) => cell.dataset.label)).toEqual([
    "卓",
    "プレイヤー1",
    "プレイヤー2",
    "結果",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "順位表" }));
  const standingsTable = await screen.findByRole("table");
  expect(standingsTable).toHaveClass("tournament-card-table", "tournament-standings-table");
  const standingCard = within(standingsTable).getAllByRole("row")[1];
  expect(within(standingCard).getAllByRole("cell").map((cell) => cell.dataset.label)).toEqual([
    "順位",
    "プレイヤー",
    "勝",
    "敗",
    "分",
    "勝点",
    "OMW%（対戦相手勝率）",
  ]);
});

test("同名参加者は識別表示し、登録ユーザーのプロフィールリンクとゲスト表示を維持する", async () => {
  mockTournament = registrationTournament({
    entries: [
      {
        id: "entry-user",
        user: { id: "player-1", name: "同名選手" },
        status: "checked_in",
      },
      {
        id: "entry-guest",
        user: { id: null, name: "同名選手" },
        status: "checked_in",
      },
    ],
  });

  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  const participantTable = screen.getByRole("table");
  const labels = within(participantTable).getAllByText(/^同名選手 #[0-9a-z]{4,}$/);
  expect(labels).toHaveLength(2);
  expect(labels[0].textContent).not.toBe(labels[1].textContent);
  expect(within(participantTable).getByRole("link", { name: /^同名選手 #/ })).toHaveAttribute(
    "href",
    "/users/player-1"
  );
  expect(within(participantTable).getAllByRole("link")).toHaveLength(1);
});

test("SEはブラケットとSE内連番で表示し、順位表はスイス結果だけを集計する", async () => {
  const entries = [
    { id: "entry-1", user: { id: "player-1", name: "選手1" }, status: "checked_in" },
    { id: "entry-2", user: { id: "player-2", name: "選手2" }, status: "checked_in" },
  ];
  mockTournament = registrationTournament({
    format: "swiss",
    status: "in_progress",
    swissRounds: 1,
    topCutSize: 2,
    entries,
  });
  fetchRounds.mockResolvedValue({
    rounds: [
      {
        id: "round-1",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          {
            id: "match-1",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
          },
        ],
      },
      {
        id: "round-2",
        number: 2,
        stage: "top_cut",
        status: "completed",
        matches: [
          {
            id: "match-2",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 0,
            player2Games: 2,
            result: "p2_win",
          },
        ],
      },
      {
        id: "round-3",
        number: 3,
        stage: "top_cut",
        status: "in_progress",
        matches: [
          {
            id: "match-3",
            tableNo: 1,
            player1EntryId: "entry-2",
            player2EntryId: null,
            player1Games: null,
            player2Games: null,
            result: null,
          },
        ],
      },
    ],
  });

  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "ペアリング" }));
  expect(await screen.findByRole("button", { name: new RegExp("^決勝トーナメント2回戦") })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "決勝トーナメント2回戦 / トップカット" })).toBeInTheDocument();
  expect(screen.getByText("0 - 2（P2勝利）")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "順位表" }));
  expect(await screen.findByRole("heading", { name: "スイス順位表" })).toBeInTheDocument();
  const roundTabs = screen.getByLabelText("ラウンド切替");
  expect(within(roundTabs).getByRole("button", { name: new RegExp("^第1回戦") })).toBeInTheDocument();
  expect(within(roundTabs).queryByRole("button", { name: /SE/ })).not.toBeInTheDocument();

  const player1Row = within(screen.getByRole("table")).getByRole("row", { name: /選手1/ });
  expect(within(player1Row).getAllByRole("cell").slice(0, 6).map((cell) => cell.textContent)).toEqual([
    "1",
    "選手1",
    "1",
    "0",
    "0",
    "3",
  ]);
});

test("非掲載大会はURLから詳細を開けることを示し、通常どおりエントリーできる", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament({
    title: "URL限定大会",
    isListed: false,
  });
  fetchTournament.mockClear();

  renderDetail();

  expect(await screen.findByRole("heading", { name: "URL限定大会" })).toBeInTheDocument();
  expect(screen.getByText("ローカル大会（非掲載）")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "この大会は一覧に表示されません。大会URLを共有された人が通常どおり参加できます。"
  );
  expect(fetchTournament).toHaveBeenCalledWith("t-detail", {
    authMode: "mock",
    user: mockAuthState.user,
  });

  await selectNoDeck();
  const entryButton = screen.getByRole("button", { name: "エントリー" });
  expect(entryButton).toBeEnabled();
  fireEvent.click(entryButton);

  expect(createEntry).toHaveBeenCalledWith({
    tournamentId: "t-detail",
    deckItems: null,
    authMode: "mock",
    user: mockAuthState.user,
  });
  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
});

test("任意大会ではデッキなしでエントリーし未提出として扱う", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament();

  renderDetail();
  await selectNoDeck();
  fireEvent.click(screen.getByRole("button", { name: "エントリー" }));

  expect(createEntry).toHaveBeenCalledWith(
    expect.objectContaining({ tournamentId: "t-detail", deckItems: null })
  );
  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
  expect(screen.queryByText("デッキリストを提出しました。")).not.toBeInTheDocument();
});

test.each([
  ["デスクトップ", false],
  ["モバイル", true],
])("%sで未完成の現在・保存デッキを残したままデッキなし参加できる", async (_label, compact) => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  const oneCardDeck = [{ cardId: "basic-g", count: 1, zone: "main", card: { id: "basic-g", name: "基本G" } }];
  const savedOneCardDeck = {
    id: "saved-one-card",
    title: "保存した基本Gデッキ",
    items: oneCardDeck.map((item) => ({ ...item })),
  };
  mockDeckItems = oneCardDeck;
  mockTournament = registrationTournament();
  fetchSavedDecks.mockResolvedValueOnce([savedOneCardDeck]);

  renderDetail({ compact });

  const entryButton = await screen.findByRole("button", { name: "エントリー" });
  expect(entryButton).toBeDisabled();
  expect(screen.getByText("デッキリストを提出できません。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "デッキを選ぶ" }));
  expect(await screen.findByText("保存した基本Gデッキ")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "デッキを添付せずに参加する" }));

  expect(screen.getByText("提出デッキ: 添付しない")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "エントリー" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "エントリー" }));

  expect(createEntry).toHaveBeenCalledWith(
    expect.objectContaining({ tournamentId: "t-detail", deckItems: null })
  );
  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
  expect(mockDeckItems).toEqual(oneCardDeck);
  expect(savedOneCardDeck.items).toHaveLength(1);
});

test("エントリー成功後の再取得失敗では成功表示と二重操作を止めて再試行できる", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament();
  const entry = {
    id: "entry-mine",
    user: mockAuthState.user,
    status: "registered",
    decklistState: "none",
    deckItems: null,
    decklistSubmittedAt: null,
    deckLockedAt: null,
  };
  fetchTournament
    .mockResolvedValueOnce(mockTournament)
    .mockRejectedValueOnce(new Error("Failed to fetch"))
    .mockResolvedValueOnce({ ...mockTournament, entries: [entry], myEntry: entry });

  renderDetail();
  await selectNoDeck();
  fireEvent.click(await screen.findByRole("button", { name: "エントリー" }));

  expect(
    await screen.findByText(
      "操作は完了しましたが、最新の参加状態を確認できませんでした。"
    )
  ).toBeInTheDocument();
  expect(screen.queryByText("エントリーしました。")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "エントリー" })).toBeDisabled();
  expect(createEntry).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
  expect(
    screen.queryByText(
      "操作は完了しましたが、最新の参加状態を確認できませんでした。"
    )
  ).not.toBeInTheDocument();
  expect(createEntry).toHaveBeenCalledTimes(1);
});

test("エントリー操作の英語通信エラーを日本語で表示する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament();
  createEntry.mockRejectedValueOnce(new Error("Failed to fetch"));

  renderDetail();
  await selectNoDeck();
  fireEvent.click(await screen.findByRole("button", { name: "エントリー" }));

  expect(
    await screen.findByText(
      "エントリー情報を更新できませんでした。もう一度お試しください。"
    )
  ).toBeInTheDocument();
  expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
});

test("定員到達後もキャンセル待ちとしてエントリーできる", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "waitlisted-player", name: "待機希望者" },
  };
  mockTournament = registrationTournament({
    capacity: 1,
    entries: [
      {
        id: "admitted-entry",
        user: { id: "admitted-player", name: "先着参加者" },
        status: "registered",
        isWaitlisted: false,
      },
    ],
  });
  createEntry.mockResolvedValueOnce({
    id: "waitlisted-entry",
    status: "registered",
    isWaitlisted: true,
  });

  renderDetail();

  expect(await screen.findByText("参加 1人 / 定員 1人")).toBeInTheDocument();
  await selectNoDeck();
  const entryButton = screen.getByRole("button", { name: "エントリー" });
  expect(entryButton).toBeEnabled();
  fireEvent.click(entryButton);

  expect(
    await screen.findByText(
      "キャンセル待ちとしてエントリーしました。繰り上げには当日のチェックインが必要です。"
    )
  ).toBeInTheDocument();
});

test("自分のキャンセル待ち状態と繰り上げ条件を表示する", async () => {
  setMyDecklistState("submitted", {
    entry: {
      isWaitlisted: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });

  renderDetail();

  expect(await screen.findByRole("heading", { name: "キャンセル待ち" })).toBeInTheDocument();
  expect(
    screen.getByText(/繰り上げ対象になるには当日のチェックインが必要です。/)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "参加者" }));
  expect(screen.getByText("キャンセル待ち（1番目） / 登録済み")).toBeInTheDocument();
});

test("ドロップ済みの本人は大会枠に数えず、キックのみ後の再エントリー導線を表示する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament({
    capacity: 1,
    myEntry: null,
    entries: [
      {
        id: "entry-dropped",
        user: { id: "player-1", name: "テストユーザー" },
        status: "dropped",
        decklistState: "none",
        deckItems: null,
        decklistSubmittedAt: null,
        deckLockedAt: null,
      },
    ],
  });
  renderDetail();

  expect(await screen.findByText("参加 0人 / 定員 1人")).toBeInTheDocument();
  await selectNoDeck();
  const entryButton = screen.getByRole("button", { name: "エントリー" });
  expect(entryButton).toBeEnabled();
  fireEvent.click(entryButton);

  expect(createEntry).toHaveBeenCalledWith({
    tournamentId: "t-detail",
    deckItems: null,
    authMode: "mock",
    user: mockAuthState.user,
  });
  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
});

test("必須大会では空デッキでエントリーできない", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament({ decklistRequired: true });

  renderDetail();

  expect(await screen.findByRole("button", { name: "エントリー" })).toBeDisabled();
  expect(screen.getByText("エントリーには完成したデッキが必要です。")).toBeInTheDocument();
  expect(createEntry).not.toHaveBeenCalled();
});

test("完成デッキを添えてエントリーすると提出成功を表示する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockDeckItems = validDeck();
  mockTournament = registrationTournament({ decklistRequired: true });

  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "エントリー" }));

  expect(createEntry).toHaveBeenCalledWith(
    expect.objectContaining({ tournamentId: "t-detail", deckItems: mockDeckItems })
  );
  expect(
    await screen.findByText("エントリーし、デッキリストを提出しました。")
  ).toBeInTheDocument();
});

test("未提出は提出を促し提出UIを表示する", async () => {
  mockDeckItems = validDeck();
  setMyDecklistState("none");

  renderDetail();

  expect(
    await screen.findByText("デッキリストが未提出です。デッキを選んで提出してください。")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "提出を更新" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "デッキを選ぶ" })).toBeInTheDocument();
});

test("提出済みは差し替え可能と案内し提出UIを表示する", async () => {
  mockDeckItems = validDeck();
  setMyDecklistState("submitted");

  renderDetail();

  expect(
    await screen.findByText("デッキリストは提出済みです。差し替えできます。")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "提出を更新" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "デッキを選ぶ" })).toBeInTheDocument();
});

test("ロック中は主催者への連絡を案内し提出UIを表示しない", async () => {
  setMyDecklistState("locked");

  renderDetail();

  expect(
    await screen.findByText(
      "チェックイン済みのためデッキリストは変更できません(修正が必要な場合は主催者へ)"
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出を更新" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("公開中は差し替え不可を案内し提出UIを表示しない", async () => {
  setMyDecklistState("revealed", {
    tournament: { status: "completed", decklistsPublic: true },
  });

  renderDetail();

  expect(
    await screen.findByText("デッキリストは公開中のため差し替えできません。")
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出を更新" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("未提出のままロックされた場合も提出UIを表示しない", async () => {
  setMyDecklistState("none", {
    entry: {
      status: "checked_in",
      deckLockedAt: "2026-08-26T10:00:00.000Z",
    },
  });

  renderDetail();

  expect(
    await screen.findByText(
      "チェックイン済みのためデッキリストは変更できません(修正が必要な場合は主催者へ)"
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "提出を更新" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "デッキを選ぶ" })).not.toBeInTheDocument();
});

test("セルフチェックイン前にロックの確認を表示しキャンセル時は実行しない", async () => {
  setSelfCheckInState("submitted");
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "チェックインする" }));

  const dialog = screen.getByRole("dialog", { name: "チェックインの確認" });
  expect(
    within(dialog).getByText(
      "チェックインするとデッキリストがロックされ、以降は自分で変更できなくなります。修正が必要になった場合は主催者に連絡してください。チェックインしますか?"
    )
  ).toBeInTheDocument();
  expect(checkInMyEntry).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));

  expect(screen.queryByRole("dialog", { name: "チェックインの確認" })).not.toBeInTheDocument();
  expect(checkInMyEntry).not.toHaveBeenCalled();
});

test("セルフチェックイン確認後にチェックインを実行する", async () => {
  setSelfCheckInState("submitted");
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "チェックインする" }));
  const dialog = screen.getByRole("dialog", { name: "チェックインの確認" });
  fireEvent.click(within(dialog).getByRole("button", { name: "チェックインする" }));

  expect(checkInMyEntry).toHaveBeenCalledWith({
    tournamentId: "t-detail",
    authMode: "mock",
    user: { id: "player-1", name: "テストユーザー" },
  });
  expect(await screen.findByText("チェックインしました。")).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "チェックインの確認" })).not.toBeInTheDocument();
});

test("キャンセル待ちもセルフチェックインでき、繰り上げ待ちを案内する", async () => {
  setMyDecklistState("submitted", {
    entry: { isWaitlisted: true },
    tournament: {
      selfCheckin: true,
      startsAt: new Date().toISOString(),
      registrationClosesAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "チェックインする" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "チェックインの確認" })).getByRole("button", {
      name: "チェックインする",
    })
  );

  expect(checkInMyEntry).toHaveBeenCalledWith({
    tournamentId: "t-detail",
    authMode: "mock",
    user: { id: "player-1", name: "テストユーザー" },
  });
  expect(
    await screen.findByText(
      "チェックインしました。主催者によるキャンセル待ちの繰り上げをお待ちください。"
    )
  ).toBeInTheDocument();
});

test("デッキリスト未提出のセルフチェックインでは追加警告を表示する", async () => {
  setSelfCheckInState("none");
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "チェックインする" }));

  const dialog = screen.getByRole("dialog", { name: "チェックインの確認" });
  expect(
    within(dialog).getByText(
      "デッキリストが未提出です。このままチェックインすると自分では提出できなくなります。"
    )
  ).toBeInTheDocument();
  expect(checkInMyEntry).not.toHaveBeenCalled();
});
