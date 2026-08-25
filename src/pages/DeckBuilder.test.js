import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeckBuilder from "./DeckBuilder";

let mockDeckState;
let mockAuthState;
let mockSavedDecksState;

jest.mock("../components/CompactDeckSearchForm", () => (props) => (
  <div>
    <span data-testid="compact-format-name">{props.formatName || "指定なし"}</span>
    <button type="button" onClick={() => props.onFormatChange("関西クラシック")}>
      関西クラシックを選択
    </button>
    <button type="button" onClick={() => props.onFormatChange("関西ライジング")}>
      関西ライジングを選択
    </button>
    <button type="button" onClick={() => props.onFormatChange("")}>
      指定なしを選択
    </button>
  </div>
));
jest.mock("../components/DeckSearchResults", () => (props) => (
  <span data-testid="results-format-name">{props.formatName || "指定なし"}</span>
));
jest.mock("../components/CardImage", () => () => null);
jest.mock("../components/BasicGAddDialog", () => () => null);
jest.mock("../components/DeckExportDialog", () => () => null);
jest.mock("../components/DeckLoadDialog", () => (props) =>
  props.open ? (
    <div>
      <button type="button" onClick={() => props.onLoad(mockSavedDecksState.savedDecks[0])}>
        テストデッキを読み込む
      </button>
      <button
        type="button"
        onClick={() =>
          props.onPublicationChange({
            deckId: mockSavedDecksState.savedDecks[0].id,
            isPublic: true,
            description: "公開説明",
            format: "関西ライジング",
          })
        }
      >
        公開設定を更新する
      </button>
    </div>
  ) : null
);
jest.mock("../components/DeckSaveDialog", () => (props) =>
  props.open ? (
    <div>
      <button type="button" onClick={() => props.onSaveAs("新規保存デッキ")}>
        別名保存を実行
      </button>
      <button type="button" onClick={props.onOverwrite} disabled={!props.selectedDeck}>
        上書き保存を実行
      </button>
    </div>
  ) : null
);

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => mockDeckState,
}));

jest.mock("../hooks/useSavedDecks", () => ({
  useSavedDecks: () => mockSavedDecksState,
}));

function createValidSavedDeckItems() {
  return Array.from({ length: 17 }, (_, index) => ({
    cardId: `saved-card-${index + 1}`,
    count: index === 16 ? 2 : 3,
    zone: "main",
    card: {
      cardId: `saved-card-${index + 1}`,
      name: `保存カード${index + 1}`,
      card_type_name: "UNIT",
    },
  }));
}

function renderDeckBuilder() {
  return render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );
}

function loadFirstSavedDeck() {
  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "テストデッキを読み込む" }));
}

beforeEach(() => {
  mockAuthState = { isAuthenticated: false };
  mockSavedDecksState = {
    savedDecks: [],
    isLoading: false,
    isSaving: false,
    error: "",
    saveDeck: jest.fn(),
    removeDeck: jest.fn(),
    setPublication: jest.fn(),
  };
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

test("未保存デッキは保存後に公開できることを表示する", () => {
  mockAuthState = { isAuthenticated: true };
  renderDeckBuilder();

  const publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(within(publicationPanel).getByText("未保存")).toBeInTheDocument();
  expect(
    within(publicationPanel).getByText("デッキを保存してから公開できます。")
  ).toBeInTheDocument();
  expect(within(publicationPanel).getByRole("button", { name: "公開する" })).toBeDisabled();
});

test("保存済みデッキは構築画面から公開でき、公開後に詳細リンクを表示する", async () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "保存済みデッキ",
    items: createValidSavedDeckItems(),
    format: "スタンダード",
    description: "公開前の説明",
    isPublic: false,
  };
  mockSavedDecksState.savedDecks = [savedDeck];
  mockSavedDecksState.setPublication.mockImplementation(async (settings) => {
    const updatedDeck = {
      ...savedDeck,
      isPublic: settings.isPublic,
      description: settings.description,
      format: settings.format,
    };
    mockSavedDecksState.savedDecks = [updatedDeck];
    return updatedDeck;
  });

  renderDeckBuilder();
  loadFirstSavedDeck();

  let publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(within(publicationPanel).getByText("非公開")).toBeInTheDocument();
  const publishButton = within(publicationPanel).getByRole("button", { name: "公開する" });
  expect(publishButton).toBeEnabled();
  fireEvent.click(publishButton);

  await waitFor(() => {
    expect(mockSavedDecksState.setPublication).toHaveBeenCalledWith({
      deckId: "deck-1",
      isPublic: true,
      description: "公開前の説明",
      format: "スタンダード",
    });
  });
  publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(await within(publicationPanel).findByText("公開中")).toBeInTheDocument();
  expect(within(publicationPanel).getByRole("link", { name: "公開デッキを見る" })).toHaveAttribute(
    "href",
    "/decks/saved:deck-1"
  );
});

