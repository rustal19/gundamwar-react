import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  KANSAI_CLASSIC_FORMAT_NAME,
  OTHER_FORMAT_NAMES,
  TENSAKU_FORMAT_NAMES,
} from "../data/formatGroups";
import { OTHER_FORMAT_NAME } from "../data/formats";
import { searchCardsByName } from "../services/cardSearch";
import { fetchPublicDecks } from "../services/publicDecks";
import PublicDecks from "./PublicDecks";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ authMode: "mock" }),
}));

jest.mock("../services/publicDecks", () => ({
  ...jest.requireActual("../services/publicDecks"),
  fetchPublicDecks: jest.fn(),
}));

jest.mock("../services/cardSearch", () => ({
  searchCardsByName: jest.fn(),
  resolveCardReference: jest.fn(),
}));

function expectedFetch(overrides = {}) {
  return {
    page: 1,
    query: "",
    format: "",
    cardId: "",
    playerName: "",
    tournamentName: "",
    authMode: "mock",
    ...overrides,
  };
}

function createDecks(start, count) {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;
    return {
      id: `saved:deck-${number}`,
      sourceType: "saved",
      sourceId: `deck-${number}`,
      title: `公開デッキ${number}`,
      description: `説明${number}`,
      format: "スタンダード",
      items: [
        {
          cardId: `card-${number}`,
          count: 3,
          card: { name: `カード${number}`, sp_power_color1_name: "青" },
        },
      ],
      owner: { id: "owner-1", name: "投稿者" },
      publishedAt: `2026-08-${String(number).padStart(2, "0")}T00:00:00.000Z`,
    };
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderPublicDecks(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PublicDecks />
      <LocationProbe />
    </MemoryRouter>
  );
}

function getLocationParams() {
  return new URLSearchParams(screen.getByTestId("location-search").textContent);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  searchCardsByName.mockResolvedValue({ cards: [], total: 0, isTruncated: false });
});

test("20件以下の公開デッキをすべて表示し、不要なページャーを出さない", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: createDecks(1, 7),
    total: 7,
    page: 1,
    pageSize: 20,
  });

  const { container } = render(
    <MemoryRouter initialEntries={["/decks"]}>
      <PublicDecks />
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(7));
  expect(container.querySelector(".pagination")).not.toBeInTheDocument();

  const firstDeck = screen.getAllByRole("article")[0];
  expect(within(firstDeck).getByRole("link", { name: "公開デッキ1" })).toHaveAttribute(
    "href",
    "/decks/saved:deck-1"
  );
  expect(within(firstDeck).getByText("保存デッキ")).toBeInTheDocument();
  expect(within(firstDeck).getByText("スタンダード")).toBeInTheDocument();
});

test("保存デッキと大会デッキをバッジで区別し、大会メタと接頭辞付きリンクを表示する", async () => {
  const savedDeck = createDecks(1, 1)[0];
  const tournamentDeck = {
    ...createDecks(2, 1)[0],
    id: "entry:entry-2",
    sourceType: "tournament",
    sourceId: "entry-2",
    title: "大会プレイヤーの大会デッキ",
    finalRank: 2,
    participantCount: 32,
    tournament: {
      id: "tournament-2",
      title: "夏季ガンダムウォー杯",
      startsAt: "2026-08-02T00:00:00.000Z",
    },
  };
  fetchPublicDecks.mockResolvedValue({
    items: [savedDeck, tournamentDeck],
    total: 2,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks("/decks");

  const deckCards = await screen.findAllByRole("article");
  expect(within(deckCards[0]).getByText("保存デッキ")).toBeInTheDocument();
  expect(within(deckCards[1]).getByText("大会デッキ")).toBeInTheDocument();
  expect(
    within(deckCards[1]).getByRole("link", { name: "大会プレイヤーの大会デッキ" })
  ).toHaveAttribute("href", "/decks/entry:entry-2");
  expect(
    within(deckCards[1]).getByRole("link", { name: "夏季ガンダムウォー杯" })
  ).toHaveAttribute("href", "/tournaments/tournament-2");
  expect(within(deckCards[1]).getByText("2位")).toBeInTheDocument();
  expect(within(deckCards[1]).getByText("参加32人")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("デッキ名・説明などを検索"))
    .toBeInTheDocument();
  expect(
    screen.getByText(
      "大会名は大会デッキのみを対象に検索します。保存デッキは大会情報を持たないため対象外です。"
    )
  ).toBeInTheDocument();
});

test("各公開デッキのメインとサイドの枚数を分けて表示する", async () => {
  const [mainOnly, withSide, empty] = createDecks(1, 3);
  mainOnly.items = [{ cardId: "main-1", count: 50 }];
  withSide.items = [
    { cardId: "main-2", count: 50, zone: "main" },
    { cardId: "side-2", count: 10, zone: "side" },
  ];
  empty.items = [];
  fetchPublicDecks.mockResolvedValue({
    items: [mainOnly, withSide, empty],
    total: 3,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks("/decks");

  const deckCards = await screen.findAllByRole("article");
  expect(within(deckCards[0]).getByText("メイン50 / サイド0")).toBeInTheDocument();
  expect(within(deckCards[1]).getByText("メイン50 / サイド10")).toBeInTheDocument();
  expect(within(deckCards[2]).getByText("メイン0 / サイド0")).toBeInTheDocument();
});

test("採用カード・プレイヤー名・大会名を候補選択からURLと取得条件へ反映する", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  searchCardsByName.mockResolvedValue({
    cards: [{ cardId: "100000005", name: "検索カード" }],
    total: 1,
    isTruncated: false,
  });

  renderPublicDecks("/decks?format=スタンダード&page=4");
  await waitFor(() => expect(fetchPublicDecks).toHaveBeenCalled());

  fireEvent.change(screen.getByLabelText("キーワード"), {
    target: { value: "青単" },
  });
  fireEvent.change(screen.getByLabelText("プレイヤー名"), {
    target: { value: "  アムロ  " },
  });
  fireEvent.change(screen.getByLabelText("大会名"), {
    target: { value: "  春の大会  " },
  });
  fireEvent.change(screen.getByLabelText("採用カードを検索"), {
    target: { value: "検索カード" },
  });
  fireEvent.click(screen.getByRole("button", { name: "採用カードの候補を検索" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "検索カード (100000005)" })
  );
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "青単",
      format: "スタンダード",
      cardId: "100000005",
      playerName: "アムロ",
      tournamentName: "春の大会",
    }))
  );
  expect(getLocationParams().get("query")).toBe("青単");
  expect(getLocationParams().get("format")).toBe("スタンダード");
  expect(getLocationParams().get("cardId")).toBe("100000005");
  expect(getLocationParams().get("cardName")).toBe("検索カード");
  expect(getLocationParams().get("playerName")).toBe("アムロ");
  expect(getLocationParams().get("tournamentName")).toBe("春の大会");
  expect(getLocationParams().get("page")).toBe("1");
});

