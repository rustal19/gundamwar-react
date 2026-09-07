import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Profile from "./Profile";
import { useAuth, validateNickname } from "../context/AuthContext";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchMyTournaments, fetchRounds, fetchStandings } from "../services/tournaments";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
  validateNickname: jest.fn(() => ""),
}));

jest.mock("../components/GoogleSignInPanel", () => () => <div>ログインパネル</div>);

jest.mock("../services/publicDecks", () => ({
  fetchPublicDecks: jest.fn(),
}));

jest.mock("../services/tournaments", () => ({
  fetchMyTournaments: jest.fn(),
  fetchRounds: jest.fn(),
  fetchStandings: jest.fn(),
}));

function renderProfile(authValue) {
  useAuth.mockReturnValue({
    authMode: "mock",
    isAuthenticated: true,
    isReady: true,
    updateProfile: jest.fn(),
    user: { id: "u1", name: "Google Name", nickname: "テスト太郎" },
    ...authValue,
  });
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  validateNickname.mockReturnValue("");
  fetchPublicDecks.mockResolvedValue({
    items: [{ id: "d1", isPublic: true, owner: { id: "u1" } }],
  });
  fetchMyTournaments.mockResolvedValue({
    items: [
      {
        tournament: {
          id: "t1",
          title: "受付中大会",
          status: "registration",
          startsAt: "2026-08-01T10:00:00.000Z",
          decklistRequired: true,
        },
        entry: {
          id: "e1",
          user: { id: "u1" },
          status: "registered",
          decklistState: "none",
          decklistSubmittedAt: null,
          deckLockedAt: null,
        },
        needsDecklist: true,
      },
      {
        tournament: {
          id: "t2",
          title: "完了大会",
          status: "completed",
          startsAt: "2026-07-01T10:00:00.000Z",
        },
        entry: {
          id: "e2",
          user: { id: "u1" },
          status: "registered",
          decklistState: "revealed",
          decklistSubmittedAt: "2026-06-30",
          deckLockedAt: "2026-06-30",
        },
        needsDecklist: false,
      },
    ],
  });
  fetchRounds.mockResolvedValue({ rounds: [] });
  fetchStandings.mockResolvedValue({
    items: [{ entryId: "e2", rank: 1, wins: 4, losses: 0, draws: 0 }],
  });
});

test("renders my page profile, metrics, tournaments, and results", async () => {
  renderProfile();

  expect(screen.getByRole("heading", { name: "テスト太郎" })).toBeInTheDocument();
  expect(screen.getByText("Google アカウント名:")).toBeInTheDocument();
  expect(screen.getByText("Google Name")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "公開ページを見る" })).toHaveAttribute("href", "/users/u1");

  expect(await screen.findByText("受付中大会")).toBeInTheDocument();
  const upcomingLink = screen.getByRole("link", { name: /受付中大会/ });
  expect(upcomingLink).toHaveAttribute("href", "/tournaments/t1");
  expect(within(upcomingLink).getByText("詳細を見る →")).toHaveClass("profile-row-link-cue");
  expect(screen.getByText("未提出・提出してください")).toBeInTheDocument();
  expect(screen.getAllByText("完了大会")).toHaveLength(2);
  const completedLinks = screen.getAllByRole("link", { name: /完了大会/ });
  expect(completedLinks).toHaveLength(2);
  completedLinks.forEach((link) => {
    expect(link).toHaveAttribute("href", "/tournaments/t2");
    expect(within(link).getByText("詳細を見る →")).toHaveClass("profile-row-link-cue");
  });
  expect(screen.getByText("優勝")).toBeInTheDocument();
  expect(screen.getAllByText("4勝0敗0分")).toHaveLength(2);
  expect(screen.getByLabelText("公開デッキ数の値")).toHaveTextContent("1");
});

