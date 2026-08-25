import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetail, { formatCardCountRange } from "./TournamentDetail";
import { createEntry, fetchTournament, updateMyEntry } from "../services/tournaments";

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
  fetchRounds: () => Promise.resolve({ rounds: [] }),
  fetchStandings: () => Promise.resolve({ items: [] }),
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t-detail"]}>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
      </Routes>
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
  updateMyEntry.mockReset().mockResolvedValue({});
});

test("レギュレーション枚数は同値を単一表記、異なる値を範囲表記にする", () => {
  expect(formatCardCountRange(50, 50)).toBe("50枚");
  expect(formatCardCountRange(50, 60)).toBe("50 - 60枚");
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

test("参加者ステータスを日本語ラベルで表示する", async () => {
  renderDetail();

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  expect(screen.getByText("公開ニックネーム")).toBeInTheDocument();
  expect(screen.getByText("チェックイン済み")).toBeInTheDocument();
  expect(screen.getByText("申請中")).toBeInTheDocument();
  expect(screen.queryByText("checked_in")).not.toBeInTheDocument();
  expect(screen.queryByText("pending")).not.toBeInTheDocument();
});

test("任意大会ではデッキなしでエントリーし未提出として扱う", async () => {
  mockAuthState = {
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "player-1", name: "テストユーザー" },
  };
  mockTournament = registrationTournament();

  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "エントリー" }));

  expect(createEntry).toHaveBeenCalledWith(
    expect.objectContaining({ tournamentId: "t-detail", deckItems: null })
  );
  expect(await screen.findByText("エントリーしました。")).toBeInTheDocument();
  expect(screen.queryByText("デッキリストを提出しました。")).not.toBeInTheDocument();
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
