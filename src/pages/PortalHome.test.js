import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { fetchPublicDecks } from "../services/publicDecks";
import {
  fetchMyTournaments,
  fetchRounds,
  fetchTournament,
  fetchTournaments,
} from "../services/tournaments";
import PortalHome from "./PortalHome";

let mockAuthState = {
  authMode: "mock",
  isAuthenticated: true,
  user: { id: "user-1", name: "テストユーザー" },
};

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../services/tournaments", () => ({
  __esModule: true,
  fetchMyTournaments: jest.fn(),
  fetchRounds: jest.fn(),
  fetchTournament: jest.fn(),
  fetchTournaments: jest.fn(),
}));

jest.mock("../services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(),
}));

const registrationTournaments = Array.from({ length: 4 }, (_, index) => ({
  id: `registration-${index}`,
  title: `受付中大会${index + 1}`,
  status: "registration",
  startsAt: `2026-07-0${index + 2}T10:00:00.000Z`,
  venue: index === 0 ? "" : "東京カードホール",
  isOnline: index === 0,
  format: "swiss",
  regulation: { name: "スタンダード" },
  entryCount: index + 1,
  capacity: 16,
  entries: index === 0 ? [{ id: "entry-1", user: { id: "user-1", name: "テストユーザー" } }] : [],
}));

const inProgressTournaments = Array.from({ length: 3 }, (_, index) => ({
  id: `in-progress-${index}`,
  title: `進行中大会${index + 1}`,
  status: "in_progress",
  startsAt: `2026-07-1${index}T13:00:00.000Z`,
  venue: "大阪ショップ",
  isOnline: false,
  format: "swiss",
  regulation: { name: "スタンダード" },
  entryCount: index + 8,
  capacity: 32,
}));

beforeEach(() => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "user-1", name: "テストユーザー" },
  };
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: registrationTournaments[0],
        entry: { id: "entry-1", user: { id: "user-1", name: "繝・せ繝医Θ繝ｼ繧ｶ繝ｼ" } },
        needsDecklist: true,
      },
    ],
  });
  fetchTournaments.mockImplementation(({ status }) => {
    const itemsByStatus = {
      registration: registrationTournaments,
      in_progress: inProgressTournaments,
      completed: [],
    };
    return Promise.resolve({ items: itemsByStatus[status] || [] });
  });
  fetchRounds.mockResolvedValue({ rounds: [] });
  fetchTournament.mockResolvedValue({ entries: [] });
  fetchPublicDecks.mockResolvedValue({
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `deck-${index}`,
      title: `公開デッキ${index + 1}`,
      items: [
        {
          count: 3,
          card: {
            name: "ガンダム",
            sp_power_color1_name: index % 2 === 0 ? "青" : "赤",
          },
        },
      ],
      owner: { name: "投稿者" },
      publishedAt: `2026-07-0${index + 1}T10:00:00.000Z`,
    })),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("PortalHome は道具箱トップ構成で大会と公開デッキを最大5件表示する", async () => {
  render(
    <MemoryRouter initialEntries={["/?mobileLayout=ios"]}>
      <PortalHome />
    </MemoryRouter>
  );

  expect(screen.queryByText("Gundam War Portal")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("カード名で検索")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "あなたの大会" })).toBeInTheDocument();
    expect(screen.getAllByText("受付中大会1")).toHaveLength(1);
    expect(screen.getByText("公開デッキ1")).toBeInTheDocument();
  });

  expect(screen.getAllByText(/大会\d/)).toHaveLength(6);
  expect(screen.getAllByText(/公開デッキ\d/)).toHaveLength(5);
  expect(screen.getAllByRole("link", { name: "一覧へ" })[0]).toHaveAttribute(
    "href",
    "/tournaments?mobileLayout=ios"
  );
  expect(screen.getAllByLabelText("デッキ色: 青")).toHaveLength(3);
});

test("カード名検索は自分の大会がある場合もホームの最上部に表示する", async () => {
  const { container } = render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = (await screen.findByRole("heading", { name: "あなたの大会" })).closest(
    "section"
  );
  const home = container.querySelector("main.portal-home");
  const searchForm = screen.getByRole("search", { name: "カード名検索" });

  expect(home.firstElementChild).toBe(searchForm);
  expect(searchForm.nextElementSibling).toBe(mySection);
});