test("大会ごとにデッキリストの4状態を表示する", async () => {
  fetchMyTournaments.mockResolvedValue({
    items: [
      ["none", "未提出大会", "registration"],
      ["submitted", "提出済み大会", "registration"],
      ["locked", "ロック大会", "in_progress"],
      ["revealed", "公開大会", "completed"],
    ].map(([decklistState, title, status], index) => ({
      tournament: {
        id: `state-${decklistState}`,
        title,
        status,
        startsAt: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      },
      entry: {
        id: `entry-${decklistState}`,
        user: { id: "u1" },
        status: "registered",
        decklistState,
        deckLockedAt: ["locked", "revealed"].includes(decklistState)
          ? "2026-08-01T09:00:00.000Z"
          : null,
      },
    })),
  });

  renderProfile();

  expect(await screen.findByText("未提出大会")).toBeInTheDocument();
  expect(screen.getByText("未提出・提出してください")).toBeInTheDocument();
  expect(screen.getByText("提出済み・差し替え可")).toBeInTheDocument();
  expect(screen.getByText("ロック中・修正は主催者へ")).toBeInTheDocument();
  expect(screen.getByText("公開中・差し替え不可")).toBeInTheDocument();
});

test("saves nickname from the my page form", async () => {
  const updateProfile = jest.fn().mockResolvedValue({});
  renderProfile({ updateProfile });

  fireEvent.change(screen.getByLabelText("ニックネーム変更"), { target: { value: "新名" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ nickname: "新名" }));
  expect(await screen.findByText("プロフィールを更新しました。")).toBeInTheDocument();
});

test("shows login panel when not authenticated", () => {
  renderProfile({ isAuthenticated: false, user: null });

  expect(screen.getByRole("heading", { name: "マイページ" })).toBeInTheDocument();
  expect(screen.getByText("ログインパネル")).toBeInTheDocument();
});

