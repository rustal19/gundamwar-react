import {
  PUBLIC_STORAGE_KEY,
  fetchPublicDeck,
  fetchPublicDecks,
  setDeckPublication,
} from "./publicDecks";

const user = { id: "user-1", name: "Test User" };
const savedKey = "gundamwar.savedDecks.v1:user-1";
const ownerSavedKey = "gundamwar.savedDecks.v1:owner-1";

function writeSavedDecks(decks) {
  window.localStorage.setItem(savedKey, JSON.stringify(decks));
}

describe("publicDecks mock service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("publishes a saved deck into the public deck store", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Blue Control",
        items: [{ cardId: "card-1", count: 3, card: { name: "Card 1" } }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const deck = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      description: "A test deck",
      format: "スタンダード",
    });

    expect(deck).toMatchObject({
      id: "deck-1",
      title: "Blue Control",
      isPublic: true,
      description: "A test deck",
      format: "スタンダード",
      owner: user,
    });

    const publicDecks = JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY));
    expect(publicDecks).toHaveLength(1);
    expect(publicDecks[0].id).toBe("deck-1");
  });

  test("fetches public decks with search and newest-first ordering", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "old",
          title: "Green Rush",
          isPublic: true,
          description: "",
          format: "スタンダード",
          publishedAt: "2026-01-01T00:00:00.000Z",
          owner: user,
        },
        {
          id: "new",
          title: "Blue Control",
          isPublic: true,
          description: "search target",
          format: "その他",
          publishedAt: "2026-02-01T00:00:00.000Z",
          owner: user,
        },
        {
          id: "private",
          title: "Private Blue",
          isPublic: false,
          description: "search target",
          format: "その他",
          publishedAt: "2026-03-01T00:00:00.000Z",
          owner: user,
        },
      ])
    );

    const result = await fetchPublicDecks({ authMode: "mock", page: 1, query: "blue" });

    expect(result.total).toBe(1);
    expect(result.items.map((deck) => deck.id)).toEqual(["new"]);
    expect(result.pageSize).toBe(20);
  });

  test("paginates every public deck without truncating the total count", async () => {
    const decks = Array.from({ length: 25 }, (_, index) => {
      const number = index + 1;
      return {
        id: `deck-${number}`,
        title: `Deck ${number}`,
        isPublic: true,
        publishedAt: `2026-01-${String(number).padStart(2, "0")}T00:00:00.000Z`,
        owner: user,
      };
    });
    window.localStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(decks));

    const firstPage = await fetchPublicDecks({ authMode: "mock", page: 1 });
    const secondPage = await fetchPublicDecks({ authMode: "mock", page: 2 });

    expect(firstPage).toMatchObject({ total: 25, page: 1, pageSize: 20 });
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.items[0].id).toBe("deck-25");
    expect(secondPage).toMatchObject({ total: 25, page: 2, pageSize: 20 });
    expect(secondPage.items.map((deck) => deck.id)).toEqual([
      "deck-5",
      "deck-4",
      "deck-3",
      "deck-2",
      "deck-1",
    ]);
  });

  test("requires format when publishing a deck", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Blue Control",
        items: [],
      },
    ]);

    await expect(
      setDeckPublication({
        authMode: "mock",
        user,
        deckId: "deck-1",
        isPublic: true,
        description: "A test deck",
      })
    ).rejects.toThrow("フォーマットを選択してください。");

    expect(window.localStorage.getItem(PUBLIC_STORAGE_KEY)).toBeNull();
  });

  test("filters public decks by format", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "standard",
          title: "Standard Deck",
          isPublic: true,
          format: "スタンダード",
          owner: user,
        },
        {
          id: "other",
          title: "Other Deck",
          isPublic: true,
          format: "その他",
          owner: user,
        },
      ])
    );

    const result = await fetchPublicDecks({ authMode: "mock", page: 1, format: "その他" });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "other", format: "その他" });
  });

  test("fetches a public deck detail and hides unpublished decks", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        { id: "deck-1", title: "Public", isPublic: true, items: [], owner: user },
        { id: "deck-2", title: "Private", isPublic: false, items: [], owner: user },
      ])
    );

    await expect(fetchPublicDeck("deck-1", { authMode: "mock" })).resolves.toMatchObject({
      id: "deck-1",
      title: "Public",
    });
    await expect(fetchPublicDeck("deck-2", { authMode: "mock" })).rejects.toThrow(
      "公開デッキが見つかりません。"
    );
  });

  test("unpublishes a deck from the public deck store", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Blue Control",
        isPublic: true,
        description: "A test deck",
        publishedAt: "2026-02-01T00:00:00.000Z",
        items: [],
      },
    ]);
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "deck-1",
          title: "Blue Control",
          isPublic: true,
          description: "A test deck",
          publishedAt: "2026-02-01T00:00:00.000Z",
          owner: user,
        },
      ])
    );

    const deck = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: false,
      description: "",
    });

    expect(deck.isPublic).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))).toEqual([]);
  });

  test("admin force-unpublishes another user's public deck and updates owner saved deck if present", async () => {
    window.localStorage.setItem(
      ownerSavedKey,
      JSON.stringify([
        {
          id: "deck-9",
          title: "Owner Deck",
          isPublic: true,
          description: "公開中",
          publishedAt: "2026-02-01T00:00:00.000Z",
          items: [],
        },
      ])
    );
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "deck-9",
          title: "Owner Deck",
          isPublic: true,
          description: "公開中",
          publishedAt: "2026-02-01T00:00:00.000Z",
          owner: { id: "owner-1", name: "Owner" },
          items: [],
        },
      ])
    );

    const deck = await setDeckPublication({
      authMode: "mock",
      user: { id: "admin-1", name: "Admin", role: "admin" },
      deckId: "deck-9",
      isPublic: false,
    });

    expect(deck).toMatchObject({ id: "deck-9", isPublic: false });
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(ownerSavedKey))[0].isPublic).toBe(false);
  });
});