test("公開済みデッキは構築画面から非公開に切り替えられる", async () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "公開済みデッキ",
    items: createValidSavedDeckItems(),
    format: "スタンダード",
    description: "公開説明",
    isPublic: true,
  };
  mockSavedDecksState.savedDecks = [savedDeck];
  mockSavedDecksState.setPublication.mockResolvedValue({
    ...savedDeck,
    isPublic: false,
  });

  renderDeckBuilder();
  loadFirstSavedDeck();

  const publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(within(publicationPanel).getByText("公開中")).toBeInTheDocument();
  expect(within(publicationPanel).getByRole("link", { name: "公開デッキを見る" })).toHaveAttribute(
    "href",
    "/decks/saved:deck-1"
  );
  fireEvent.click(within(publicationPanel).getByRole("button", { name: "非公開にする" }));

  await waitFor(() => {
    expect(mockSavedDecksState.setPublication).toHaveBeenCalledWith({
      deckId: "deck-1",
      isPublic: false,
      description: "公開説明",
      format: "スタンダード",
    });
  });
});

test("フォーマット未選択の保存済みデッキは公開できない理由を表示する", () => {
  mockAuthState = { isAuthenticated: true };
  mockSavedDecksState.savedDecks = [
    {
      id: "deck-1",
      title: "フォーマット未選択デッキ",
      items: createValidSavedDeckItems(),
      format: null,
      description: "",
      isPublic: false,
    },
  ];

  renderDeckBuilder();
  loadFirstSavedDeck();

  const publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(
    within(publicationPanel).getByText("公開するにはフォーマットを選択してください。")
  ).toBeInTheDocument();
  expect(within(publicationPanel).getByRole("button", { name: "公開する" })).toBeDisabled();
});

test("保存済み内容がレギュレーション違反なら理由を事前表示して公開を無効にする", () => {
  mockAuthState = { isAuthenticated: true };
  const violatingItems = createValidSavedDeckItems();
  violatingItems[0] = {
    ...violatingItems[0],
    cardId: "101020126",
    card: {
      ...violatingItems[0].card,
      cardId: "101020126",
      name: "禁止対象カード",
    },
  };
  mockSavedDecksState.savedDecks = [
    {
      id: "deck-1",
      title: "違反デッキ",
      items: violatingItems,
      format: "関西クラシック",
      description: "",
      isPublic: false,
    },
  ];

  renderDeckBuilder();
  loadFirstSavedDeck();

  const publicationPanel = screen.getByRole("region", { name: "デッキ公開設定" });
  expect(
    within(publicationPanel).getByText(
      "「関西クラシック」のレギュレーションに適合していないため公開できません。"
    )
  ).toBeInTheDocument();
  expect(
    within(publicationPanel).getByText(
      "禁止対象カードは禁止カードです。デッキに入れることはできません。"
    )
  ).toBeInTheDocument();
  expect(within(publicationPanel).getByRole("button", { name: "公開する" })).toBeDisabled();
  expect(mockSavedDecksState.setPublication).not.toHaveBeenCalled();
});

