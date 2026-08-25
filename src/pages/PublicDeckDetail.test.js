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

test("詳細の枚数サマリはサイド0枚も明示する", async () => {
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
    publishedAt: "2026-08-01T00:00:00.000Z",
  });

  const { container } = renderDetail();

  expect(await screen.findByRole("heading", { name: "メインのみデッキ" })).toBeInTheDocument();
  expect(container.querySelector(".search-results-summary")).toHaveTextContent(
    "メイン50 / サイド0"
  );

  const previewHeader = screen.getByRole("heading", { name: "デッキ画像" }).parentElement;
  expect(within(previewHeader).getByText("メイン50 / サイド0")).toBeInTheDocument();
});
