import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchTournaments } from "../services/tournaments";
import PortalHome from "./PortalHome";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    authMode: "mock",
    isAuthenticated: true,
    user: { id: "user-1", name: "テストユーザー" },
  }),
}));

jest.mock("../services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(),
}));

jest.mock("../services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(),
}));

const registrationTournaments = Array.from({ length: 4 }, (_, index) => ({
  id: `registration-${index}`,
  title: `受付中大会${index + 1}`,
  status: "registration",
  startsAt: `2026-07-0${index + 2}T10:00:00.000Z`,
  venue: index === 0 ? "" : "東京カードホール",
  isOnline: index === 0,
  format: "swiss",
  regulation: { name: "スタンダード" },
  entryCount: index + 1,
  capacity: 16,
  entries: index === 0 ? [{ id: "entry-1", user: { id: "user-1", name: "テストユーザー" } }] : [],
}));

const inProgressTournaments = Array.from({ length: 3 }, (_, index) => ({
  id: `in-progress-${index}`,
  title: `進行中大会${index + 1}`,
  status: "in_progress",
  startsAt: `2026-07-1${index}T13:00:00.000Z`,
  venue: "大阪ショップ",
  isOnline: false,
  format: "swiss",
  regulation: { name: "スタンダード" },
  entryCount: index + 8,
  capacity: 32,
}));

beforeEach(() => {
  fetchTournaments.mockImplementation(({ status }) =>
    Promise.resolve({
      items: status === "registration" ? registrationTournaments : inProgressTournaments,
    })
  );
  fetchPublicDecks.mockResolvedValue({
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `deck-${index}`,
      title: `公開デッキ${index + 1}`,
      items: [
        {
          count: 3,
          card: {
            name: "ガンダム",
            sp_power_color1_name: index % 2 === 0 ? "青" : "赤",
          },
        },
      ],
      owner: { name: "投稿者" },
      publishedAt: `2026-07-0${index + 1}T10:00:00.000Z`,
    })),
  });
});

test("PortalHome は道具箱トップ構成で大会と公開デッキを最大5件表示する", async () => {
  render(
    <MemoryRouter initialEntries={["/?mobileLayout=ios"]}>
      <PortalHome />
    </MemoryRouter>
  );

  expect(screen.queryByText("Gundam War Portal")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("カード名で検索")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "あなたの大会" })).toBeInTheDocument();
    expect(screen.getAllByText("受付中大会1")).toHaveLength(2);
    expect(screen.getByText("公開デッキ1")).toBeInTheDocument();
  });

  expect(screen.getAllByText(/大会\d/)).toHaveLength(6);
  expect(screen.getAllByText(/公開デッキ\d/)).toHaveLength(5);
  expect(screen.getAllByRole("link", { name: "一覧へ" })[0]).toHaveAttribute(
    "href",
    "/tournaments?mobileLayout=ios"
  );
  expect(screen.getAllByLabelText("デッキ色: 青")).toHaveLength(3);
});

test("カード名検索は SearchForm と同じ name パラメータで遷移する", async () => {
  window.history.pushState({}, "", "/?mobileLayout=ios");

  render(
    <BrowserRouter>
      <PortalHome />
    </BrowserRouter>
  );

  fireEvent.change(screen.getByPlaceholderText("カード名で検索"), {
    target: { value: "ガンダム" },
  });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() => {
    expect(window.location.pathname).toBe("/search");
    expect(window.location.search).toContain("name=%E3%82%AC%E3%83%B3%E3%83%80%E3%83%A0");
    expect(window.location.search).toContain("mobileLayout=ios");
  });
});
