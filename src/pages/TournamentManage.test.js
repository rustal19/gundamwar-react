import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentManage from "./TournamentManage";
import { updateMyEntry } from "../services/tournaments";
import { FORMAT_PRESETS } from "../data/formats";

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
let originalFetch;

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

function makeUiResultRound(number, status, result = "p1_win") {
  const roundId = `round-ui-${number}`;
  return {
    id: roundId,
    tournamentId: "t-ui",
    number,
    stage: "swiss",
    status,
    timerStartedAt: null,
    matches: [
      {
        id: `match-ui-${number}`,
        roundId,
        tableNo: 1,
        player1EntryId: "entry-1",
        player2EntryId: "entry-2",
        player1Games: result === "p1_win" ? 2 : 0,
        player2Games: result === "p2_win" ? 2 : 0,
        result,
      },
    ],
  };
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

function regulation(overrides = {}) {
  return {
    name: "スタンダード",
    mainMin: 50,
    mainMax: 50,
    sideSize: 10,
    maxCopies: 3,
    bannedCards: [],
    limitedCards: [],
    allowedSets: null,
    ...overrides,
  };
}

function mockCardSearch(searchResults) {
  global.fetch = jest.fn(async (_url, options) => {
    const request = JSON.parse(options.body);
    const cards =
      typeof searchResults === "function"
        ? searchResults(request.name, request)
        : searchResults[request.name] || [];
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: cards,
        total: cards.length,
        page: 1,
        pageSize: 200,
      }),
    };
  });
}

async function openRegulationEditor() {
  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  fireEvent.click(screen.getByText("詳細を編集"));
}

beforeEach(() => {
  originalFetch = global.fetch;
  window.localStorage.clear();
  mockAuthState = {
    authMode: "mock",
    isOrganizer: true,
    user: { ...mockOrganizerUser },
  };
});

afterEach(() => {
  if (originalFetch === undefined) {
    delete global.fetch;
  } else {
    global.fetch = originalFetch;
  }
  jest.restoreAllMocks();
});

test("BO3入力後にラウンドを完了前へ戻して結果を訂正できる", async () => {
  seedStore();
  renderManage();

  expect(await screen.findByText("UI大会")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "第1回戦" })).toBeInTheDocument();
  expect(screen.getByText("第1回戦 / 全3回戦")).toBeInTheDocument();
  expect(screen.queryByLabelText("トーナメント表")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1-1" })).toBeInTheDocument();
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

  expect(screen.queryByRole("button", { name: "訂正" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "結果を修正" }));
  expect(
    await screen.findByText("第1回戦を完了前に戻しました。結果を修正してください。")
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).rounds["t-ui"][0].status).toBe(
    "in_progress"
  );

  fireEvent.click(screen.getByRole("button", { name: "訂正" }));
  fireEvent.click(screen.getByRole("button", { name: "2-0" }));
  expect(await screen.findByText((content, element) => element?.classList.contains("score-badge") && content === "2-0")).toBeInTheDocument();
});

test("SEラウンドはSE内連番で表示し、引き分けスコアを入力できない", async () => {
  seedStore({
    tournament: { swissRounds: 3, topCutSize: 2 },
    rounds: [
      {
        id: "round-ui-4",
        tournamentId: "t-ui",
        number: 4,
        stage: "top_cut",
        status: "in_progress",
        matches: [
          {
            id: "match-ui-4",
            roundId: "round-ui-4",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: null,
            player2Games: null,
            result: null,
          },
        ],
      },
    ],
  });
  renderManage();

  expect(await screen.findByRole("button", { name: "SE1回戦" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "1-1" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "..." }));
  const player1Games = screen.getByLabelText("プレイヤー1ゲーム数");
  const player2Games = screen.getByLabelText("プレイヤー2ゲーム数");
  const saveButton = screen.getByRole("button", { name: "保存" });

  fireEvent.change(player1Games, { target: { value: "1" } });
  fireEvent.change(player2Games, { target: { value: "1" } });

  expect(saveButton).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "SEラウンドでは同数のスコアを保存できません。"
  );

  fireEvent.change(player2Games, { target: { value: "0" } });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);

  await waitFor(() => {
    const storedMatch = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).rounds["t-ui"][0]
      .matches[0];
    expect(storedMatch).toMatchObject({
      player1Games: 1,
      player2Games: 0,
      result: "p1_win",
    });
  });
});