test("選択したフォーマットを新規保存へ渡す", async () => {
  mockAuthState = { isAuthenticated: true };
  mockSavedDecksState.saveDeck.mockResolvedValue({
    id: "saved-1",
    title: "新規保存デッキ",
    format: "関西クラシック",
  });

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "関西クラシックを選択" }));
  expect(screen.getByTestId("compact-format-name")).toHaveTextContent("関西クラシック");
  expect(screen.getByTestId("results-format-name")).toHaveTextContent("関西クラシック");

  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  fireEvent.click(screen.getByRole("button", { name: "別名保存を実行" }));

  await waitFor(() => {
    expect(mockSavedDecksState.saveDeck).toHaveBeenCalledWith({
      deckId: "",
      title: "新規保存デッキ",
      items: mockDeckState.items,
      format: "関西クラシック",
    });
  });
});

test("保存デッキのフォーマットを読み込み、検索フォームと結果へ復元する", () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "ライジングデッキ",
    items: mockDeckState.items,
    format: "関西ライジング",
  };
  mockSavedDecksState.savedDecks = [savedDeck];

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "テストデッキを読み込む" }));

  expect(mockDeckState.replaceDeck).toHaveBeenCalledWith(savedDeck.items);
  expect(screen.getByTestId("compact-format-name")).toHaveTextContent("関西ライジング");
  expect(screen.getByTestId("results-format-name")).toHaveTextContent("関西ライジング");
});

test("上書き保存でも現在選択中のフォーマットを渡す", async () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "保存済みデッキ",
    items: mockDeckState.items,
    format: "関西クラシック",
  };
  mockSavedDecksState.savedDecks = [savedDeck];
  mockSavedDecksState.saveDeck.mockResolvedValue(savedDeck);

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "テストデッキを読み込む" }));
  fireEvent.click(screen.getByRole("button", { name: "関西ライジングを選択" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  fireEvent.click(screen.getByRole("button", { name: "上書き保存を実行" }));

  await waitFor(() => {
    expect(mockSavedDecksState.saveDeck).toHaveBeenCalledWith({
      deckId: "deck-1",
      title: "保存済みデッキ",
      items: mockDeckState.items,
      format: "関西ライジング",
    });
  });
});

test("選択フォーマットのレギュレーションで現在のデッキを検証する", () => {
  mockDeckState.items[0] = {
    ...mockDeckState.items[0],
    cardId: "101020126",
    card: {
      ...mockDeckState.items[0].card,
      cardId: "101020126",
      name: "禁止対象カード",
    },
  };

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "関西クラシックを選択" }));

  expect(
    screen.getByText("禁止対象カードは禁止カードです。デッキに入れることはできません。")
  ).toBeInTheDocument();
});

test("公開設定にもフォーマットを渡し、選択中デッキへ反映する", async () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "公開デッキ",
    items: mockDeckState.items,
    format: "関西クラシック",
  };
  mockSavedDecksState.savedDecks = [savedDeck];
  mockSavedDecksState.setPublication.mockResolvedValue({
    ...savedDeck,
    isPublic: true,
    format: "関西ライジング",
  });

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "テストデッキを読み込む" }));
  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "公開設定を更新する" }));

  await waitFor(() => {
    expect(mockSavedDecksState.setPublication).toHaveBeenCalledWith({
      deckId: "deck-1",
      isPublic: true,
      description: "公開説明",
      format: "関西ライジング",
    });
  });
  await waitFor(() => {
    expect(screen.getByTestId("compact-format-name")).toHaveTextContent("関西ライジング");
  });
});

test("公開中デッキはフォーマット未選択で上書きしない", () => {
  mockAuthState = { isAuthenticated: true };
  const savedDeck = {
    id: "deck-1",
    title: "公開中デッキ",
    items: mockDeckState.items,
    format: "関西クラシック",
    isPublic: true,
  };
  mockSavedDecksState.savedDecks = [savedDeck];

  render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckBuilder />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: "読み込み" }));
  fireEvent.click(screen.getByRole("button", { name: "テストデッキを読み込む" }));
  fireEvent.click(screen.getByRole("button", { name: "指定なしを選択" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  fireEvent.click(screen.getByRole("button", { name: "上書き保存を実行" }));

  expect(mockSavedDecksState.saveDeck).not.toHaveBeenCalled();
  expect(
    screen.getByText("公開中のデッキを上書きするにはフォーマットを選択してください。")
  ).toBeInTheDocument();
});