test("取得中は0件や空状態を表示しない", () => {
  fetchMyTournaments.mockReturnValue(new Promise(() => {}));
  fetchPublicDecks.mockReturnValue(new Promise(() => {}));

  renderProfile();

  expect(screen.getByText("大会情報を読み込み中...")).toBeInTheDocument();
  expect(screen.getByText("公開デッキ情報を読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("参加予定の大会はありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("完了した大会の戦績はまだありません。")).not.toBeInTheDocument();
  expect(screen.getByLabelText("参加大会数の値")).toHaveTextContent("—");
  expect(screen.getByLabelText("公開デッキ数の値")).toHaveTextContent("—");
});

test("取得成功後の空状態を取得失敗と区別する", async () => {
  fetchMyTournaments.mockResolvedValue({ items: [] });
  fetchPublicDecks.mockResolvedValue({ items: [] });

  renderProfile();

  expect(await screen.findByText("参加・運営している大会はありません。")).toBeInTheDocument();
  expect(screen.getByText("公開しているデッキはありません。")).toBeInTheDocument();
  expect(screen.getByLabelText("参加大会数の値")).toHaveTextContent("0");
  expect(screen.getByLabelText("公開デッキ数の値")).toHaveTextContent("0");
  expect(screen.queryByRole("heading", { name: "過去の戦績" })).not.toBeInTheDocument();
});

test("大会取得失敗は空状態を併記せず再試行できる", async () => {
  fetchMyTournaments
    .mockRejectedValueOnce(new Error("Request failed with status 500"))
    .mockResolvedValueOnce({ items: [] });

  renderProfile();

  expect(
    await screen.findByText("大会情報を取得できませんでした。時間をおいて再試行してください。")
  ).toBeInTheDocument();
  expect(screen.queryByText("参加・運営している大会はありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("Request failed with status 500")).not.toBeInTheDocument();
  expect(screen.getByLabelText("参加大会数の値")).toHaveTextContent("—");

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("参加・運営している大会はありません。")).toBeInTheDocument();
  expect(fetchMyTournaments).toHaveBeenCalledTimes(2);
});

test("公開デッキだけ取得に失敗しても大会情報を表示し、0件とは扱わない", async () => {
  fetchPublicDecks.mockRejectedValue(new Error("Request failed with status 503"));

  renderProfile();

  expect(await screen.findByText("受付中大会")).toBeInTheDocument();
  expect(
    screen.getByText("公開デッキ情報を取得できませんでした。時間をおいて再試行してください。")
  ).toBeInTheDocument();
  expect(screen.getByLabelText("参加大会数の値")).toHaveTextContent("2");
  expect(screen.getByLabelText("公開デッキ数の値")).toHaveTextContent("—");
  expect(screen.queryByText("公開しているデッキはありません。")).not.toBeInTheDocument();
});

test("公開デッキは ownerId で絞り、複数ページあれば全ページ数える", async () => {
  const myDecks = Array.from({ length: 20 }, (_, index) => ({
    id: `mine-${index}`,
    isPublic: true,
    owner: { id: "u1" },
  }));
  fetchPublicDecks.mockImplementation(({ page }) =>
    Promise.resolve(
      page === 1
        ? { items: myDecks, total: 21, page: 1, pageSize: 20 }
        : {
            items: [{ id: "mine-page-2", isPublic: true, owner: { id: "u1" } }],
            total: 21,
            page: 2,
            pageSize: 20,
          }
    )
  );

  renderProfile();

  await waitFor(() =>
    expect(screen.getByLabelText("公開デッキ数の値")).toHaveTextContent("21")
  );
  // 全公開デッキではなく本人ぶんだけを取得している
  expect(fetchPublicDecks).toHaveBeenCalledWith({
    authMode: "mock",
    page: 1,
    ownerId: "u1",
  });
  expect(fetchPublicDecks).toHaveBeenCalledWith({
    authMode: "mock",
    page: 2,
    ownerId: "u1",
  });
  expect(screen.queryByText("公開しているデッキはありません。")).not.toBeInTheDocument();
});

test("順位取得失敗を戦績なしと誤表示しない", async () => {
  fetchStandings.mockRejectedValue(new Error("standings unavailable"));

  renderProfile();

  expect(
    await screen.findByText("一部の大会の順位・戦績を取得できませんでした。")
  ).toBeInTheDocument();
  expect(screen.queryByText("完了した大会の戦績はまだありません。")).not.toBeInTheDocument();
  expect(screen.getByLabelText("優勝数の値")).toHaveTextContent("—");
  expect(screen.getByLabelText("通算成績の値")).toHaveTextContent("—");
});

test("ラウンド取得失敗を空として隠さず、取得済みの順位は表示する", async () => {
  fetchRounds.mockRejectedValue(new Error("rounds unavailable"));

  renderProfile();

  expect(
    await screen.findByText("一部の大会の対戦情報を取得できませんでした。")
  ).toBeInTheDocument();
  expect(screen.getByText("優勝")).toBeInTheDocument();
  expect(screen.queryByText("完了した大会の戦績はまだありません。")).not.toBeInTheDocument();
});

test("認証準備中は取得前の0件を表示しない", () => {
  renderProfile({ isReady: false });

  expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("参加予定の大会はありません。")).not.toBeInTheDocument();
  expect(fetchMyTournaments).not.toHaveBeenCalled();
  expect(fetchPublicDecks).not.toHaveBeenCalled();
});

test("プロフィール保存失敗を日本語で表示する", async () => {
  const updateProfile = jest.fn().mockRejectedValue(new Error("Request failed with status 500"));
  renderProfile({ updateProfile });

  fireEvent.change(screen.getByLabelText("ニックネーム変更"), { target: { value: "新名" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  expect(
    await screen.findByText("プロフィールを更新できませんでした。もう一度お試しください。")
  ).toBeInTheDocument();
  expect(screen.queryByText("Request failed with status 500")).not.toBeInTheDocument();
});