test("開催前の参加大会は予定だけをコンパクトに表示する", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: {
          ...registrationTournaments[1],
          title: "参加予定大会",
          startsAt: "2026-07-03T19:30:00",
        },
        entry: { id: "upcoming-entry", status: "registered" },
        needsDecklist: false,
      },
    ],
  });

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = await screen.findByRole("region", { name: "あなたの大会" });
  const card = within(mySection).getByRole("article");

  expect(card).toHaveAttribute("data-home-state", "upcoming");
  expect(within(card).getByText("参加予定")).toBeInTheDocument();
  expect(within(card).getByText("7月3日(金) 19:30")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "詳細" })).toHaveAttribute(
    "href",
    "/tournaments/registration-1"
  );
  expect(within(card).queryByText("卓番号")).not.toBeInTheDocument();
});

test("進行中の参加大会は卓番号・対戦相手・次の操作を強調する", async () => {
  const activeTournament = {
    ...inProgressTournaments[0],
    id: "my-active",
    title: "参加中大会",
    swissRounds: 3,
  };
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: activeTournament,
        entry: { id: "my-entry", status: "checked_in" },
        needsDecklist: false,
      },
    ],
  });
  fetchRounds.mockResolvedValue({
    rounds: [
      {
        id: "round-1",
        number: 1,
        status: "in_progress",
        matches: [
          {
            id: "match-1",
            tableNo: 7,
            player1EntryId: "my-entry",
            player2EntryId: "opponent-entry",
            result: null,
          },
        ],
      },
    ],
  });
  fetchTournament.mockResolvedValue({
    entries: [
      { id: "my-entry", user: { id: "user-1", name: "テストユーザー" } },
      { id: "opponent-entry", user: { id: "user-2", name: "対戦プレイヤー" } },
    ],
  });

  render(
    <MemoryRouter initialEntries={["/?mobileLayout=ios"]}>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = await screen.findByRole("region", { name: "あなたの大会" });
  const card = within(mySection).getByRole("article");

  expect(card).toHaveAttribute("data-home-state", "in-progress");
  expect(within(card).getByText("第1回戦 / 全3回戦")).toBeInTheDocument();
  expect(within(card).getByText("卓番号")).toBeInTheDocument();
  expect(within(card).getByText("7卓")).toBeInTheDocument();
  expect(within(card).getByText("対戦相手")).toBeInTheDocument();
  expect(within(card).getByText("対戦プレイヤー")).toBeInTheDocument();
  expect(within(card).getByText("次の操作")).toBeInTheDocument();
  expect(within(card).getByText("卓へ移動して対戦する")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "ペアリングを確認" })).toHaveAttribute(
    "href",
    "/tournaments/my-active?tab=rounds&mobileLayout=ios"
  );
  expect(fetchRounds).toHaveBeenCalledWith("my-active", {
    authMode: "mock",
    user: mockAuthState.user,
  });
  expect(fetchTournament).toHaveBeenCalledWith("my-active", {
    authMode: "mock",
    user: mockAuthState.user,
  });
});

test("デッキリスト未提出はほかの情報より対応操作を優先して警告する", async () => {
  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = await screen.findByRole("region", { name: "あなたの大会" });
  const card = within(mySection).getByRole("article");

  expect(card).toHaveAttribute("data-home-state", "needs-action");
  expect(within(card).getByText("対応が必要")).toBeInTheDocument();
  expect(within(card).getByText("デッキリストが未提出です。")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "デッキを提出" })).toHaveAttribute(
    "href",
    "/tournaments/registration-0"
  );
  expect(within(card).queryByRole("link", { name: "詳細" })).not.toBeInTheDocument();
  expect(within(card).queryByText("卓番号")).not.toBeInTheDocument();
});

test("あなたの大会を大会セクションから除外し後続候補で5件まで補う", async () => {
  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = (await screen.findByRole("heading", { name: "あなたの大会" })).closest(
    "section"
  );
  const featuredSection = screen.getByRole("heading", { name: "大会" }).closest("section");

  await waitFor(() => {
    expect(within(featuredSection).getAllByRole("article")).toHaveLength(5);
  });
  expect(within(mySection).getByText("受付中大会1")).toBeInTheDocument();
  expect(within(featuredSection).queryByText("受付中大会1")).not.toBeInTheDocument();
  expect(within(featuredSection).getByText("進行中大会2")).toBeInTheDocument();
  expect(within(featuredSection).queryByText("進行中大会3")).not.toBeInTheDocument();
  within(featuredSection)
    .getAllByRole("link", { name: /^(詳細|観戦)$/ })
    .forEach((action) => expect(action).toHaveClass("secondary"));
});

test("未ログインでは検索を先頭に保ち自分の大会を取得しない", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: false,
    user: null,
  };

  const { container } = render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  await screen.findByText("受付中大会1");
  expect(fetchMyTournaments).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "あなたの大会" })).not.toBeInTheDocument();
  expect(container.querySelector("main.portal-home").firstElementChild).toBe(
    screen.getByRole("search", { name: "カード名検索" })
  );
});

