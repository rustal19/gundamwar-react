import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchPublicDeck } from "../services/publicDecks";
import PublicDeckDetail from "./PublicDeckDetail";

jest.mock("../components/CardHoverPreview", () => ({ children }) => children);

jest.mock("../hooks/useDeckPreview", () => ({
  useDeckPreview: () => ({ previewUrl: "", isRendering: false, errorMessage: "" }),
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ authMode: "mock", isAdmin: false, user: null }),
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({ items: [], replaceDeck: jest.fn() }),
}));

jest.mock("../services/publicDecks", () => ({
  __esModule: true,
  fetchPublicDeck: jest.fn(),
  setDeckPublication: jest.fn(),
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/decks/deck-1"]}>
      <Routes>
        <Route path="/decks/:id" element={<PublicDeckDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("メタ情報とプロフィール・大会へのリンクを表示し、枚数サマリを重複させない", async () => {
  const publishedAt = "2026-08-01T12:34:00";
  fetchPublicDeck.mockResolvedValue({
    id: "deck-1",
    title: "メインのみデッキ",
    items: [
      {
        cardId: "main-1",
        count: 50,
        zone: "main",
        card: { cardId: "main-1", name: "メインカード", card_type_name: "UNIT" },
      },
    ],
    owner: { id: "owner-1", name: "投稿者" },
    format: "スタンダード",
    publishedAt,
    tournament: { id: "tournament-1", title: "夏季ガンダムウォー杯" },
  });

  const { container } = renderDetail();

  expect(await screen.findByRole("heading", { name: "メインのみデッキ" })).toBeInTheDocument();
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(meta).toBeInTheDocument();

  expect(within(meta).getByText("投稿者", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByRole("link", { name: "投稿者" })).toHaveAttribute(
    "href",
    "/users/owner-1"
  );
  expect(within(meta).getByText("フォーマット", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("スタンダード")).toBeInTheDocument();
  expect(within(meta).getByText("公開日", { selector: "dt" })).toBeInTheDocument();
  expect(
    within(meta).getByText(
      new Date(publishedAt).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    )
  ).toBeInTheDocument();
  expect(within(meta).getByText("大会名", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByRole("link", { name: "夏季ガンダムウォー杯" })).toHaveAttribute(
    "href",
    "/tournaments/tournament-1"
  );
  expect(within(meta).getByText("枚数", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("メイン50 / サイド0")).toBeInTheDocument();
  expect(screen.getAllByText("メイン50 / サイド0")).toHaveLength(1);
});

test("欠損している投稿者・フォーマット・公開日・大会名は行ごと表示しない", async () => {
  fetchPublicDeck.mockResolvedValue({
    id: "deck-1",
    title: "メタ情報なしデッキ",
    items: [],
    owner: { id: "", name: "名無し" },
    format: null,
    publishedAt: "",
    updatedAt: "2026-08-02T12:34:00",
    tournament: null,
  });

  const { container } = renderDetail();

  expect(await screen.findByRole("heading", { name: "メタ情報なしデッキ" })).toBeInTheDocument();
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(meta).toBeInTheDocument();

  expect(within(meta).queryByText("投稿者", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("フォーマット", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("公開日", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("大会名", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).getByText("枚数", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("メイン0 / サイド0")).toBeInTheDocument();
});
