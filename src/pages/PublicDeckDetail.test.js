import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchPublicDeck, setDeckPublication } from "../services/publicDecks";
import PublicDeckDetail from "./PublicDeckDetail";

const mockUseAuth = jest.fn();
const mockUseDeckPreview = jest.fn();

jest.mock("../hooks/useDeckPreview", () => ({
  useDeckPreview: (options) => mockUseDeckPreview(options),
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({ items: [], replaceDeck: jest.fn() }),
}));

jest.mock("../services/publicDecks", () => ({
  ...jest.requireActual("../services/publicDecks"),
  fetchPublicDeck: jest.fn(),
  setDeckPublication: jest.fn(),
}));

function renderDetail(initialEntry = "/decks/saved:deck-1", props = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/decks/:id" element={<PublicDeckDetail {...props} />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authMode: "mock", isAdmin: false, user: null });
  mockUseDeckPreview.mockReturnValue({ previewUrl: "", isRendering: false, errorMessage: "" });
  window.confirm = jest.fn(() => true);
});

test("大会デッキに提出者・開催日・大会名・順位・参加人数を表示する", async () => {
  const startsAt = "2026-08-01T12:34:00";
  fetchPublicDeck.mockResolvedValue({
    id: "entry:entry-1",
    sourceType: "tournament",
    sourceId: "entry-1",
    title: "投稿者の大会デッキ",
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
    publishedAt: "2026-08-02T00:00:00",
    finalRank: 2,
    participantCount: 32,
    tournament: {
      id: "tournament-1",
      title: "夏季ガンダムウォー杯",
      startsAt,
    },
  });

  const { container } = renderDetail("/decks/entry:entry-1");

  expect(await screen.findByRole("heading", { name: "投稿者の大会デッキ" })).toBeInTheDocument();
  expect(fetchPublicDeck).toHaveBeenCalledWith("entry:entry-1", { authMode: "mock" });
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(meta).toBeInTheDocument();

  expect(within(meta).getByText("提出者", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByRole("link", { name: "投稿者" })).toHaveAttribute(
    "href",
    "/users/owner-1"
  );
  expect(within(meta).getByText("フォーマット", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("スタンダード")).toBeInTheDocument();
  expect(within(meta).getByText("開催日", { selector: "dt" })).toBeInTheDocument();
  expect(
    within(meta).getByText(
      new Date(startsAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    )
  ).toBeInTheDocument();
  expect(meta).not.toHaveTextContent("12:34");
  expect(within(meta).getByText("大会名", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByRole("link", { name: "夏季ガンダムウォー杯" })).toHaveAttribute(
    "href",
    "/tournaments/tournament-1"
  );
  expect(within(meta).getByText("順位", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("2位")).toBeInTheDocument();
  expect(within(meta).getByText("参加人数", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("32人")).toBeInTheDocument();
  expect(within(meta).getByText("枚数", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("メイン50枚 / サイド0枚")).toBeInTheDocument();
  expect(screen.getAllByText("メイン50枚 / サイド0枚")).toHaveLength(1);
  const cardPreviewButton = screen.getByRole("button", { name: "メインカード" });
  expect(cardPreviewButton).toHaveClass("card-hover-preview-trigger");
  fireEvent.focus(cardPreviewButton);
  expect(screen.getByRole("img", { name: "メインカード", hidden: true })).toBeInTheDocument();
  fireEvent.blur(cardPreviewButton);
  expect(screen.queryByRole("img", { name: "メインカード", hidden: true })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "このデッキをコピー" })).toBeInTheDocument();
});

test("デッキ行に列見出しを置き、コンパクト表示では枚数とカード番号の行内ラベルを持つ", async () => {
  fetchPublicDeck.mockResolvedValue({
    id: "saved:labels",
    sourceType: "saved",
    sourceId: "labels",
    title: "列ラベル確認デッキ",
    items: [
      {
        cardId: "unit-1",
        count: 3,
        zone: "main",
        card: {
          cardId: "unit-1",
          name: "ラベル確認カード",
          card_type_name: "UNIT",
          cardNumber1: "U",
          cardNumber2: "123",
        },
      },
    ],
  });

  const { container } = renderDetail("/decks/saved:labels", { compact: true });

  expect(await screen.findByRole("heading", { name: "列ラベル確認デッキ" })).toBeInTheDocument();
  const cardTable = screen.getByRole("table", { name: "UNITカード一覧" });
  expect(
    within(cardTable).getAllByRole("columnheader").map((header) => header.textContent)
  ).toEqual(["枚数", "カード番号", "カード名"]);
  const cardRow = within(cardTable).getAllByRole("row")[1];
  expect(within(cardRow).getByText("枚数:")).toHaveClass("public-deck-cell-label");
  expect(within(cardRow).getByText("カード番号:")).toHaveClass("public-deck-cell-label");
  expect(within(cardRow).getByText("3枚")).toBeInTheDocument();
  expect(within(cardRow).getByText("U-123")).toBeInTheDocument();
  const cardPreviewButton = within(cardRow).getByRole("button", { name: "ラベル確認カード" });
  expect(cardPreviewButton).toHaveClass("card-hover-preview-trigger");
  fireEvent.click(cardPreviewButton);
  expect(screen.getByRole("dialog", { name: "ラベル確認カード の画像" })).toBeInTheDocument();
  expect(container.querySelector(".public-deck-detail")).toHaveClass("compact");
});

test("デッキ画像に原寸表示の可視案内とリンクを表示する", async () => {
  const previewUrl = "data:image/png;base64,deck-preview";
  mockUseDeckPreview.mockReturnValue({ previewUrl, isRendering: false, errorMessage: "" });
  fetchPublicDeck.mockResolvedValue({
    id: "saved:preview",
    sourceType: "saved",
    sourceId: "preview",
    title: "画像確認デッキ",
    items: [],
  });

  renderDetail("/decks/saved:preview");

  expect(await screen.findByRole("heading", { name: "画像確認デッキ" })).toBeInTheDocument();
  expect(screen.getByText("画像を選択すると原寸で表示します。")).toHaveClass(
    "public-deck-preview-help"
  );
  const previewLink = screen.getByRole("link", { name: "デッキ画像を原寸表示" });
  expect(previewLink).toHaveClass("public-deck-preview-frame");
  expect(previewLink).toHaveAttribute("href", previewUrl);
  expect(previewLink).toHaveAttribute("target", "_blank");
  expect(within(previewLink).getByRole("img", { name: "画像確認デッキ のデッキ画像" })).toHaveClass(
    "public-deck-preview-image"
  );
});

test("保存デッキには旧データの大会参照が残っていても大会情報を表示しない", async () => {
  fetchPublicDeck.mockResolvedValue({
    id: "saved:deck-1",
    sourceType: "saved",
    sourceId: "deck-1",
    title: "メタ情報なしデッキ",
    items: [],
    owner: { id: "", name: "名無し" },
    format: null,
    publishedAt: "",
    updatedAt: "",
    finalRank: 1,
    participantCount: 64,
    tournament: {
      id: "stale-tournament",
      title: "紐付けてはいけない大会",
      startsAt: "2026-08-01T12:34:00",
    },
  });

  const { container } = renderDetail();

  expect(await screen.findByRole("heading", { name: "メタ情報なしデッキ" })).toBeInTheDocument();
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(meta).toBeInTheDocument();

  expect(within(meta).queryByText("投稿者", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("フォーマット", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("公開日", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("大会名", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("順位", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("参加人数", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("開催日", { selector: "dt" })).not.toBeInTheDocument();
  expect(within(meta).queryByText("紐付けてはいけない大会")).not.toBeInTheDocument();
  expect(within(meta).getByText("枚数", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("メイン0枚 / サイド0枚")).toBeInTheDocument();
});

test("公開日が無い場合は更新日の日付だけを表示する", async () => {
  const updatedAt = "2026-08-02T12:34:00";
  fetchPublicDeck.mockResolvedValue({
    id: "saved:42",
    sourceType: "saved",
    sourceId: "42",
    title: "更新日フォールバックデッキ",
    items: [],
    owner: { id: "", name: "名無し" },
    format: null,
    publishedAt: "",
    updatedAt,
    tournament: null,
  });

  const { container } = renderDetail("/decks/42");

  expect(
    await screen.findByRole("heading", { name: "更新日フォールバックデッキ" })
  ).toBeInTheDocument();
  expect(fetchPublicDeck).toHaveBeenCalledWith("42", { authMode: "mock" });
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(meta).toBeInTheDocument();
  expect(within(meta).getByText("公開日", { selector: "dt" })).toBeInTheDocument();
  expect(
    within(meta).getByText(
      new Date(updatedAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    )
  ).toBeInTheDocument();
  expect(meta).not.toHaveTextContent("12:34");
});

test("IDのない手動エントリーも提出者名を表示し、大会デッキには管理UIを出さない", async () => {
  mockUseAuth.mockReturnValue({
    authMode: "mock",
    isAdmin: true,
    user: { id: "admin-1", role: "admin" },
  });
  fetchPublicDeck.mockResolvedValue({
    id: "entry:manual-1",
    sourceType: "tournament",
    sourceId: "manual-1",
    title: "ゲスト参加者の大会デッキ",
    items: [],
    owner: { id: "", name: "ゲスト参加者" },
    format: "スタンダード",
    finalRank: 3,
    participantCount: 16,
    tournament: {
      id: "tournament-1",
      title: "公開大会",
      startsAt: "2026-08-01T12:34:00",
    },
  });

  const { container } = renderDetail("/decks/entry:manual-1");

  expect(
    await screen.findByRole("heading", { name: "ゲスト参加者の大会デッキ" })
  ).toBeInTheDocument();
  const meta = container.querySelector(".public-deck-detail-meta");
  expect(within(meta).getByText("提出者", { selector: "dt" })).toBeInTheDocument();
  expect(within(meta).getByText("ゲスト参加者")).toBeInTheDocument();
  expect(within(meta).queryByRole("link", { name: "ゲスト参加者" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "このデッキをコピー" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "非公開にする(admin)" })).not.toBeInTheDocument();
});

test("管理者は保存デッキだけを非公開化でき、接頭辞を除いた保存IDを渡す", async () => {
  const admin = { id: "admin-1", role: "admin" };
  mockUseAuth.mockReturnValue({ authMode: "mock", isAdmin: true, user: admin });
  fetchPublicDeck.mockResolvedValue({
    id: "saved:42",
    sourceType: "saved",
    sourceId: "42",
    title: "管理対象の保存デッキ",
    items: [],
    owner: { id: "owner-1", name: "投稿者" },
    format: "スタンダード",
    description: "公開中",
  });
  setDeckPublication.mockResolvedValue({ id: "42", isPublic: false });

  renderDetail("/decks/saved:42");

  fireEvent.click(
    await screen.findByRole("button", { name: "非公開にする(admin)" })
  );

  await waitFor(() =>
    expect(setDeckPublication).toHaveBeenCalledWith({
      authMode: "mock",
      user: admin,
      deckId: "42",
      isPublic: false,
      description: "公開中",
      format: "スタンダード",
    })
  );
});
