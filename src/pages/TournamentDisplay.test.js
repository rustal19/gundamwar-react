import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDisplay from "./TournamentDisplay";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    user: null,
  }),
}));

jest.mock("../services/tournaments", () => ({
  fetchTournament: jest.fn(() =>
    Promise.resolve({
      id: "t-display",
      title: "掲示テスト大会",
      status: "in_progress",
      roundTimeMinutes: 30,
      entries: [
        { id: "entry-1", user: { id: "user-1", name: "プレイヤー1" }, status: "checked_in" },
        { id: "entry-2", user: { id: "user-2", name: "プレイヤー2" }, status: "checked_in" },
      ],
    })
  ),
  fetchRounds: jest.fn(() =>
    Promise.resolve({
      rounds: [
        {
          id: "round-1",
          number: 1,
          status: "in_progress",
          timerStartedAt: new Date("2026-07-08T10:00:00.000Z").toISOString(),
          matches: [
            {
              id: "match-1",
              tableNo: 1,
              player1EntryId: "entry-1",
              player2EntryId: "entry-2",
              result: null,
            },
          ],
        },
      ],
    })
  ),
}));

test("TournamentDisplay はシンプルな掲示用ペアリングを表示する", async () => {
  render(
    <MemoryRouter initialEntries={["/tournaments/t-display/display"]}>
      <Routes>
        <Route path="/tournaments/:id/display" element={<TournamentDisplay />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText("掲示テスト大会")).toBeInTheDocument();
  expect(screen.getByText("現在ラウンド: 第1回戦")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText("プレイヤー1")).toBeInTheDocument();
  });
  expect(screen.getByText("プレイヤー2")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "ペアリング" })).toHaveAttribute("aria-selected", "true");
});