test("スイス完了後にSEを生成し、ブラケット決着まで進行できる", async () => {
  seedStore({ tournament: { swissRounds: 1, topCutSize: 2 } });
  renderManage();

  await screen.findByText("UI大会");
  fireEvent.click(screen.getByRole("button", { name: "2-0" }));
  await screen.findByText(
    (content, element) => element?.classList.contains("score-badge") && content === "2-0"
  );
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  await screen.findByText("ラウンドを完了しました。");

  await waitFor(() => expect(screen.getByRole("button", { name: "次ラウンド生成" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "次ラウンド生成" }));
  await screen.findByText("次ラウンドを生成しました。");

  fireEvent.click(await screen.findByRole("button", { name: "SE1回戦" }));
  expect(screen.getByLabelText("トーナメント表")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "1-1" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "順位表" }));
  expect(await screen.findByRole("heading", { name: "スイス順位表" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ラウンド運営" }));
  expect(await screen.findByRole("button", { name: "SE1回戦" })).toHaveClass("active");

  fireEvent.click(screen.getByRole("button", { name: "0-2" }));
  await screen.findByText(
    (content, element) => element?.classList.contains("score-badge") && content === "0-2"
  );
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  await screen.findByText("ラウンドを完了しました。");

  await waitFor(() => {
    const storedTournament = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0];
    expect(storedTournament.status).toBe("completed");
  });
});

test("後続ラウンドは専用確認ダイアログで明示してから結果ごと破棄する", async () => {
  seedStore({
    tournament: { status: "completed" },
    rounds: [
      makeUiResultRound(1, "completed"),
      makeUiResultRound(2, "in_progress", "p2_win"),
    ],
  });
  const nativeConfirm = jest.spyOn(window, "confirm");
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "第1回戦" }));
  fireEvent.click(screen.getByRole("button", { name: "結果を修正" }));

  let dialog = await screen.findByRole("dialog", { name: "後続ラウンド破棄の確認" });
  expect(
    within(dialog).getByText(
      /大会の完了状態も解除され、進行中に戻ります。第2回戦以降のラウンドと対戦結果をすべて破棄します/
    )
  ).toBeInTheDocument();
  expect(nativeConfirm).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
  expect(screen.queryByRole("dialog", { name: "後続ラウンド破棄の確認" })).not.toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).rounds["t-ui"]).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "結果を修正" }));
  dialog = await screen.findByRole("dialog", { name: "後続ラウンド破棄の確認" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "第2回戦以降を破棄して修正" })
  );

  expect(
    await screen.findByText("第1回戦を完了前に戻しました。結果を修正してください。")
  ).toBeInTheDocument();
  await waitFor(() => {
    const storedRounds = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).rounds["t-ui"];
    expect(storedRounds).toHaveLength(1);
    expect(storedRounds[0]).toMatchObject({ id: "round-ui-1", status: "in_progress" });
    expect(storedRounds[0].matches.map((match) => match.id)).not.toContain("match-ui-2");
  });
});

test("直前より前の完了ラウンドは理由を示して巻き戻し操作を拒否する", async () => {
  seedStore({
    tournament: { status: "completed" },
    rounds: [
      makeUiResultRound(1, "completed"),
      makeUiResultRound(2, "completed", "p2_win"),
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "第1回戦" }));
  const reopenButton = screen.getByRole("button", { name: "結果を修正" });
  expect(reopenButton).toBeDisabled();
  expect(reopenButton).toHaveAttribute(
    "title",
    "修正できるのは直前に完了した第2回戦だけです。"
  );
  expect(screen.getByText("修正できるのは直前に完了した第2回戦だけです。")).toBeInTheDocument();
});

