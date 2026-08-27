import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchMyTournaments, fetchTournaments } from "../services/tournaments";
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
