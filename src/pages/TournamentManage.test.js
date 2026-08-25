import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentManage from "./TournamentManage";
import { updateMyEntry } from "../services/tournaments";

const STORAGE_KEY = "gundamwar.tournaments.v1";

const mockOrganizerUser = {
  id: "organizer-1",
  name: "主催者",
  email: "organizer@example.test",
  role: "organizer",
};
let mockAuthState = {
  authMode: "mock",
  isOrganizer: true,
  user: mockOrganizerUser,
};

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
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
    checkinOpensAt: null,
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

function renderNewTournament() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/new"]}>
      <Routes>
        <Route path="/tournaments/new" element={<TournamentManage />} />
        <Route path="/tournaments/:id/manage" element={<TournamentManage />} />
      </Routes>
    </MemoryRouter>
  );
}

function validDeck(prefix = "card") {
  return Array.from({ length: 50 }, (_, index) => ({
    cardId: `${prefix}-${index}`,
    card: { id: `${prefix}-${index}`, name: `カード${index + 1}` },
    count: 1,
    zone: "main",
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  mockAuthState = {
    authMode: "mock",
    isOrganizer: true,
    user: { ...mockOrganizerUser },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
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
  expect(
    await screen.findByText(
      (content, element) => element?.classList.contains("score-badge") && content === "2-1"
    )
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  expect(await screen.findByText("ラウンドを完了しました。")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "訂正" }));
  fireEvent.click(screen.getByRole("button", { name: "2-0" }));
  expect(await screen.findByText((content, element) => element?.classList.contains("score-badge") && content === "2-0")).toBeInTheDocument();
});

test("別の主催者には権限エラーだけを表示して管理操作を隠す", async () => {
  mockAuthState = {
    authMode: "mock",
    isOrganizer: true,
    user: {
      id: "other-organizer",
      name: "別の主催者",
      role: "organizer",
    },
  };
  seedStore();
  renderManage();

  expect(await screen.findByText("この大会を管理する権限がありません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "受付開始" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "次ラウンド生成" })).not.toBeInTheDocument();
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

test("次ラウンド生成は進行中ラウンドの完了後に有効になる", async () => {
  seedStore();
  renderManage();

  await screen.findByText("UI大会");
  const generateButton = screen.getByRole("button", { name: "次ラウンド生成" });
  expect(generateButton).toBeDisabled();
  expect(generateButton).toHaveAttribute("title", "現在のラウンドを完了してください。");
  expect(screen.getByText("次ラウンドを生成できません: 現在のラウンドを完了してください。")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "2-0" }));
  await screen.findByText("結果を保存しました。");
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "ラウンド完了" })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  await screen.findByText("ラウンドを完了しました。");

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "次ラウンド生成" })).toBeEnabled();
  });
  expect(screen.queryByText(/次ラウンドを生成できません/)).not.toBeInTheDocument();
});

test("アクティブな参加者がいないときは次ラウンド生成を無効にする", async () => {
  seedStore({ rounds: [] });
  const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  store.entries["t-ui"] = [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  renderManage();

  await screen.findByText("UI大会");
  const generateButton = screen.getByRole("button", { name: "次ラウンド生成" });
  expect(generateButton).toBeDisabled();
  expect(generateButton).toHaveAttribute(
    "title",
    "次ラウンド生成にはアクティブな参加者が2人以上必要です。"
  );
  expect(
    screen.getByText("次ラウンドを生成できません: 次ラウンド生成にはアクティブな参加者が2人以上必要です。")
  ).toBeInTheDocument();
});

test("ラウンド制限時間が未設定ならタイマー設定ヒントを表示する", async () => {
  seedStore({ tournament: { roundTimeMinutes: null } });
  renderManage();

  expect(
    await screen.findByText("大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。")
  ).toBeInTheDocument();
});

test("大会作成時は開始日時が必須で、未入力では作成できない", () => {
  renderNewTournament();
  fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "開始日時なし大会" } });

  const startsAtInput = screen.getByLabelText("開始日時");
  expect(startsAtInput).toBeRequired();
  expect(startsAtInput.closest("form")).not.toBeValid();
  fireEvent.click(screen.getByRole("button", { name: "作成" }));

  expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
});

test("大会編集時は開始日時を空にして保存できない", async () => {
  seedStore();
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  const startsAtInput = screen.getByLabelText("開始日時");
  const originalStartsAt = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].startsAt;
  fireEvent.change(startsAtInput, { target: { value: "" } });

  expect(startsAtInput).toBeRequired();
  expect(startsAtInput.closest("form")).not.toBeValid();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].startsAt).toBe(originalStartsAt);
});

