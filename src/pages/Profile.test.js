import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        entry: { id: "e1", user: { id: "u1" }, status: "registered", decklistSubmittedAt: null },
        needsDecklist: true,
      },
      {
        tournament: {
          id: "t2",
          title: "完了大会",
          status: "completed",
          startsAt: "2026-07-01T10:00:00.000Z",
        },
        entry: { id: "e2", user: { id: "u1" }, status: "registered", decklistSubmittedAt: "2026-06-30" },
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
  expect(screen.getByText("Google Name")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "公開ページを見る" })).toHaveAttribute("href", "/users/u1");

  await waitFor(() => expect(screen.getByText("受付中大会")).toBeInTheDocument());
  expect(screen.getByText("未提出")).toBeInTheDocument();
  expect(screen.getAllByText("完了大会")).toHaveLength(2);
  expect(screen.getByText("優勝")).toBeInTheDocument();
  expect(screen.getAllByText("4-0-0")).toHaveLength(2);
  expect(screen.getByText("公開デッキ数").nextSibling).toHaveTextContent("1");
});

test("saves nickname from the my page form", async () => {
  const updateProfile = jest.fn().mockResolvedValue({});
  renderProfile({ updateProfile });

  fireEvent.change(screen.getByLabelText("ニックネーム変更"), { target: { value: "新名" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ nickname: "新名" }));
  await waitFor(() => expect(screen.getByText("プロフィールを更新しました。")).toBeInTheDocument());
});

test("shows login panel when not authenticated", () => {
  renderProfile({ isAuthenticated: false, user: null });

  expect(screen.getByRole("heading", { name: "マイページ" })).toBeInTheDocument();
  expect(screen.getByText("ログインパネル")).toBeInTheDocument();
});
