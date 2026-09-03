import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  expect(screen.queryByText("0件 / 1 / 1ページ")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("検索中は読込状態だけを表示して件数を表示しない", async () => {
  global.fetch = jest.fn(() => new Promise(() => {}));

  renderResults("/search?name=ガンダム");

  expect(await screen.findByText("読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("検索条件を指定してください。")).not.toBeInTheDocument();
  expect(screen.queryByText("検索条件に一致するカードはありません。")).not.toBeInTheDocument();
  expect(screen.queryByText("0件 / 1 / 1ページ")).not.toBeInTheDocument();
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
  expect(screen.getByText("0件 / 1 / 1ページ")).toBeInTheDocument();
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
  expect(screen.queryByText("0件 / 1 / 1ページ")).not.toBeInTheDocument();
  expect(alert).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "再試行" }));

  expect(await screen.findByText("再試行成功カード")).toBeInTheDocument();
  expect(screen.getByText("1件 / 1 / 1ページ")).toBeInTheDocument();
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
