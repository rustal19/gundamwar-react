import {
  CARD_SEARCH_PAGE_SIZE,
  resolveCardReference,
  searchCardsByName,
} from "./cardSearch";

const originalFetch = global.fetch;

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

test("カード名の完全一致と前方一致を部分一致より優先し、API順を同順位で保つ", async () => {
  global.fetch = jest.fn(async (_url, options) => {
    const request = JSON.parse(options.body);
    return {
      ok: true,
      json: async () =>
        request.name_forward
          ? {
              data: [
                { cardId: "100000002", name: "ガンダム試作1号機" },
                { cardId: "100000003", name: "ガンダム" },
                { cardId: "100000004", name: "ガンダムF91" },
              ],
              total: 3,
            }
          : {
              data: [
                { cardId: "100000001", name: "青いガンダム" },
                { cardId: "100000005", name: "赤いガンダム" },
              ],
              total: 722,
            },
    };
  });

  const result = await searchCardsByName("ガンダム");

  expect(result.cards.map((card) => card.cardId)).toEqual([
    "100000003",
    "100000002",
    "100000004",
    "100000001",
    "100000005",
  ]);
  expect(result.total).toBe(722);
  expect(result.isTruncated).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(
    global.fetch.mock.calls.map(([, options]) => JSON.parse(options.body))
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "ガンダム",
        name_forward: false,
        pageSize: CARD_SEARCH_PAGE_SIZE,
      }),
      expect.objectContaining({
        name: "ガンダム",
        name_forward: true,
        pageSize: CARD_SEARCH_PAGE_SIZE,
      }),
    ])
  );
});

test("一括解決は前方一致検索を1回だけ行い、表示対象の完全一致候補数を返す", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { cardId: "100000010", name: "同名カード" },
        { cardId: "100000011", name: "同名カード強化型" },
      ],
      total: 722,
    }),
  });

  const result = await resolveCardReference("同名カード");

  expect(result).toEqual(
    expect.objectContaining({
      status: "ambiguous",
      candidateTotal: 1,
      candidates: [{ cardId: "100000010", name: "同名カード" }],
    })
  );
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(
    expect.objectContaining({ name_forward: true })
  );
});
