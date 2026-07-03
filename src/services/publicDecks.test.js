import {
  PUBLIC_STORAGE_KEY,
  fetchPublicDeck,
  fetchPublicDecks,
  setDeckPublication,
} from "./publicDecks";

const user = { id: "user-1", name: "Test User" };
const savedKey = "gundamwar.savedDecks.v1:user-1";

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
    });

    expect(deck).toMatchObject({
      id: "deck-1",
      title: "Blue Control",
      isPublic: true,
      description: "A test deck",
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
          publishedAt: "2026-01-01T00:00:00.000Z",
          owner: user,
        },
        {
          id: "new",
          title: "Blue Control",
          isPublic: true,
          description: "search target",
          publishedAt: "2026-02-01T00:00:00.000Z",
          owner: user,
        },
        {
          id: "private",
          title: "Private Blue",
          isPublic: false,
          description: "search target",
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
});