test("大会編集でチェックイン開始を読み込み、開始日時以前の値を保存できる", async () => {
  const startsAt = new Date(2030, 0, 2, 10, 0).toISOString();
  const checkinOpensAt = new Date(2030, 0, 2, 9, 0).toISOString();
  seedStore({ tournament: { startsAt, checkinOpensAt }, rounds: [] });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  const startsAtInput = screen.getByLabelText("開始日時");
  const checkinOpensAtInput = screen.getByLabelText("チェックイン開始");
  expect(checkinOpensAtInput).toHaveValue("2030-01-02T09:00");
  expect(checkinOpensAtInput).toHaveAttribute("max", startsAtInput.value);

  fireEvent.change(checkinOpensAtInput, { target: { value: "2030-01-02T08:30" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(await screen.findByText("大会情報を保存しました。")).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].checkinOpensAt).toBe(
    new Date(2030, 0, 2, 8, 30).toISOString()
  );
});

test("チェックイン開始が開始日時より後なら大会情報を保存できない", async () => {
  const startsAt = new Date(2030, 0, 2, 10, 0).toISOString();
  const originalCheckinOpensAt = new Date(2030, 0, 2, 9, 0).toISOString();
  seedStore({ tournament: { startsAt, checkinOpensAt: originalCheckinOpensAt }, rounds: [] });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  const checkinOpensAtInput = screen.getByLabelText("チェックイン開始");
  fireEvent.change(checkinOpensAtInput, { target: { value: "2030-01-02T10:01" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].checkinOpensAt).toBe(
      originalCheckinOpensAt
    );
  });
  expect(checkinOpensAtInput.closest("form")).not.toBeValid();
});

test("参加者が0人なら空状態メッセージを表示する", async () => {
  seedStore();
  const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  store.entries["t-ui"] = [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  expect(screen.getByText("参加登録されていません")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "名前" })).not.toBeInTheDocument();
});

