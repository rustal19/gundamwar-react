import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetail, { formatCardCountRange } from "./TournamentDetail";
import {
  checkInMyEntry,
  createEntry,
  fetchTournament,
  updateMyEntry,
} from "../services/tournaments";

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
