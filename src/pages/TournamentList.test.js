import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fetchTournaments } from "../services/tournaments";
import TournamentList from "./TournamentList";

const mockOrganizer = { id: "organizer-1", role: "organizer" };

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    isOrganizer: true,
    user: mockOrganizer,
  }),
}));

jest.mock("../services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(),
}));

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

  render(
    <MemoryRouter initialEntries={["/tournaments"]}>
      <TournamentList />
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(fetchTournaments).toHaveBeenCalledWith({
      status: "",
      page: 1,
      authMode: "mock",
      user: mockOrganizer,
    })
  );
  expect(screen.getByText("下書き")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "作成中の大会" })).toHaveAttribute(
    "href",
    "/tournaments/draft-1/manage"
  );
});
