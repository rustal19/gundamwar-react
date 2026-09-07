import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import UserProfile from "./UserProfile";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const originalFetch = global.fetch;

function renderUserProfile() {
  return render(
    <MemoryRouter initialEntries={["/users/user-2"]}>
      <Routes>
        <Route path="/users/:id" element={<UserProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ authMode: "api", user: null });
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("公開プロフィールのデッキ日付を区別し、デッキ・大会行に詳細導線を表示する", async () => {
  const publishedAt = "2026-08-02T12:34:00";
  const updatedAt = "2026-08-03T12:34:00";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      user: { id: "user-2", nickname: "公開プレイヤー" },
      publicDecks: [
        {
          id: "published-deck",
          title: "公開日ありデッキ",
          publishedAt,
          updatedAt,
          format: "スタンダード",
          items: [],
        },
        {
          id: "updated-deck",
          title: "更新日のみデッキ",
          publishedAt: "",
          updatedAt,
          items: [],
        },
      ],
      results: [
        {
          tournament: { id: "tournament-9", title: "公開プロフィール大会" },
          rank: 2,
          wins: 3,
          losses: 1,
          draws: 0,
        },
      ],
    }),
  });

  renderUserProfile();

  expect(await screen.findByRole("heading", { name: "公開プレイヤー" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("/api/users/user-2/profile", {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  const publishedDeckLink = screen.getByRole("link", { name: /公開日ありデッキ/ });
  expect(publishedDeckLink).toHaveAttribute("href", "/decks/published-deck");
  expect(within(publishedDeckLink).getByText(
    `公開日: ${new Date(publishedAt).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })}`
  )).toBeInTheDocument();
  expect(within(publishedDeckLink).getByText("詳細を見る →")).toHaveClass("profile-row-link-cue");

  const updatedDeckLink = screen.getByRole("link", { name: /更新日のみデッキ/ });
  expect(updatedDeckLink).toHaveAttribute("href", "/decks/updated-deck");
  expect(within(updatedDeckLink).getByText(
    `更新日: ${new Date(updatedAt).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })}`
  )).toBeInTheDocument();
  expect(within(updatedDeckLink).getByText("詳細を見る →")).toHaveClass("profile-row-link-cue");

  const tournamentLink = screen.getByRole("link", { name: /公開プロフィール大会/ });
  expect(tournamentLink).toHaveAttribute("href", "/tournaments/tournament-9");
  expect(within(tournamentLink).getByText("詳細を見る →")).toHaveClass("profile-row-link-cue");
});