test("完了した大会の最終ラウンドを巻き戻し、修正後に大会を再完了できる", async () => {
  seedStore({
    tournament: { status: "completed", swissRounds: 1 },
    rounds: [makeUiResultRound(1, "completed")],
  });
  const nativeConfirm = jest.spyOn(window, "confirm");
  renderManage();

  const reopenButton = await screen.findByRole("button", { name: "結果を修正" });
  expect(reopenButton).toBeEnabled();
  expect(
    screen.getByText("大会は完了しています。直前に完了したラウンドの結果を修正できます。")
  ).toBeInTheDocument();

  fireEvent.click(reopenButton);
  const dialog = await screen.findByRole("dialog", { name: "大会完了解除の確認" });
  expect(
    within(dialog).getByText(/大会の完了状態も解除され、進行中に戻ります/)
  ).toBeInTheDocument();
  expect(nativeConfirm).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "大会の完了状態を解除して修正" })
  );

  expect(
    await screen.findByText("第1回戦を完了前に戻しました。結果を修正してください。")
  ).toBeInTheDocument();
  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(store.tournaments[0].status).toBe("in_progress");
    expect(store.rounds["t-ui"][0].status).toBe("in_progress");
  });

  fireEvent.click(screen.getByRole("button", { name: "訂正" }));
  fireEvent.click(screen.getByRole("button", { name: "0-2" }));
  expect(await screen.findByText("結果を保存しました。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ラウンド完了" }));
  expect(await screen.findByText("ラウンドを完了しました。")).toBeInTheDocument();
  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(store.tournaments[0].status).toBe("completed");
    expect(store.rounds["t-ui"][0].status).toBe("completed");
  });
});

test("一般参加者には権限エラーだけを表示して管理操作を隠す", async () => {
  mockAuthState = {
    authMode: "mock",
    isOrganizer: false,
    user: {
      id: "participant-user",
      name: "一般参加者",
      role: "user",
    },
  };
  seedStore();
  renderManage();

  expect(await screen.findByText("この大会を管理する権限がありません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "受付開始" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "次ラウンド生成" })).not.toBeInTheDocument();
});

test("通常ユーザー権限の共同運営者が管理画面と掲示用導線を利用できる", async () => {
  mockAuthState = {
    authMode: "mock",
    isOrganizer: false,
    user: {
      id: "co-organizer-user",
      name: "共同運営ユーザー",
      role: "user",
    },
  };
  seedStore({
    tournament: {
      status: "draft",
      coOrganizers: [{ id: "co-organizer-user", name: "共同運営ユーザー" }],
    },
  });
  renderManage();

  expect(await screen.findByText("UI大会")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "掲示用に開く" })).toHaveAttribute(
    "href",
    "/tournaments/t-ui/display"
  );
  fireEvent.click(screen.getByRole("button", { name: "大会情報" }));
  expect(await screen.findByRole("heading", { name: "大会運営者" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "共同運営ユーザー" })).toHaveAttribute(
    "href",
    "/users/co-organizer-user"
  );
  expect(screen.queryByLabelText("共同運営者を検索")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "下書きを削除" })).not.toBeInTheDocument();
  expect(
    screen.getByText("共同運営者の追加・削除は主催者または管理者のみ行えます。")
  ).toBeInTheDocument();
});

