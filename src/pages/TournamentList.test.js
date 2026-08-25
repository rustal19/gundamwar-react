import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { fetchMyTournaments, fetchTournaments } from "../services/tournaments";
import TournamentList from "./TournamentList";

const mockOrganizer = { id: "organizer-1", role: "organizer" };
let mockAuthState;

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../services/tournaments", () => ({
  __esModule: true,
  fetchMyTournaments: jest.fn(),
  fetchTournaments: jest.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderList(initialEntry = "/tournaments") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TournamentList />
      <LocationProbe />
    </MemoryRouter>
  );
}

function tournament(overrides) {
  return {
    id: "tournament-1",
    title: "テスト大会",
    status: "registration",
    startsAt: "2026-08-01T10:00:00.000Z",
    format: "swiss",
    regulation: { name: "スタンダード" },
    entryCount: 1,
    capacity: 16,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    isOrganizer: true,
    isReady: true,
    user: mockOrganizer,
  };
  fetchTournaments.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  fetchMyTournaments.mockResolvedValue({ items: [] });
});

test("作成者の情報で一覧を取得し、下書き大会を管理ページへの導線として表示する", async () => {
  fetchTournaments.mockResolvedValue({
    items: [
      {
        id: "draft-1",
        title: "作成中の大会",
        status: "draft",
        startsAt: "2026-08-01T10:00:00.000Z",
        format: "swiss",
        regulation: { name: "スタンダード" },
        entryCount: 0,
        capacity: 16,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
  });

  renderList();

  await waitFor(() =>
    expect(fetchTournaments).toHaveBeenCalledWith({
      status: "",
      page: 1,
      authMode: "mock",
      user: mockOrganizer,
    })
  );
  expect(await screen.findByText("下書き")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "作成中の大会" })).toHaveAttribute(
    "href",
    "/tournaments/draft-1/manage"
  );
});

test("自分の大会へ切り替えると参加中と参加済みの大会を表示してURLへ反映する", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: tournament({ id: "registration-1", title: "受付中の参加大会" }),
        entry: { id: "entry-1", status: "registered" },
      },
      {
        tournament: tournament({
          id: "in-progress-1",
          title: "進行中の参加大会",
          status: "in_progress",
        }),
        entry: { id: "entry-2", status: "checked_in" },
      },
      {
        tournament: tournament({
          id: "completed-1",
          title: "参加済みの大会",
          status: "completed",
        }),
        entry: { id: "entry-3", status: "registered" },
      },
    ],
  });

  renderList("/tournaments?status=&page=3&mobileLayout=1");
  const viewGroup = screen.getByRole("group", { name: "大会の表示範囲" });
  fireEvent.click(within(viewGroup).getByRole("button", { name: "自分の大会" }));

  await waitFor(() =>
    expect(fetchMyTournaments).toHaveBeenCalledWith({
      authMode: "mock",
      user: mockOrganizer,
    })
  );
  expect(await screen.findByText("受付中の参加大会")).toBeInTheDocument();
  expect(screen.getByText("進行中の参加大会")).toBeInTheDocument();
  expect(screen.getByText("参加済みの大会")).toBeInTheDocument();
  expect(screen.getByTestId("location-search")).toHaveTextContent(
    "?status=&page=1&mobileLayout=1&view=mine"
  );
});

test("URLから自分の大会表示を復元する", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: tournament({ id: "completed-1", title: "過去に参加した大会", status: "completed" }),
        entry: { id: "entry-1", status: "registered" },
      },
    ],
  });

  renderList("/tournaments?view=mine");

  expect(await screen.findByText("過去に参加した大会")).toBeInTheDocument();
  expect(fetchTournaments).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole("group", { name: "大会の表示範囲" })).getByRole("button", {
      name: "自分の大会",
    })
  ).toHaveAttribute("aria-pressed", "true");
});

test("自分の大会では運営している非掲載大会を表示する", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: tournament({
          id: "managed-unlisted",
          title: "運営中のURL限定大会",
          isListed: false,
        }),
        entry: null,
        needsDecklist: false,
      },
    ],
  });

  renderList("/tournaments?view=mine");

  expect(await screen.findByText("運営中のURL限定大会")).toBeInTheDocument();
  expect(fetchTournaments).not.toHaveBeenCalled();
});

test("自分の参加大会が0件なら既存の空状態文言を表示する", async () => {
  renderList("/tournaments?view=mine");

  await waitFor(() => expect(fetchMyTournaments).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument());
  expect(screen.getByText("表示できる大会がありません。")).toBeInTheDocument();
});

test("自分の大会の取得に失敗しても全大会のカードを残さない", async () => {
  fetchTournaments.mockResolvedValue({
    items: [tournament({ id: "public-1", title: "全大会にだけある大会" })],
    total: 1,
    page: 1,
    pageSize: 10,
  });
  fetchMyTournaments.mockRejectedValue(new Error("自分の大会を取得できませんでした。"));

  renderList();
  expect(await screen.findByText("全大会にだけある大会")).toBeInTheDocument();

  fireEvent.click(
    within(screen.getByRole("group", { name: "大会の表示範囲" })).getByRole("button", {
      name: "自分の大会",
    })
  );

  expect(await screen.findByText("自分の大会を取得できませんでした。")).toBeInTheDocument();
  expect(screen.queryByText("全大会にだけある大会")).not.toBeInTheDocument();
});

test("未ログインでは自分の大会を選べず、直リンクではログインを案内する", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: false,
    isOrganizer: false,
    isReady: true,
    user: null,
  };

  renderList("/tournaments?view=mine");

  const myTournamentsButton = within(
    screen.getByRole("group", { name: "大会の表示範囲" })
  ).getByRole("button", { name: "自分の大会" });
  expect(myTournamentsButton).toBeDisabled();
  expect(fetchMyTournaments).not.toHaveBeenCalled();
  expect(screen.getByText("ログインすると自分の大会を確認できます。")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/profile");
});
