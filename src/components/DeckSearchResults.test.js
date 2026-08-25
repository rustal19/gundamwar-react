import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FORMAT_PRESETS } from "../data/formats";
import { getFormatSetCodes } from "../utils/searchResults";
import DeckSearchResults from "./DeckSearchResults";

jest.mock("../context/DeckContext", () => ({
  useDeck: () => ({
    addCard: jest.fn(),
    countsByZoneByCardId: {},
  }),
}));
jest.mock("./CardImage", () => () => null);
jest.mock("./CardImagePreviewDialog", () => () => null);

const originalFetch = global.fetch;
const originalScrollTo = window.HTMLElement.prototype.scrollTo;

beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = jest.fn();
});

function renderResults(initialEntry, props = {}) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DeckSearchResults {...props} />
    </MemoryRouter>
  );
}

afterEach(() => {
  global.fetch = originalFetch;
});

afterAll(() => {
  window.HTMLElement.prototype.scrollTo = originalScrollTo;
});

test("検索前は検索条件の指定を促す", async () => {
  global.fetch = jest.fn();

  renderResults("/deck");

  expect(await screen.findByText("検索条件を指定してください。")).toBeInTheDocument();
  expect(screen.queryByText("検索結果がありません。")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("検索を実行して0件なら検索結果なしと表示する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });

  renderResults(
    "/deck?name=存在しないカード&deckRangeType=classic&deckRangeDetail=2006-01-01"
  );

  expect(await screen.findByText("検索結果がありません。")).toBeInTheDocument();
  expect(screen.queryByText("検索条件を指定してください。")).not.toBeInTheDocument();

  const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(requestBody).toMatchObject({
    name: "存在しないカード",
    deckRangeType: "classic",
    deckRangeDetail: "2006-01-01",
  });
  expect(requestBody).not.toHaveProperty("formatName");
});

test("選択フォーマットの使用可能セットをAPI条件へ反映し旧構築範囲を無効化する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });
  const selectedFormat = FORMAT_PRESETS.find(({ name }) => name === "関西グロリアス");

  renderResults(
    "/deck?name=ガンダム&formatName=URL%E5%81%B4&deckRangeType=classic&deckRangeDetail=2006-01-01",
    { formatName: selectedFormat.name }
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(requestBody).toMatchObject({
    name: "ガンダム",
    deckRangeType: "none",
    setIncluded: getFormatSetCodes(selectedFormat.regulation),
  });
  expect(requestBody).not.toHaveProperty("formatName");
  expect(requestBody).not.toHaveProperty("deckRangeDetail");
});

test("フォーマット選択だけでも使用可能セットに絞って検索する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
  });
  const selectedFormat = FORMAT_PRESETS.find(({ name }) => name === "関西クラシック");

  renderResults("/deck", { formatName: selectedFormat.name });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    deckRangeType: "none",
    pageSize: 20,
    setIncluded: getFormatSetCodes(selectedFormat.regulation),
  });
});

test("URLで選択したフォーマットの禁止・制限バッジを検索結果に表示する", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { cardId: 101020126, name: "禁止カード" },
        { cardId: "101010083", name: "制限カード" },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    }),
  });

  renderResults("/deck?name=カード&formatName=%E9%96%A2%E8%A5%BF%E3%82%B0%E3%83%AD%E3%83%AA%E3%82%A2%E3%82%B9");

  expect(await screen.findByText("禁止")).toHaveClass("result-card-format-badge", "banned");
  expect(screen.getByText("制限")).toHaveClass("result-card-format-badge", "limited");
});

test("フォーマット未選択ではセット条件と禁止・制限バッジを追加しない", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ cardId: "101020126", name: "通常表示カード" }],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  });

  renderResults(
    "/deck?name=通常表示カード&deckRangeType=classic&deckRangeDetail=2006-01-01",
    { formatName: "" }
  );

  expect(await screen.findByText("通常表示カード")).toBeInTheDocument();
  expect(screen.queryByText("禁止")).not.toBeInTheDocument();
  expect(screen.queryByText("制限")).not.toBeInTheDocument();
  const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(requestBody).not.toHaveProperty("formatName");
  expect(requestBody).not.toHaveProperty("setIncluded");
  expect(requestBody).not.toHaveProperty("deckRangeType");
  expect(requestBody).not.toHaveProperty("deckRangeDetail");
});