test("作成者がニックネーム検索で共同運営者を追加・削除できる", async () => {
  window.localStorage.setItem(
    "gundamwar.users.v1",
    JSON.stringify([
      {
        id: "searched-user",
        name: "非公開の氏名",
        nickname: "検索ニックネーム",
        role: "user",
      },
    ])
  );
  seedStore({ tournament: { status: "draft", coOrganizers: [] } });
  renderManage();

  await screen.findByText("UI大会");
  fireEvent.click(screen.getByRole("button", { name: "大会情報" }));
  expect(screen.getByRole("button", { name: "下書きを削除" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("共同運営者を検索"), {
    target: { value: "検索ニックネーム" },
  });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "検索ニックネーム を共同運営者に追加" })
  );

  expect(await screen.findByText("共同運営者を追加しました。")).toBeInTheDocument();
  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(store.tournaments[0].coOrganizers).toEqual([
      { id: "searched-user", name: "検索ニックネーム" },
    ]);
  });

  fireEvent.click(
    screen.getByRole("button", { name: "検索ニックネーム を共同運営者から削除" })
  );
  expect(await screen.findByText("共同運営者を削除しました。")).toBeInTheDocument();
  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(store.tournaments[0].coOrganizers).toEqual([]);
  });
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
  expect(
    within(pendingSection.closest(".pending-entry-section")).getByText(
      "許可後にチェックインすると、第2回戦からペアリング対象になります。それ以前は不戦敗として扱われます。"
    )
  ).toBeInTheDocument();
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
  expect(screen.queryByText(/未チェックインが\d+人います/)).not.toBeInTheDocument();
});

test("チェックイン済みの参加者がいないときは次ラウンド生成を無効にする", async () => {
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
    "次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在0人）。"
  );
  expect(
    screen.getByText(
      "次ラウンドを生成できません: 次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在0人）。"
    )
  ).toBeInTheDocument();
});

test("未チェックイン人数と除外を案内し、checked_in の参加者だけで生成する", async () => {
  seedStore({
    rounds: [],
    entries: [
      {
        id: "registered-1",
        tournamentId: "t-ui",
        user: { id: "registered-player", name: "未チェックイン参加者" },
        deckItems: null,
        decklistSubmittedAt: null,
        status: "registered",
        joinedAtRound: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  renderManage();

  await screen.findByText("UI大会");
  const generateButton = screen.getByRole("button", { name: "次ラウンド生成" });
  expect(generateButton).toBeEnabled();
  expect(generateButton).toHaveAttribute(
    "aria-describedby",
    "round-generation-unchecked-notice"
  );
  expect(
    screen.getByText(
      "未チェックインが1人います。チェックインせずに次ラウンドを生成すると、その1人はペアリング対象から除外されます。"
    )
  ).toBeInTheDocument();

  fireEvent.click(generateButton);
  expect(await screen.findByText("次ラウンドを生成しました。")).toBeInTheDocument();
  const storedRound = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).rounds["t-ui"][0];
  const pairedEntryIds = storedRound.matches
    .flatMap((match) => [match.player1EntryId, match.player2EntryId])
    .filter(Boolean);
  expect(pairedEntryIds).toEqual(expect.arrayContaining(["entry-1", "entry-2"]));
  expect(pairedEntryIds).not.toContain("registered-1");
});

test("チェックイン済みが1人だけなら人数を示して次ラウンド生成を無効にする", async () => {
  seedStore({ rounds: [] });
  const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  store.entries["t-ui"] = [
    store.entries["t-ui"][0],
    {
      ...store.entries["t-ui"][1],
      status: "registered",
    },
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  renderManage();

  await screen.findByText("UI大会");
  const generateButton = screen.getByRole("button", { name: "次ラウンド生成" });
  expect(generateButton).toBeDisabled();
  expect(generateButton).toHaveAttribute(
    "title",
    "次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在1人）。"
  );
  expect(
    screen.getByText(
      "未チェックインが1人います。チェックインせずに次ラウンドを生成すると、その1人はペアリング対象から除外されます。"
    )
  ).toBeInTheDocument();
});

test("ラウンド制限時間が未設定ならタイマー設定ヒントを表示する", async () => {
  seedStore({ tournament: { roundTimeMinutes: null } });
  renderManage();

  expect(
    await screen.findByText("大会情報タブでラウンド制限時間を設定すると、残り時間タイマーを表示できます。")
  ).toBeInTheDocument();
});

test("大会作成フォームは既定で一覧掲載になり、説明を確認して非掲載で作成できる", async () => {
  renderNewTournament();

  const listingCheckbox = screen.getByRole("checkbox", { name: "大会一覧に掲載する" });
  expect(listingCheckbox).toBeChecked();
  expect(listingCheckbox).toHaveAccessibleDescription(
    "オフにするとローカル大会になり、大会一覧とホームの新着には表示されません。大会URLを知っている人だけが詳細を開き、通常どおり参加登録できます。"
  );

  fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "非掲載テスト大会" } });
  fireEvent.change(screen.getByLabelText("開始日時"), { target: { value: "2030-01-02T10:00" } });
  fireEvent.click(listingCheckbox);
  fireEvent.click(screen.getByRole("button", { name: "作成" }));

  await waitFor(() => {
    const store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const createdTournament = store.tournaments.find(
      (tournament) => tournament.title === "非掲載テスト大会"
    );
    expect(createdTournament).toMatchObject({
      title: "非掲載テスト大会",
      isListed: false,
    });
  });
});

test("掲載フラグがない既存大会は掲載として読み込む", async () => {
  seedStore({ rounds: [] });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));

  expect(screen.getByRole("checkbox", { name: "大会一覧に掲載する" })).toBeChecked();
});