test("主催者のチェックイン操作は確認ダイアログなしで実行する", async () => {
  seedStore({
    entries: [
      {
        id: "entry-organizer-checkin",
        tournamentId: "t-ui",
        user: { id: "player-organizer-checkin", name: "受付対象選手" },
        deckItems: null,
        decklistSubmittedAt: null,
        deckLockedAt: null,
        status: "registered",
        joinedAtRound: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  const entryRow = screen.getByText("受付対象選手").closest("tr");
  fireEvent.click(within(entryRow).getByRole("button", { name: "チェックイン" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByText("参加者の状態を更新しました。")).toBeInTheDocument();
  await waitFor(() => {
    const storedEntry = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).entries["t-ui"].find(
      (entry) => entry.id === "entry-organizer-checkin"
    );
    expect(storedEntry.status).toBe("checked_in");
    expect(storedEntry.deckLockedAt).toBeTruthy();
  });
});

test("参加者ごとのデッキリスト状態と主催者の監査記録を表示する", async () => {
  seedStore({
    entries: [
      {
        id: "entry-submitted",
        tournamentId: "t-ui",
        user: { id: "player-submitted", name: "提出済み選手" },
        deckItems: validDeck("submitted"),
        decklistSubmittedAt: "2026-08-25T13:00:00",
        deckLockedAt: null,
        status: "registered",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00",
      },
      {
        id: "entry-locked",
        tournamentId: "t-ui",
        user: { id: "player-locked", name: "ロック選手" },
        deckItems: validDeck("locked"),
        decklistSubmittedAt: "2026-08-25T13:00:00",
        deckLockedAt: "2026-08-26T10:00:00",
        deckUpdatedBy: { id: "organizer-1", name: "主催者" },
        deckUpdatedAt: "2026-08-26T14:00:00",
        deckUnlockedBy: { id: "organizer-1", name: "主催者" },
        deckUnlockedAt: "2026-08-26T13:30:00",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00",
      },
      {
        id: "entry-none-locked",
        tournamentId: "t-ui",
        user: { id: "player-none-locked", name: "未提出ロック選手" },
        deckItems: null,
        decklistSubmittedAt: null,
        deckLockedAt: "2026-08-26T10:00:00",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00",
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  const noneRow = screen.getByText("プレイヤー1").closest("tr");
  const submittedRow = screen.getByText("提出済み選手").closest("tr");
  const lockedRow = screen.getByText("ロック選手").closest("tr");
  const noneLockedRow = screen.getByText("未提出ロック選手").closest("tr");
  expect(within(noneRow).getByText("未提出")).toBeInTheDocument();
  expect(within(submittedRow).getByText("提出済み")).toBeInTheDocument();
  expect(within(lockedRow).getByText("ロック中")).toBeInTheDocument();
  expect(within(lockedRow).getByText("主催者が修正 2026-08-26 14:00")).toBeInTheDocument();
  expect(within(lockedRow).getByText("主催者がロック解除 2026-08-26 13:30")).toBeInTheDocument();
  expect(within(noneLockedRow).getByText("未提出")).toBeInTheDocument();
  expect(within(noneLockedRow).getByText("未提出のままロック中")).toBeInTheDocument();
  expect(
    within(noneLockedRow).getByRole("button", {
      name: "ロックを解除して再提出可能にする",
    })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("checkbox", { name: "未提出のみ" }));
  expect(screen.getByText("プレイヤー1")).toBeInTheDocument();
  expect(screen.getByText("未提出ロック選手")).toBeInTheDocument();
  expect(screen.queryByText("提出済み選手")).not.toBeInTheDocument();
  expect(screen.queryByText("ロック選手")).not.toBeInTheDocument();
});

test("ロック中のデッキを代理上書きすると主催者の修正記録を表示する", async () => {
  seedStore({
    entries: [
      {
        id: "entry-proxy-update",
        tournamentId: "t-ui",
        user: { id: "player-proxy", name: "代理修正選手" },
        deckItems: validDeck("original"),
        decklistSubmittedAt: "2026-08-25T13:00:00.000Z",
        deckLockedAt: "2026-08-26T10:00:00.000Z",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00.000Z",
      },
    ],
  });
  const deckText = Array.from(
    { length: 50 },
    (_, index) => `代理カード${index + 1},1,main`
  ).join("\n");
  jest.spyOn(window, "prompt").mockReturnValue(deckText);
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  let proxyRow = screen.getByText("代理修正選手").closest("tr");
  fireEvent.click(within(proxyRow).getByRole("button", { name: "デッキ登録" }));

  expect(await screen.findByText("デッキを登録しました。")).toBeInTheDocument();
  proxyRow = screen.getByText("代理修正選手").closest("tr");
  expect(within(proxyRow).getByText(/主催者が修正/)).toBeInTheDocument();
  await waitFor(() => {
    const storedEntry = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).entries["t-ui"].find(
      (entry) => entry.id === "entry-proxy-update"
    );
    expect(storedEntry.deckUpdatedBy).toEqual({ id: "organizer-1", name: "主催者" });
    expect(storedEntry.deckUpdatedAt).toBeTruthy();
    expect(storedEntry.deckLockedAt).toBe("2026-08-26T10:00:00.000Z");
  });
});

test("ロック解除後に手動再ロックでき、本人の再提出でも自動再ロックされる", async () => {
  seedStore({
    tournament: { registrationClosesAt: "2099-08-30T10:00:00.000Z" },
    entries: [
      {
        id: "entry-revision",
        tournamentId: "t-ui",
        user: { id: "player-revision", name: "再提出選手" },
        deckItems: validDeck("before"),
        decklistSubmittedAt: "2026-08-25T13:00:00.000Z",
        deckLockedAt: "2026-08-26T10:00:00.000Z",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00.000Z",
      },
    ],
  });
  const view = renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  let revisionRow = screen.getByText("再提出選手").closest("tr");
  fireEvent.click(
    within(revisionRow).getByRole("button", {
      name: "ロックを解除して再提出可能にする",
    })
  );

  expect(
    await screen.findByText("デッキリストのロックを解除しました。本人が再提出できます。")
  ).toBeInTheDocument();
  revisionRow = screen.getByText("再提出選手").closest("tr");
  expect(within(revisionRow).getByText("提出済み")).toBeInTheDocument();
  expect(within(revisionRow).getByText("ロック解除済み・再提出待ち")).toBeInTheDocument();
  expect(within(revisionRow).getByText(/主催者がロック解除/)).toBeInTheDocument();
  expect(within(revisionRow).getByRole("button", { name: "手動で再ロック" })).toBeInTheDocument();
  await waitFor(() => {
    const storedEntry = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).entries["t-ui"].find(
      (entry) => entry.id === "entry-revision"
    );
    expect(storedEntry.deckLockedAt).toBeNull();
    expect(storedEntry.deckUnlockedBy).toEqual({ id: "organizer-1", name: "主催者" });
    expect(storedEntry.deckUnlockedAt).toBeTruthy();
  });

  fireEvent.click(within(revisionRow).getByRole("button", { name: "手動で再ロック" }));
  expect(await screen.findByText("デッキリストを再ロックしました。")).toBeInTheDocument();
  revisionRow = screen.getByText("再提出選手").closest("tr");
  expect(within(revisionRow).getByText("ロック中")).toBeInTheDocument();
  expect(within(revisionRow).queryByText("ロック解除済み・再提出待ち")).not.toBeInTheDocument();

  fireEvent.click(
    within(revisionRow).getByRole("button", {
      name: "ロックを解除して再提出可能にする",
    })
  );
  await screen.findByText("デッキリストのロックを解除しました。本人が再提出できます。");

  await updateMyEntry({
    tournamentId: "t-ui",
    deckItems: validDeck("resubmitted"),
    authMode: "mock",
    user: { id: "player-revision", name: "再提出選手" },
  });
  view.unmount();
  renderManage();
  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  revisionRow = screen.getByText("再提出選手").closest("tr");
  expect(within(revisionRow).getByText("ロック中")).toBeInTheDocument();
  expect(within(revisionRow).queryByText("ロック解除済み・再提出待ち")).not.toBeInTheDocument();
  expect(within(revisionRow).queryByRole("button", { name: "手動で再ロック" })).not.toBeInTheDocument();
});

test("公開済み大会は公開中を表示し解除・上書き操作を表示しない", async () => {
  seedStore({
    tournament: { status: "completed", decklistsPublic: true },
    entries: [
      {
        id: "entry-revealed",
        tournamentId: "t-ui",
        user: { id: "player-revealed", name: "公開選手" },
        deckItems: validDeck("revealed"),
        decklistSubmittedAt: "2026-08-25T13:00:00.000Z",
        deckLockedAt: "2026-08-26T10:00:00.000Z",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00.000Z",
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  const revealedRow = screen.getByText("公開選手").closest("tr");
  expect(within(revealedRow).getByText("公開中")).toBeInTheDocument();
  expect(within(revealedRow).queryByRole("button", { name: "デッキ登録" })).not.toBeInTheDocument();
  expect(
    within(revealedRow).queryByRole("button", {
      name: "ロックを解除して再提出可能にする",
    })
  ).not.toBeInTheDocument();
  expect(within(revealedRow).queryByRole("button", { name: "手動で再ロック" })).not.toBeInTheDocument();
});

test("完了後は非公開でも解除・上書き・再ロック操作を表示しない", async () => {
  seedStore({
    tournament: { status: "completed", decklistsPublic: false },
    entries: [
      {
        id: "entry-completed-private",
        tournamentId: "t-ui",
        user: { id: "player-private", name: "非公開完了選手" },
        deckItems: validDeck("private"),
        decklistSubmittedAt: "2026-08-25T13:00:00.000Z",
        deckLockedAt: "2026-08-26T10:00:00.000Z",
        deckUnlockedBy: { id: "organizer-1", name: "主催者" },
        deckUnlockedAt: "2026-08-26T09:00:00.000Z",
        status: "checked_in",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00.000Z",
      },
      {
        id: "entry-completed-unlocked",
        tournamentId: "t-ui",
        user: { id: "player-private-unlocked", name: "非公開解除選手" },
        deckItems: validDeck("private-unlocked"),
        decklistSubmittedAt: "2026-08-25T13:00:00.000Z",
        deckLockedAt: null,
        deckUnlockedBy: { id: "organizer-1", name: "主催者" },
        deckUnlockedAt: "2026-08-26T09:00:00.000Z",
        status: "registered",
        joinedAtRound: 1,
        createdAt: "2026-08-25T13:00:00.000Z",
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  const completedRow = screen.getByText("非公開完了選手").closest("tr");
  expect(within(completedRow).getByText("ロック中")).toBeInTheDocument();
  expect(within(completedRow).queryByRole("button", { name: "デッキ登録" })).not.toBeInTheDocument();
  expect(
    within(completedRow).queryByRole("button", {
      name: "ロックを解除して再提出可能にする",
    })
  ).not.toBeInTheDocument();
  expect(within(completedRow).queryByRole("button", { name: "手動で再ロック" })).not.toBeInTheDocument();

  const unlockedRow = screen.getByText("非公開解除選手").closest("tr");
  expect(within(unlockedRow).getByText("ロック解除済み・未再提出")).toBeInTheDocument();
  expect(within(unlockedRow).queryByRole("button", { name: "デッキ登録" })).not.toBeInTheDocument();
  expect(within(unlockedRow).queryByRole("button", { name: "手動で再ロック" })).not.toBeInTheDocument();
});