test("運営だけしている大会は参加大会として表示しない", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: { ...registrationTournaments[0], title: "運営中大会" },
        entry: null,
        needsDecklist: false,
      },
    ],
  });

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  await screen.findByRole("heading", { name: "大会" });
  expect(screen.queryByRole("heading", { name: "あなたの大会" })).not.toBeInTheDocument();
});

test("大会と公開デッキが0件でも検索と各セクションの空表示を保つ", async () => {
  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchTournaments.mockResolvedValue({ items: [] });
  fetchPublicDecks.mockResolvedValue({ items: [] });

  const { container } = render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  expect(await screen.findByText("受付中・進行中の大会はありません。")).toBeInTheDocument();
  expect(await screen.findByText("公開デッキはありません。")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "あなたの大会" })).not.toBeInTheDocument();
  expect(container.querySelector("main.portal-home").firstElementChild).toBe(
    screen.getByRole("search", { name: "カード名検索" })
  );
});

test("新着公開デッキはPCの列見出しとcompactの行内ラベルを両方持つ", async () => {
  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchPublicDecks.mockResolvedValue({
    items: [
      {
        id: "labeled-deck",
        title: "ラベル確認デッキ",
        format: "スタンダード",
        items: [],
        owner: { id: "player-1", name: "投稿プレイヤー" },
        publishedAt: "2026-09-02T10:00:00.000Z",
      },
    ],
  });

  render(
    <MemoryRouter>
      <PortalHome compact />
    </MemoryRouter>
  );

  const deckTable = await screen.findByRole("table", { name: "新着公開デッキ一覧" });
  expect(screen.getByRole("main")).toHaveClass("compact");
  expect(within(deckTable).getByRole("columnheader", { name: "デッキ名" })).toBeInTheDocument();
  expect(
    within(deckTable).getByRole("columnheader", { name: "フォーマット" })
  ).toBeInTheDocument();
  expect(
    within(deckTable).getByRole("columnheader", { name: "プレイヤー" })
  ).toBeInTheDocument();
  expect(within(deckTable).getByRole("columnheader", { name: "公開日" })).toBeInTheDocument();

  const dataRow = within(deckTable).getByRole("row", { name: /ラベル確認デッキ/ });
  expect(within(dataRow).getByText("フォーマット:")).toHaveClass(
    "portal-deck-cell-label"
  );
  expect(within(dataRow).getByText("スタンダード")).toBeInTheDocument();
  expect(within(dataRow).getByText("プレイヤー:")).toHaveClass("portal-deck-cell-label");
  expect(within(dataRow).getByRole("link", { name: "投稿プレイヤー" })).toHaveAttribute(
    "href",
    "/users/player-1"
  );
  expect(within(dataRow).getByText("公開日:")).toHaveClass("portal-deck-cell-label");
  expect(within(dataRow).getByText("2026/09/02")).toBeInTheDocument();
});

test("取得済みの掲載大会をホームに表示し、あなたの大会には参加中の非掲載大会を表示する", async () => {
  const unlistedTournament = {
    ...registrationTournaments[0],
    id: "home-unlisted",
    title: "参加中のURL限定大会",
    isListed: false,
  };
  const listedTournament = {
    ...registrationTournaments[1],
    id: "home-listed",
    title: "ホーム掲載大会",
    isListed: true,
  };
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: unlistedTournament,
        entry: { id: "home-unlisted-entry", status: "registered" },
        needsDecklist: false,
      },
    ],
  });
  fetchTournaments.mockImplementation(({ status }) =>
    Promise.resolve({
      items: status === "registration" ? [listedTournament] : [],
    })
  );

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  const mySection = (await screen.findByRole("heading", { name: "あなたの大会" })).closest(
    "section"
  );
  const featuredSection = screen.getByRole("heading", { name: "大会" }).closest("section");

  expect(within(mySection).getByText("参加中のURL限定大会")).toBeInTheDocument();
  expect(within(featuredSection).getByText("ホーム掲載大会")).toBeInTheDocument();
  expect(within(featuredSection).queryByText("参加中のURL限定大会")).not.toBeInTheDocument();
});

test("カード名検索は SearchForm と同じ name パラメータで遷移する", async () => {
  window.history.pushState({}, "", "/?mobileLayout=ios");

  render(
    <BrowserRouter>
      <PortalHome />
    </BrowserRouter>
  );

  fireEvent.change(screen.getByPlaceholderText("カード名で検索"), {
    target: { value: "ガンダム" },
  });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() => {
    expect(window.location.pathname).toBe("/search");
    expect(window.location.search).toContain("name=%E3%82%AC%E3%83%B3%E3%83%80%E3%83%A0");
    expect(window.location.search).toContain("mobileLayout=ios");
  });
});

