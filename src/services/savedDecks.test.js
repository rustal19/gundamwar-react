import { fetchSavedDecks, saveSavedDeck } from "./savedDecks";

const user = { id: "user-1", name: "テストユーザー" };
const storageKey = "gundamwar.savedDecks.v1:user-1";
const originalFetch = global.fetch;

describe("savedDecks service", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("mock新規保存でフォーマットを保持して再読込できる", async () => {
    const savedDeck = await saveSavedDeck({
      authMode: "mock",
      user,
      deckId: "",
      title: "クラシックデッキ",
      items: [],
      format: "  関西クラシック  ",
    });

    expect(savedDeck.format).toBe("関西クラシック");
    await expect(fetchSavedDecks({ authMode: "mock", user })).resolves.toEqual([
      expect.objectContaining({ id: savedDeck.id, format: "関西クラシック" }),
    ]);
  });

  test("mock上書き保存でnullを渡すとフォーマットを解除できる", async () => {
    const savedDeck = await saveSavedDeck({
      authMode: "mock",
      user,
      deckId: "",
      title: "フォーマット付きデッキ",
      items: [],
      format: "関西ライジング",
    });

    const updatedDeck = await saveSavedDeck({
      authMode: "mock",
      user,
      deckId: savedDeck.id,
      title: savedDeck.title,
      items: [],
      format: null,
    });

    expect(updatedDeck.format).toBeNull();
    await expect(fetchSavedDecks({ authMode: "mock", user })).resolves.toEqual([
      expect.objectContaining({ id: savedDeck.id, format: null }),
    ]);
  });

  test("formatを省略した上書き保存では既存フォーマットを維持する", async () => {
    const savedDeck = await saveSavedDeck({
      authMode: "mock",
      user,
      deckId: "",
      title: "既存呼び出し互換デッキ",
      items: [],
      format: "αスタンダード",
    });

    const updatedDeck = await saveSavedDeck({
      authMode: "mock",
      user,
      deckId: savedDeck.id,
      title: "更新後タイトル",
      items: [],
    });

    expect(updatedDeck).toMatchObject({
      title: "更新後タイトル",
      format: "αスタンダード",
    });
  });

  test("formatを持たない旧保存データは制限なしとして復元する", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          id: "legacy-deck",
          title: "旧デッキ",
          items: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );

    await expect(fetchSavedDecks({ authMode: "mock", user })).resolves.toEqual([
      expect.objectContaining({ id: "legacy-deck", format: null }),
    ]);
  });

  test("API保存payloadではformatの指定と省略を区別する", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deck: { id: "api-1", title: "APIデッキ", items: [], format: "添削杯 12" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deck: { id: "api-1", title: "APIデッキ", items: [], format: "添削杯 12" },
        }),
      });

    await saveSavedDeck({
      authMode: "cookie",
      user,
      deckId: "",
      title: "APIデッキ",
      items: [],
      format: "添削杯 12",
    });
    await saveSavedDeck({
      authMode: "cookie",
      user,
      deckId: "api-1",
      title: "APIデッキ",
      items: [],
    });

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      title: "APIデッキ",
      items: [],
      format: "添削杯 12",
    });
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({
      title: "APIデッキ",
      items: [],
    });
  });
});
