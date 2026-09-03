import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import SearchResults from "./SearchResults";

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({
    addCard: jest.fn(),
    countsByZoneByCardId: {},
  }),
}));
jest.mock("../components/CardImage", () => () => null);
jest.mock("../components/CardImagePreviewDialog", () => () => null);

const originalFetch = global.fetch;

function renderResults(initialEntry, props = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchResults {...props} />
    </MemoryRouter>
  );
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("モバイルの検索前は条件指定を促し、0件サマリーを表示しない", async () => {
  global.fetch = jest.fn();

  renderResults("/search", { compact: true });

  expect(await screen.findByText("検索条件を指定してください。")).toBeInTheDocument();
  expect(screen.queryByText("検索条件に一致するカードはありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("全0件・1 / 1ページ")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("検索中は読込状態だけを表示して件数を表示しない", async () => {
  global.fetch = jest.fn(() => new Promise(() => {}));

  renderResults("/search?name=ガンダム");

  expect(await screen.findByText("読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("検索条件を指定してください。")).not.toBeInTheDocument();
  expect(screen.queryByText("検索条件に一致するカードはありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("全0件・1 / 1ページ")).not.toBeInTheDocument();
});

test("適用中の検索条件を日本語で要約し、条件を保持した編集リンクを表示する", async () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const query = new URLSearchParams({
    name: "ガンダム",
    name_forward: "true",
    cardType: JSON.stringify(["1", "3"]),
    colorInclude: JSON.stringify([1, 4]),
    spCostMin: "2",
    spCostMax: "5",
    unitFeatureExtra: JSON.stringify(["mobileDoll"]),
    page: "3",
    pageSize: "20",
    mobileLayout: "ios",
  });

  renderResults(`/search?${query.toString()}`, { compact: true });

  const criteria = await screen.findByRole("region", { name: "現在の検索条件" });
  expect(within(criteria).getByText("カード名: ガンダム（前方一致）")).toBeVisible();
  expect(within(criteria).getByText("カードタイプ: UNIT、COMMAND")).toBeVisible();
  expect(within(criteria).getByText("含む色: 青、赤")).toBeVisible();
  expect(within(criteria).getByText("指定国力: 2〜5")).toBeVisible();
  expect(within(criteria).getByText("UNIT追加特徴: MD")).toBeVisible();
  expect(criteria).not.toHaveTextContent("pageSize");
  expect(criteria).not.toHaveTextContent("mobileLayout");

  const editLink = within(criteria).getByRole("link", { name: "検索に戻る" });
  expect(editLink.getAttribute("href")).toContain(query.toString());
});

test("検索を実行して0件なら条件に一致するカードがないことを表示する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 50 }),
  });

  renderResults("/search?name=存在しないカード");

  expect(
    await screen.findByText("検索条件に一致するカードはありません。")
  ).toBeInTheDocument();
  expect(screen.queryByText("検索条件を指定してください。")).not.toBeInTheDocument();
  expect(screen.getByText("全0件・1 / 1ページ")).toBeInTheDocument();
});

test("総件数・現在ページ・総ページ数を意味が分かる表記で表示する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ cardId: "page-2-card", name: "ページ表示テスト" }],
      total: 100,
      page: 2,
      pageSize: 20,
    }),
  });

  renderResults("/search?name=ページ表示テスト&page=2&pageSize=20");

  expect(await screen.findByText("ページ表示テスト")).toBeInTheDocument();
  expect(screen.getByText("全100件・2 / 5ページ")).toBeVisible();
});

test("検索失敗を空状態にせず画面内に表示し、再試行できる", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error("network error"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ cardId: "retry-card", name: "再試行成功カード" }],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    });

  renderResults("/search?name=再試行");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "検索結果の読み込みに失敗しました。"
  );
  expect(screen.queryByText("検索条件に一致するカードはありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("全0件・1 / 1ページ")).not.toBeInTheDocument();
  expect(alert).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("再試行成功カード")).toBeInTheDocument();
  expect(screen.getByText("全1件・1 / 1ページ")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(consoleError).toHaveBeenCalledTimes(1);
});

test("中断した古い検索の完了で新しい検索結果を上書きしない", async () => {
  let resolveFirstRequest;
  const firstRequest = new Promise((resolve) => {
    resolveFirstRequest = resolve;
  });
  global.fetch = jest
    .fn()
    .mockReturnValueOnce(firstRequest)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ cardId: "new-card", name: "新しい検索結果" }],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    });

  function SearchHarness() {
    const navigate = useNavigate();
    return (
      <>
        <button type="button" onClick={() => navigate("/search?name=新しい条件")}>
          条件を変更
        </button>
        <SearchResults />
      </>
    );
  }

  render(
    <MemoryRouter initialEntries={["/search?name=古い条件"]}>
      <SearchHarness />
    </MemoryRouter>
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "条件を変更" }));
  expect(await screen.findByText("新しい検索結果")).toBeInTheDocument();

  await act(async () => {
    resolveFirstRequest({
      ok: true,
      json: async () => ({
        data: [{ cardId: "old-card", name: "古い検索結果" }],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    });
    await firstRequest;
  });

  expect(screen.getByText("新しい検索結果")).toBeInTheDocument();
  expect(screen.queryByText("古い検索結果")).not.toBeInTheDocument();
});