test("追加検索条件をURLから復元し、削除後は条件なしの空状態へ戻せる", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 20,
  });

  renderPublicDecks(
    "/decks?query=赤単&cardId=100000006&cardName=復元カード&playerName=シャア&tournamentName=夏季杯&page=2"
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith(expectedFetch({
      page: 2,
      query: "赤単",
      cardId: "100000006",
      playerName: "シャア",
      tournamentName: "夏季杯",
    }))
  );
  expect(screen.getByLabelText("キーワード")).toHaveValue("赤単");
  expect(screen.getByLabelText("プレイヤー名")).toHaveValue("シャア");
  expect(screen.getByLabelText("大会名")).toHaveValue("夏季杯");
  expect(screen.getByText("復元カード (100000006)")).toBeInTheDocument();
  expect(await screen.findByText("検索結果がありません。")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("キーワード"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("プレイヤー名"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("大会名"), { target: { value: "" } });
  fireEvent.click(
    screen.getByRole("button", { name: "復元カード (100000006) を削除" })
  );
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch())
  );
  expect(getLocationParams().has("query")).toBe(false);
  expect(getLocationParams().has("cardId")).toBe(false);
  expect(getLocationParams().has("cardName")).toBe(false);
  expect(getLocationParams().has("playerName")).toBe(false);
  expect(getLocationParams().has("tournamentName")).toBe(false);
  expect(getLocationParams().get("page")).toBe("1");
  expect(await screen.findByText("公開デッキはありません。")).toBeInTheDocument();
});

test("20件を超える公開デッキは条件を維持したまま次ページへ移動できる", async () => {
  fetchPublicDecks.mockImplementation(({ page }) =>
    Promise.resolve({
      items: page === 2 ? createDecks(21, 5) : createDecks(1, 20),
      total: 25,
      page,
      pageSize: 20,
    })
  );

  render(
    <MemoryRouter
      initialEntries={[
        "/decks?query=Blue&format=スタンダード&cardId=100000001&cardName=採用カード&playerName=投稿者&tournamentName=公開大会&page=1",
      ]}
    >
      <PublicDecks />
    </MemoryRouter>
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith(expectedFetch({
      page: 1,
      query: "Blue",
      format: "スタンダード",
      cardId: "100000001",
      playerName: "投稿者",
      tournamentName: "公開大会",
    }))
  );
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(20));
  expect(screen.getAllByText("1 / 2")).toHaveLength(2);

  fireEvent.click(screen.getAllByRole("button", { name: "次へ" })[0]);

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 2,
      query: "Blue",
      format: "スタンダード",
      cardId: "100000001",
      playerName: "投稿者",
      tournamentName: "公開大会",
    }))
  );
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(5));
  expect(screen.getAllByText("2 / 2")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "公開デッキ25" })).toHaveAttribute(
    "href",
    "/decks/saved:deck-25"
  );
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
});

