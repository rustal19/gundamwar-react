import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeckBuilder from "./DeckBuilder";

let mockDeckState;

jest.mock("../components/CompactDeckSearchForm", () => () => null);
jest.mock("../components/DeckSearchResults", () => () => null);
jest.mock("../components/CardImage", () => () => null);
jest.mock("../components/BasicGAddDialog", () => () => null);
jest.mock("../components/DeckExportDialog", () => () => null);
jest.mock("../components/DeckLoadDialog", () => () => null);
jest.mock("../components/DeckSaveDialog", () => () => null);

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => mockDeckState,
}));

jest.mock("../hooks/useSavedDecks", () => ({
  useSavedDecks: () => ({
    savedDecks: [],
    isLoading: false,
    isSaving: false,
    error: "",
    saveDeck: jest.fn(),
    removeDeck: jest.fn(),
    setPublication: jest.fn(),
  }),
}));

beforeEach(() => {
  const mainItem = {
    cardId: "main-1",
    count: 50,
    zone: "main",
    card: { cardId: "main-1", name: "メインカード", card_type_name: "UNIT" },
  };
  const sideItem = {
    cardId: "side-1",
    count: 10,
    zone: "side",
    card: { cardId: "side-1", name: "サイドカード", card_type_name: "UNIT" },
  };
  mockDeckState = {
    items: [mainItem, sideItem],
    mainItems: [mainItem],
    sideItems: [sideItem],
    mainCount: 50,
    sideCount: 10,
    addCard: jest.fn(),
    setCardCount: jest.fn(),
    removeCard: jest.fn(),
    moveCard: jest.fn(),
    clearDeck: jest.fn(),
    replaceDeck: jest.fn(),
  };
});

test("デッキ構築の枚数サマリにメインとサイドを表示する", () => {
  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  expect(screen.getByText("メイン 50/50 ・ サイド 10/10")).toBeInTheDocument();
});
