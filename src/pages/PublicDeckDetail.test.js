import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchPublicDeck, setDeckPublication } from "../services/publicDecks";
import PublicDeckDetail from "./PublicDeckDetail";

const mockUseAuth = jest.fn();

jest.mock("../components/CardHoverPreview", () => ({ children }) => children);

jest.mock("../hooks/useDeckPreview", () => ({
  useDeckPreview: () => ({ previewUrl: "", isRendering: false, errorMessage: "" }),
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

function renderDetail(initialEntry = "/decks/saved:deck-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/decks/:id" element={<PublicDeckDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ authMode: "mock", isAdmin: false, user: null });
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
  expect(within(meta).getByText("メイン50 / サイド0")).toBeInTheDocument();
  expect(screen.getAllByText("メイン50 / サイド0")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "このデッキをコピー" })).toBeInTheDocument();
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
  expect(within(meta).getByText("メイン0 / サイド0")).toBeInTheDocument();
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
