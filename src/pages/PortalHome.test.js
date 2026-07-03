import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fetchPublicDecks } from "../services/publicDecks";
import { fetchTournaments } from "../services/tournaments";
import PortalHome from "./PortalHome";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ authMode: "mock" }),
}));

jest.mock("../services/tournaments", () => ({
  __esModule: true,
  fetchTournaments: jest.fn(),
}));

jest.mock("../services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDecks: jest.fn(),
}));

beforeEach(() => {
  fetchTournaments.mockImplementation(({ status }) =>
    Promise.resolve({
      items: Array.from({ length: status === "registration" ? 4 : 3 }, (_, index) => ({
        id: `${status}-${index}`,
        title: `${status === "registration" ? "受付中" : "進行中"}大会${index + 1}`,
        description: "大会説明",
        status,
        startsAt: `2026-07-0${index + 1}T10:00:00.000Z`,
        entryCount: index,
        capacity: 16,
      })),
    })
  );
  fetchPublicDecks.mockResolvedValue({
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `deck-${index}`,
      title: `公開デッキ${index + 1}`,
      description: "デッキ説明",
      items: [{ count: 50 }],
      owner: { name: "テストユーザー" },
      publishedAt: `2026-07-0${index + 1}T10:00:00.000Z`,
    })),
  });
});

test("PortalHome は大会と公開デッキを最大5件表示し mobileLayout をリンクに引き継ぐ", async () => {
  render(
    <MemoryRouter initialEntries={["/?mobileLayout=ios"]}>
      <PortalHome />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText("受付中大会1")).toBeInTheDocument();
    expect(screen.getByText("公開デッキ1")).toBeInTheDocument();
  });

  expect(screen.getAllByText(/大会説明/)).toHaveLength(5);
  expect(screen.getAllByText(/デッキ説明/)).toHaveLength(5);
  expect(screen.getByRole("link", { name: "カード検索 条件を指定してカードを探す" })).toHaveAttribute(
    "href",
    "/search?mobileLayout=ios"
  );
  expect(screen.getAllByRole("link", { name: "もっと見る" })[0]).toHaveAttribute(
    "href",
    "/tournaments?mobileLayout=ios"
  );
});
