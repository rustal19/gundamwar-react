import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetail from "./TournamentDetail";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    isAuthenticated: false,
    user: null,
  }),
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({ items: [] }),
}));

jest.mock("../services/tournaments", () => ({
  checkInMyEntry: jest.fn(),
  createEntry: jest.fn(),
  deleteMyEntry: jest.fn(),
  updateMyEntry: jest.fn(),
  fetchTournament: () =>
    Promise.resolve({
      id: "t-detail",
      title: "参加者表示テスト大会",
      description: "",
      format: "swiss",
      status: "registration",
      startsAt: "2026-07-20T10:00:00.000Z",
      registrationClosesAt: "2026-07-19T10:00:00.000Z",
      capacity: 16,
      venue: "テスト会場",
      isOnline: false,
      decklistsPublic: false,
      decklistRequired: false,
      regulation: {},
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
    }),
  fetchRounds: () => Promise.resolve({ rounds: [] }),
  fetchStandings: () => Promise.resolve({ items: [] }),
}));

test("参加者ステータスを日本語ラベルで表示する", async () => {
  render(
    <MemoryRouter initialEntries={["/tournaments/t-detail"]}>
      <Routes>
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("button", { name: "参加者" }));

  expect(screen.getByText("公開ニックネーム")).toBeInTheDocument();
  expect(screen.getByText("チェックイン済み")).toBeInTheDocument();
  expect(screen.getByText("申請中")).toBeInTheDocument();
  expect(screen.queryByText("checked_in")).not.toBeInTheDocument();
  expect(screen.queryByText("pending")).not.toBeInTheDocument();
});