test("大会編集で非掲載から掲載へ切り替えて保存できる", async () => {
  seedStore({ tournament: { isListed: false }, rounds: [] });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  const listingCheckbox = screen.getByRole("checkbox", { name: "大会一覧に掲載する" });
  expect(listingCheckbox).not.toBeChecked();

  fireEvent.click(listingCheckbox);
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(await screen.findByText("大会情報を保存しました。")).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].isListed).toBe(true);
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

test("大会編集でスイス終了条件を選択して保存する", async () => {
  seedStore({ rounds: [] });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));
  const endCondition = screen.getByLabelText("終了条件");
  expect(endCondition).toHaveValue("fixed_rounds");

  fireEvent.change(endCondition, { target: { value: "undefeated" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(await screen.findByText("大会情報を保存しました。")).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]).toMatchObject({
    swissEndCondition: "undefeated",
  });
});

test("ラウンド生成後はスイス終了条件を変更できない", async () => {
  seedStore();
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "大会情報" }));

  expect(screen.getByLabelText("終了条件")).toBeDisabled();
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

test("使用可能セットを3モードで切り替え、弾選択は日本語名の配列で保存する", async () => {
  seedStore({ rounds: [] });
  renderManage();
  await openRegulationEditor();

  expect(screen.getByRole("radio", { name: "制限なし(全カード)" })).toBeChecked();

  fireEvent.click(screen.getByRole("radio", { name: "弾を選ぶ" }));
  expect(screen.getByRole("checkbox", { name: "GUNDAM WAR" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "GUNDAM WAR" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "撃墜王出撃" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
      .regulation;
    expect(savedRegulation.allowedSets).toEqual(["GUNDAM WAR", "撃墜王出撃"]);
  });

  fireEvent.click(screen.getByRole("radio", { name: "この弾まで" }));
  expect(screen.getByRole("combobox", { name: "カットオフの弾" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: "制限なし(全カード)" }));
  expect(screen.queryByRole("combobox", { name: "カットオフの弾" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
      .regulation;
    expect(savedRegulation.allowedSets).toBeNull();
  });
});

test("この弾までを選ぶとカテゴリをまたいだ発売順で弾名を展開して保存する", async () => {
  seedStore({ rounds: [] });
  renderManage();
  await openRegulationEditor();

  fireEvent.click(screen.getByRole("radio", { name: "この弾まで" }));
  fireEvent.change(screen.getByRole("combobox", { name: "カットオフの弾" }), {
    target: { value: "宇宙の記憶" },
  });
  expect(screen.getByText("宇宙の記憶までの5弾を使用可能として保存します。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "弾を選ぶ" }));
  expect(screen.getByRole("checkbox", { name: "決戦！星一号作戦" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "宇宙の記憶" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "この弾まで" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
      .regulation;
    expect(savedRegulation.allowedSets).toEqual([
      "GUNDAM WAR",
      "撃墜王出撃",
      "決戦！星一号作戦",
      "宇宙要塞ア・バオア・クー",
      "宇宙の記憶",
    ]);
  });
});

test("既存の使用可能セットは既知の弾を選択し、不明な弾も未操作なら保持する", async () => {
  const existingAllowedSets = ["GUNDAM WAR", "旧データの不明な弾"];
  seedStore({
    tournament: {
      regulation: regulation({ allowedSets: existingAllowedSets }),
    },
    rounds: [],
  });
  renderManage();
  await openRegulationEditor();

  expect(screen.getByRole("radio", { name: "弾を選ぶ" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "GUNDAM WAR" })).toBeChecked();
  expect(screen.getByText("不明な弾")).toBeInTheDocument();
  expect(screen.getByText("旧データの不明な弾")).toBeInTheDocument();
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.allowedSets
  ).toEqual(existingAllowedSets);

  fireEvent.change(screen.getByLabelText("名称"), { target: { value: "既存値保持テスト" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
      .regulation;
    expect(savedRegulation.allowedSets).toEqual(existingAllowedSets);
  });
});

test("フォーマットプリセットの使用可能セットを弾選択へ反映してそのまま保存する", async () => {
  const preset = FORMAT_PRESETS.find((item) => item.name === "プリミティブ");
  expect(preset).toBeDefined();
  seedStore({ rounds: [] });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("フォーマットプリセット"), {
    target: { value: preset.name },
  });

  expect(screen.getByRole("radio", { name: "弾を選ぶ" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "GUNDAM WAR" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "プロモカード" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => {
    const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
      .regulation;
    expect(savedRegulation.allowedSets).toEqual(preset.regulation.allowedSets);
  });
});

test("一括入力で一意に解決した禁止カードをチップ化し、カードIDだけを保存する", async () => {
  seedStore({ rounds: [] });
  mockCardSearch({
    一意カード: [{ cardId: 100000001, name: "一意カード" }],
  });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("禁止カード一括入力"), {
    target: { value: "一意カード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "禁止カードを一括解決" }));

  expect(await screen.findByText("一意カード")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByText("大会情報を保存しました。")).toBeInTheDocument();

  const savedRegulation = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0]
    .regulation;
  expect(savedRegulation.bannedCards).toEqual(["100000001"]);
  expect(savedRegulation.bannedCards).not.toContain("一意カード");
});

test("一括入力が複数の同名カードに一致した場合は候補選択まで保存できない", async () => {
  seedStore({ rounds: [] });
  mockCardSearch({
    同名カード: [
      { cardId: "100000002", name: "同名カード", setName: "第1弾" },
      { cardId: "100000003", name: "同名カード", setName: "第2弾" },
    ],
  });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("禁止カード一括入力"), {
    target: { value: "同名カード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "禁止カードを一括解決" }));

  expect(
    await screen.findByRole("button", { name: "同名カード、収録弾: 第2弾" })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "同名カード、収録弾: 第2弾" }));
  expect(await screen.findByText("同名カード")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByText("大会情報を保存しました。");

  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual(["100000003"]);
});

test("未解決行が残る場合は行を明示して大会保存を拒否する", async () => {
  seedStore({ rounds: [] });
  mockCardSearch({ 見つからないカード: [] });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("禁止カード一括入力"), {
    target: { value: "見つからないカード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "禁止カードを一括解決" }));

  await waitFor(() => {
    expect(
      screen.getAllByText(/禁止カード 1行目「見つからないカード」: 未解決: 一致するカードが見つかりません/)
        .length
    ).toBeGreaterThan(0);
  });
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

  fireEvent.submit(screen.getByLabelText("タイトル").closest("form"));
  expect(await screen.findByText(/^大会を保存できません。/)).toHaveTextContent(
    "禁止カード 1行目「見つからないカード」"
  );
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual([]);
});

test("既存のカード名は読み込み時に解決するが、保存操作までは元データを書き換えない", async () => {
  seedStore({
    tournament: {
      regulation: regulation({ bannedCards: ["既存カード名"] }),
    },
    rounds: [],
  });
  mockCardSearch({
    既存カード名: [{ cardId: "100000004", name: "既存カード名" }],
  });
  renderManage();
  await openRegulationEditor();

  expect(await screen.findByText("既存カード名")).toBeInTheDocument();
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual(["既存カード名"]);

  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByText("大会情報を保存しました。");
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual(["100000004"]);
});

test("通常検索でカードを追加し、追加済みチップから個別削除できる", async () => {
  seedStore({ rounds: [] });
  mockCardSearch({
    検索カード: [{ cardId: "100000005", name: "検索カード" }],
  });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("禁止カードを検索"), {
    target: { value: "検索カード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "禁止カードの候補を検索" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "検索カード、収録弾: 不明",
    })
  );

  expect(screen.getByText("検索カード")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "検索カード を削除" })
  );
  expect(screen.queryByText("検索カード")).not.toBeInTheDocument();
});

test("解決できない既存カード名は元データを消さず未解決として残す", async () => {
  seedStore({
    tournament: {
      regulation: regulation({ bannedCards: ["解決不能な既存名"] }),
    },
    rounds: [],
  });
  mockCardSearch({ 解決不能な既存名: [] });
  renderManage();
  await openRegulationEditor();

  expect(await screen.findByLabelText("禁止カード 1行目を修正")).toHaveValue(
    "解決不能な既存名"
  );
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual(["解決不能な既存名"]);
});

test("既存の9桁カードIDは検索APIの制約下でも削除せず保持する", async () => {
  seedStore({
    tournament: {
      regulation: regulation({ bannedCards: ["100000006"] }),
    },
    rounds: [],
  });
  global.fetch = jest.fn();
  renderManage();
  await openRegulationEditor();

  expect(screen.getByText("カード名未取得 (100000006)")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByText("大会情報を保存しました。");
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.bannedCards
  ).toEqual(["100000006"]);
});

test("制限カードも検索解決したカードIDだけを保存する", async () => {
  seedStore({ rounds: [] });
  mockCardSearch({
    制限対象カード: [{ cardId: "100000007", name: "制限対象カード" }],
  });
  renderManage();
  await openRegulationEditor();

  fireEvent.change(screen.getByLabelText("制限カード一括入力"), {
    target: { value: "制限対象カード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "制限カードを一括解決" }));
  expect(await screen.findByText("制限対象カード")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByText("大会情報を保存しました。");
  expect(
    JSON.parse(window.localStorage.getItem(STORAGE_KEY)).tournaments[0].regulation.limitedCards
  ).toEqual(["100000007"]);
});

test("未対戦の参加者をキックのみで大会枠から削除できる", async () => {
  seedStore({
    entries: [
      {
        id: "entry-kick-only",
        tournamentId: "t-ui",
        user: { id: "player-kick-only", name: "キックのみ対象" },
        deckItems: null,
        decklistSubmittedAt: null,
        status: "registered",
        joinedAtRound: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  const targetRow = screen.getByText("キックのみ対象").closest("tr");
  fireEvent.click(within(targetRow).getByRole("button", { name: "キック" }));

  const dialog = screen.getByRole("dialog", { name: "参加者をキック" });
  expect(
    within(dialog).getByRole("checkbox", { name: "再エントリーも禁止する" })
  ).not.toBeChecked();
  fireEvent.click(within(dialog).getByRole("button", { name: "キックのみ実行" }));

  expect(await screen.findByText("参加者をキックしました。")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText("キックのみ対象")).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)).entries["t-ui"].some(
        (entry) => entry.id === "entry-kick-only"
      )
    ).toBe(false);
  });
});

test("キック時に再エントリーを禁止し、ban一覧から解除できる", async () => {
  seedStore({
    entries: [
      {
        id: "entry-kick-ban",
        tournamentId: "t-ui",
        user: { id: "player-kick-ban", name: "BAN対象選手" },
        deckItems: null,
        decklistSubmittedAt: null,
        status: "registered",
        joinedAtRound: 1,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  const targetRow = screen.getByText("BAN対象選手").closest("tr");
  fireEvent.click(within(targetRow).getByRole("button", { name: "キック" }));
  const dialog = screen.getByRole("dialog", { name: "参加者をキック" });
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "再エントリーも禁止する" })
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "キックして再エントリーも禁止" })
  );

  expect(
    await screen.findByText("参加者をキックし、再エントリーを禁止しました。")
  ).toBeInTheDocument();
  const banSection = screen.getByText("再エントリー禁止中").closest(".tournament-ban-section");
  expect(await within(banSection).findByText("BAN対象選手")).toBeInTheDocument();
  expect(within(banSection).getByText(/ユーザーID: player-kick-ban/)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).bans["t-ui"]).toHaveLength(1);

  fireEvent.click(
    within(banSection).getByRole("button", { name: "BAN対象選手 の再エントリー禁止を解除" })
  );
  expect(await screen.findByText("再エントリー禁止を解除しました。")).toBeInTheDocument();
  expect(
    await screen.findByText("再エントリー禁止中のユーザーはいません。")
  ).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).bans["t-ui"]).toEqual([]);
});

test("対戦表に登場済みの参加者はキック後も記録用のドロップ行として残る", async () => {
  seedStore();
  renderManage();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));
  let targetRow = screen.getByText("プレイヤー1").closest("tr");
  fireEvent.click(within(targetRow).getByRole("button", { name: "キック" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "参加者をキック" })).getByRole("button", {
      name: "キックのみ実行",
    })
  );

  expect(await screen.findByText("参加者をキックしました。")).toBeInTheDocument();
  await waitFor(() => {
    targetRow = screen.getByText("プレイヤー1").closest("tr");
    expect(within(targetRow).getAllByRole("cell")[2]).toHaveTextContent("ドロップ");
  });
  expect(within(targetRow).getByRole("button", { name: "キック" })).toBeInTheDocument();
  let store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  expect(store.entries["t-ui"].find((entry) => entry.id === "entry-1").status).toBe("dropped");
  expect(store.rounds["t-ui"][0].matches[0]).toMatchObject({
    player1EntryId: "entry-1",
    player2EntryId: "entry-2",
  });

  fireEvent.click(within(targetRow).getByRole("button", { name: "キック" }));
  const posthocDialog = screen.getByRole("dialog", { name: "参加者をキック" });
  fireEvent.click(
    within(posthocDialog).getByRole("checkbox", { name: "再エントリーも禁止する" })
  );
  fireEvent.click(
    within(posthocDialog).getByRole("button", { name: "キックして再エントリーも禁止" })
  );

  expect(
    await screen.findByText("参加者をキックし、再エントリーを禁止しました。")
  ).toBeInTheDocument();
  const banSection = screen.getByText("再エントリー禁止中").closest(".tournament-ban-section");
  expect(await within(banSection).findByText("プレイヤー1")).toBeInTheDocument();
  await waitFor(() => {
    targetRow = screen.getAllByText("プレイヤー1").find((node) => node.closest("tr"))?.closest("tr");
    expect(within(targetRow).getByRole("button", { name: "チェックイン" })).toBeDisabled();
  });
  store = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  expect(store.bans["t-ui"]).toEqual([
    expect.objectContaining({ user: expect.objectContaining({ id: "player-1" }) }),
  ]);
});
