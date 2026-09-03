import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchRounds, fetchTournament } from "../services/tournaments";
import TournamentDisplay from "./TournamentDisplay";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    user: null,
  }),
}));

jest.mock("../services/tournaments", () => ({
  fetchTournament: jest.fn(),
  fetchRounds: jest.fn(),
}));

const entries = [
  { id: "entry-1", user: { id: "user-1", name: "プレイヤー1" }, status: "checked_in" },
  { id: "entry-2", user: { id: "user-2", name: "プレイヤー2" }, status: "checked_in" },
];

function renderDisplay() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t-display/display"]}>
      <Routes>
        <Route path="/tournaments/:id/display" element={<TournamentDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fetchTournament.mockReset().mockResolvedValue({
    id: "t-display",
    title: "掲示テスト大会",
    status: "in_progress",
    swissRounds: 4,
    roundTimeMinutes: 30,
    entries,
  });
  fetchRounds.mockReset().mockResolvedValue({
    rounds: [
      {
        id: "round-1",
        number: 1,
        stage: "swiss",
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
  });
});

test("TournamentDisplay はシンプルな掲示用ペアリングを表示する", async () => {
  renderDisplay();

  expect(await screen.findByText("掲示テスト大会")).toBeInTheDocument();
  expect(screen.getByText("現在ラウンド: 第1回戦 / 全4回戦")).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getAllByText("プレイヤー1").length).toBeGreaterThan(0);
  });
  expect(screen.getAllByText("プレイヤー2").length).toBeGreaterThan(0);
  expect(screen.getByRole("tab", { name: "ペアリング" })).toHaveAttribute("aria-selected", "true");
  const timer = screen.getByLabelText("残り時間");
  expect(within(timer).getByText("残り時間")).toBeVisible();
  expect(timer).toHaveTextContent(/残り時間(?:時間切れ|\d{2}:\d{2})/);
});

test("トップカット進行中はSE内連番とブラケットを表示する", async () => {
  fetchRounds.mockResolvedValue({
    rounds: [
      {
        id: "round-5",
        number: 5,
        stage: "top_cut",
        status: "in_progress",
        matches: [
          {
            id: "match-se-1",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            result: null,
          },
        ],
      },
    ],
  });

  renderDisplay();

  expect(await screen.findByText("現在ラウンド: SE1回戦")).toBeInTheDocument();
  expect(screen.getByText("スイス: 全4回戦")).toBeInTheDocument();
  const bracket = screen.getByLabelText("トーナメント表");
  expect(within(bracket).getByRole("heading", { name: "SE1回戦" })).toBeInTheDocument();
  expect(within(bracket).getByText("プレイヤー1")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "順位表" }));
  expect(screen.getByLabelText("トーナメント表")).toBeInTheDocument();
});

test("トップカットの勝敗をスイス順位表へ加算しない", async () => {
  fetchTournament.mockResolvedValue({
    id: "t-display",
    title: "掲示テスト大会",
    status: "completed",
    roundTimeMinutes: 30,
    entries,
  });
  fetchRounds.mockResolvedValue({
    rounds: [
      {
        id: "round-1",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          {
            id: "match-swiss",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            result: "p1_win",
          },
        ],
      },
      {
        id: "round-2",
        number: 2,
        stage: "top_cut",
        status: "completed",
        matches: [
          {
            id: "match-se",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            result: "p2_win",
          },
        ],
      },
    ],
  });

  renderDisplay();
  await screen.findByText("現在ラウンド: SE1回戦");
  fireEvent.click(screen.getByRole("tab", { name: "順位表" }));

  const player1Row = screen.getByRole("row", { name: /プレイヤー1/ });
  const player2Row = screen.getByRole("row", { name: /プレイヤー2/ });
  expect(within(player1Row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
    "1",
    "プレイヤー1",
    "1",
    "0",
    "0",
    "3",
    "33.3%",
  ]);
  expect(within(player2Row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
    "2",
    "プレイヤー2",
    "0",
    "1",
    "0",
    "0",
    "100%",
  ]);
});