test("ホームの大会は開催予定・受付中・進行中・完了直後を残し、完了2日後は除外する", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date(2026, 6, 20, 12, 0, 0).getTime());

  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchTournaments.mockImplementation(({ status }) => {
    const itemsByStatus = {
      registration: [
        {
          id: "upcoming",
          title: "開催予定大会",
          status: "registration",
          startsAt: "2026-07-21T10:00:00",
        },
        {
          id: "open-registration",
          title: "受付中大会",
          status: "registration",
          startsAt: "2026-07-20T18:00:00",
        },
      ],
      in_progress: [
        {
          id: "active",
          title: "進行中大会",
          status: "in_progress",
          startsAt: "2026-07-01T10:00:00",
        },
      ],
      completed: [
        {
          id: "just-completed",
          title: "完了直後大会",
          status: "completed",
          startsAt: "2026-07-20T08:00:00",
        },
        {
          id: "completed-two-days-ago",
          title: "完了2日後大会",
          status: "completed",
          startsAt: "2026-07-18T23:00:00",
        },
      ],
    };
    return Promise.resolve({ items: itemsByStatus[status] || [] });
  });

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText("開催予定大会")).toBeInTheDocument();
    expect(screen.getByText("受付中大会")).toBeInTheDocument();
    expect(screen.getByText("進行中大会")).toBeInTheDocument();
    expect(screen.getByText("完了直後大会")).toBeInTheDocument();
  });
  expect(screen.queryByText("完了2日後大会")).not.toBeInTheDocument();
  expect(fetchTournaments).toHaveBeenCalledWith({
    status: "completed",
    page: 1,
    authMode: "mock",
  });
});

test("完了大会が5件以上あっても受付中・進行中の大会を優先表示する", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date(2026, 6, 20, 12, 0, 0).getTime());

  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchTournaments.mockImplementation(({ status }) => {
    const itemsByStatus = {
      registration: [
        {
          id: "priority-registration",
          title: "優先表示される受付中大会",
          status: "registration",
          startsAt: "2026-07-21T10:00:00",
        },
      ],
      in_progress: [
        {
          id: "priority-in-progress",
          title: "優先表示される進行中大会",
          status: "in_progress",
          startsAt: "2026-07-20T10:00:00",
        },
      ],
      completed: Array.from({ length: 5 }, (_, index) => ({
        id: `priority-completed-${index}`,
        title: `表示候補の完了大会${index + 1}`,
        status: "completed",
        startsAt: `2026-07-19T0${index + 1}:00:00`,
      })),
    };
    return Promise.resolve({ items: itemsByStatus[status] || [] });
  });

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText("優先表示される受付中大会")).toBeInTheDocument();
    expect(screen.getByText("優先表示される進行中大会")).toBeInTheDocument();
    expect(screen.getByText("表示候補の完了大会3")).toBeInTheDocument();
  });
  expect(screen.queryByText("表示候補の完了大会4")).not.toBeInTheDocument();
  expect(screen.queryByText("表示候補の完了大会5")).not.toBeInTheDocument();
});

test("完了大会は日付だけでも翌日中は残り、翌々日境界で消え、日時未設定なら残る", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date(2026, 6, 20, 0, 0, 0).getTime());

  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchTournaments.mockImplementation(({ status }) =>
    Promise.resolve({
      items:
        status === "completed"
          ? [
              {
                id: "completed-yesterday",
                title: "日付のみ翌日大会",
                status: "completed",
                startsAt: "2026-07-19",
              },
              {
                id: "completed-boundary",
                title: "日付のみ翌々日大会",
                status: "completed",
                startsAt: "2026-07-18",
              },
              {
                id: "completed-without-date",
                title: "日時未設定完了大会",
                status: "completed",
                startsAt: "",
              },
              {
                id: "completed-with-ended-at",
                title: "完了日優先大会",
                status: "completed",
                startsAt: "2026-07-01",
                endedAt: "2026-07-19",
              },
            ]
          : [],
    })
  );

  render(
    <MemoryRouter>
      <PortalHome />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText("日付のみ翌日大会")).toBeInTheDocument();
    expect(screen.getByText("日時未設定完了大会")).toBeInTheDocument();
    expect(screen.getByText("完了日優先大会")).toBeInTheDocument();
  });
  expect(screen.queryByText("日付のみ翌々日大会")).not.toBeInTheDocument();
});
