import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentManage from "./TournamentManage";

const STORAGE_KEY = "gundamwar.tournaments.v1";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    isOrganizer: true,
    user: {
      id: "organizer-1",
      name: "主催者",
      email: "organizer@example.test",
      role: "organizer",
    },
  }),
}));

function seedStore(overrides = {}) {
  const now = new Date().toISOString();
  const tournament = {
    id: "t-ui",
    title: "UI大会",
    description: "",
    format: "swiss",
    swissRounds: 3,
    topCutSize: null,
    status: "in_progress",
    startsAt: now,
    registrationClosesAt: now,
    capacity: 16,
    venue: "テスト会場",
    isOnline: false,
    selfCheckin: false,
    decklistsPublic: false,
    decklistRequired: false,
    announcement: null,
    roundTimeMinutes: 30,
    lateEntry: true,
    regulation: {
      name: "スタンダード",
      mainMin: 50,
      mainMax: 50,
      sideSize: 10,
      maxCopies: 3,
      bannedCards: [],
      limitedCards: [],
      allowedSets: null,
    },
    createdBy: { id: "organizer-1", name: "主催者" },
    entryCount: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides.tournament,
  };
  const entries = [
    {
      id: "entry-1",
      tournamentId: "t-ui",
      user: { id: "player-1", name: "プレイヤー1" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    },
    {
      id: "entry-2",
      tournamentId: "t-ui",
      user: { id: "player-2", name: "プレイヤー2" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    },
    ...(overrides.entries || []),
  ];
  const rounds = [
    {
      id: "round-ui-1",
      tournamentId: "t-ui",
      number: 1,
      stage: "swiss",
      status: "in_progress",
      matches: [
        {
          id: "match-ui-1",
          roundId: "round-ui-1",
          tableNo: 1,
          player1EntryId: "entry-1",
          player2EntryId: "entry-2",
          player1Games: null,
          player2Games: null,
          result: null,
        },
      ],
    },
  ];
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tournaments: [tournament],
      entries: { "t-ui": entries },
      rounds: { "t-ui": overrides.rounds || rounds },
    })
  );
}

function renderManage() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t-ui/manage"]}>
      <Routes>
        <Route path="/tournaments/:id/manage" element={<TournamentManage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

test("BO3入力からスコア表示、ラウンド完了、訂正まで操作できる", async () => {
  seedStore();
  renderManage();

  expect(await screen.findByText("UI大会")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2-1" }));

  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(store.rounds["t-ui"][0].matches[0]).toMatchObject({
      player1Games: 2,
      player2Games: 1,
      result: "p1_win",
    });
  });
  expect(screen.getByText((content, element) => element?.classList.contains("score-badge") && content === "2-1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  expect(await screen.findByText("ラウンドを完了しました。")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "訂正" }));
  fireEvent.click(screen.getByRole("button", { name: "2-0" }));
  expect(await screen.findByText((content, element) => element?.classList.contains("score-badge") && content === "2-0")).toBeInTheDocument();
});

test("途中参加の申請を参加者タブで許可できる", async () => {
  seedStore({
    rounds: [
      {
        id: "round-ui-1",
        tournamentId: "t-ui",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          {
            id: "match-ui-1",
            roundId: "round-ui-1",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
          },
        ],
      },
    ],
    entries: [
      {
        id: "pending-1",
        tournamentId: "t-ui",
        user: { id: "pending-user", name: "申請者" },
        deckItems: null,
        decklistSubmittedAt: null,
        status: "pending",
        joinedAtRound: 2,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  const pendingSection = (await screen.findAllByText("申請中"))[0];
  expect(pendingSection).toBeInTheDocument();
  fireEvent.click(within(pendingSection.closest(".pending-entry-section")).getByRole("button", { name: "許可" }));

  expect(await screen.findByText("申請を許可しました。")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText("登録済み")).toBeInTheDocument();
  });
  expect(screen.getByText((content, element) => element?.classList.contains("mini-badge") && content === "第2回戦から")).toBeInTheDocument();
});

test("次にやることのガイド行とフォーマットプリセット展開が動作する", async () => {
  seedStore();
  renderManage();

  expect(await screen.findByText("UI大会")).toBeInTheDocument();
  expect(screen.getByText(/未報告卓が1卓あります。結果を入力してください。/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "大会情報" }));
  const maxCopiesInput = screen.getByLabelText("同名上限");
  fireEvent.change(maxCopiesInput, { target: { value: "2" } });
  expect(screen.getByLabelText("フォーマットプリセット")).toHaveValue("その他");

  fireEvent.change(screen.getByLabelText("フォーマットプリセット"), { target: { value: "スタンダード" } });
  expect(screen.getByLabelText("同名上限")).toHaveValue(3);
  expect(screen.getByLabelText("メイン下限")).toHaveValue(50);
});

test("ラウンド制限時間が未設定ならタイマー設定ヒントを表示する", async () => {
  seedStore({ tournament: { roundTimeMinutes: null } });
  renderManage();

  expect(
    await screen.findByText("大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。")
  ).toBeInTheDocument();
});