test("フォーマットタブ切替で検索語を維持し、1ページ目へ戻る", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks(
    "/decks?query=Blue&format=スタンダード&cardId=100000001&cardName=採用カード&playerName=投稿者&tournamentName=公開大会&page=3"
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith(expectedFetch({
      page: 3,
      query: "Blue",
      format: "スタンダード",
      cardId: "100000001",
      playerName: "投稿者",
      tournamentName: "公開大会",
    }))
  );
  expect(screen.getByRole("tab", { name: "スタンダード" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.queryByLabelText("添削杯の開催回")).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Red" } });
  fireEvent.keyDown(screen.getByRole("tab", { name: "スタンダード" }), {
    key: "ArrowRight",
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "Blue",
      format: KANSAI_CLASSIC_FORMAT_NAME,
      cardId: "100000001",
      playerName: "投稿者",
      tournamentName: "公開大会",
    }))
  );
  expect(screen.getByRole("tab", { name: "クラシック" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByRole("tab", { name: "クラシック" })).toHaveFocus();
  await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue("Blue"));
  expect(getLocationParams().get("query")).toBe("Blue");
  expect(getLocationParams().get("format")).toBe(KANSAI_CLASSIC_FORMAT_NAME);
  expect(getLocationParams().get("cardId")).toBe("100000001");
  expect(getLocationParams().get("playerName")).toBe("投稿者");
  expect(getLocationParams().get("tournamentName")).toBe("公開大会");
  expect(getLocationParams().get("page")).toBe("1");

  fireEvent.click(screen.getByRole("tab", { name: "すべて" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "Blue",
      format: "",
      cardId: "100000001",
      playerName: "投稿者",
      tournamentName: "公開大会",
    }))
  );
  expect(getLocationParams().has("format")).toBe(false);
  expect(getLocationParams().get("page")).toBe("1");
});

test("添削杯タブ内で開催回を選び、URLと取得条件へ反映できる", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });

  renderPublicDecks("/decks?query=Blue&format=スタンダード&page=2");
  await waitFor(() => expect(fetchPublicDecks).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("tab", { name: "添削杯" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "Blue",
      format: TENSAKU_FORMAT_NAMES[0],
    }))
  );
  expect(screen.getByRole("tab", { name: "添削杯" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("添削杯の開催回")).toHaveValue(TENSAKU_FORMAT_NAMES[0]);

  fireEvent.change(screen.getByLabelText("添削杯の開催回"), {
    target: { value: TENSAKU_FORMAT_NAMES[2] },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "Blue",
      format: TENSAKU_FORMAT_NAMES[2],
    }))
  );
  expect(getLocationParams().get("format")).toBe(TENSAKU_FORMAT_NAMES[2]);
  expect(getLocationParams().get("page")).toBe("1");
});

test("添削杯の開催回・ページ・検索語をURLから復元し、空状態を表示する", async () => {
  const restoredFormat = TENSAKU_FORMAT_NAMES[3];
  const changedFormat = TENSAKU_FORMAT_NAMES[0];
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 20,
  });

  renderPublicDecks(
    `/decks?query=${encodeURIComponent("赤単")}&format=${encodeURIComponent(restoredFormat)}&page=2`
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith(expectedFetch({
      page: 2,
      query: "赤単",
      format: restoredFormat,
    }))
  );
  expect(screen.getByRole("tab", { name: "添削杯" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("添削杯の開催回")).toHaveValue(restoredFormat);
  expect(await screen.findByText("検索結果がありません。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "次へ" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("添削杯の開催回"), {
    target: { value: changedFormat },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "赤単",
      format: changedFormat,
    }))
  );
  expect(getLocationParams().get("page")).toBe("1");

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "青赤" } });
  fireEvent.click(screen.getByRole("button", { name: "検索" }));

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "青赤",
      format: changedFormat,
    }))
  );
  expect(getLocationParams().get("query")).toBe("青赤");
  expect(getLocationParams().get("format")).toBe(changedFormat);
  expect(getLocationParams().get("page")).toBe("1");
});

test("その他タブは具体的なフォーマットとその他ラベルをURLから復元できる", async () => {
  fetchPublicDecks.mockResolvedValue({
    items: [],
    total: 0,
    page: 2,
    pageSize: 20,
  });

  renderPublicDecks(
    `/decks?query=大会&format=${encodeURIComponent(OTHER_FORMAT_NAME)}&page=2`
  );

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenCalledWith(expectedFetch({
      page: 2,
      query: "大会",
      format: OTHER_FORMAT_NAME,
    }))
  );
  expect(screen.getByRole("tab", { name: "その他" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByLabelText("その他のフォーマット")).toHaveValue(OTHER_FORMAT_NAME);

  fireEvent.change(screen.getByLabelText("その他のフォーマット"), {
    target: { value: OTHER_FORMAT_NAMES[0] },
  });

  await waitFor(() =>
    expect(fetchPublicDecks).toHaveBeenLastCalledWith(expectedFetch({
      page: 1,
      query: "大会",
      format: OTHER_FORMAT_NAMES[0],
    }))
  );
  expect(getLocationParams().get("format")).toBe(OTHER_FORMAT_NAMES[0]);
  expect(getLocationParams().get("page")).toBe("1");
});
