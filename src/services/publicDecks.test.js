import {
  PUBLIC_STORAGE_KEY,
  TOURNAMENT_STORAGE_KEY,
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

function validDeckItems() {
  return Array.from({ length: 17 }, (_, index) => ({
    cardId: `card-${index + 1}`,
    count: index === 16 ? 2 : 3,
    zone: "main",
    card: { cardId: `card-${index + 1}`, name: `Card ${index + 1}` },
  }));
}

function writeTournamentStore({ tournaments, entries }) {
  window.localStorage.setItem(
    TOURNAMENT_STORAGE_KEY,
    JSON.stringify({ tournaments, entries, rounds: {} })
  );
}

function tournament(overrides = {}) {
  return {
    id: "tournament-1",
    title: "公開大会",
    status: "completed",
    decklistsPublic: true,
    startsAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-02T00:00:00.000Z",
    ...overrides,
  };
}

function tournamentEntry(overrides = {}) {
  return {
    id: "entry-1",
    tournamentId: "tournament-1",
    user: { id: "player-1", name: "大会プレイヤー" },
    deckItems: [{ cardId: "tournament-card", count: 50 }],
    decklistSubmittedAt: "2026-01-31T00:00:00.000Z",
    deckFormat: "スタンダード",
    finalRank: 1,
    status: "checked_in",
    ...overrides,
  };
}

describe("publicDecks mock service", () => {
  beforeEach(() => {
    window.localStorage.clear();
    writeTournamentStore({ tournaments: [], entries: {} });
  });

  test("publishes a saved deck into the public deck store", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Blue Control",
        items: validDeckItems(),
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
    expect(result.items.map((deck) => deck.id)).toEqual(["saved:new"]);
    expect(result.items[0]).toMatchObject({ sourceType: "saved", sourceId: "new" });
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
    const publicTournament = tournament();
    writeTournamentStore({
      tournaments: [publicTournament],
      entries: {
        [publicTournament.id]: [tournamentEntry()],
      },
    });

    const firstPage = await fetchPublicDecks({ authMode: "mock", page: 1 });
    const secondPage = await fetchPublicDecks({ authMode: "mock", page: 2 });

    expect(firstPage).toMatchObject({ total: 26, page: 1, pageSize: 20 });
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.items[0].id).toBe("entry:entry-1");
    expect(secondPage).toMatchObject({ total: 26, page: 2, pageSize: 20 });
    expect(secondPage.items.map((deck) => deck.id)).toEqual([
      "saved:deck-6",
      "saved:deck-5",
      "saved:deck-4",
      "saved:deck-3",
      "saved:deck-2",
      "saved:deck-1",
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

  test("rejects a first publication with every preset violation and leaves storage unchanged", async () => {
    const savedDeck = {
      id: "deck-1",
      title: "Invalid Deck",
      items: [
        {
          cardId: "101020126",
          count: 3,
          zone: "main",
          card: { cardId: "101020126", name: "禁止テストカード" },
        },
      ],
    };
    writeSavedDecks([savedDeck]);

    const error = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      format: "関西クラシック",
    }).catch((publicationError) => publicationError);

    expect(error).toMatchObject({
      code: "deck_format_violations",
      format: "関西クラシック",
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "main_count" }),
        expect.objectContaining({
          code: "banned",
          cardName: "禁止テストカード",
        }),
      ]),
    });
    expect(error.message).toContain("現在は3枚です。");
    expect(error.message).toContain("禁止テストカードは禁止カードです。");
    expect(JSON.parse(window.localStorage.getItem(savedKey))).toEqual([savedDeck]);
    expect(window.localStorage.getItem(PUBLIC_STORAGE_KEY)).toBeNull();
  });

  test("skips validation for an unregistered free-text format", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Free Format Deck",
        items: [],
      },
    ]);

    const deck = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      format: "独自フォーマット",
    });

    expect(deck).toMatchObject({
      id: "deck-1",
      isPublic: true,
      format: "独自フォーマット",
    });
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))).toHaveLength(1);
  });

  test("does not retroactively validate an already-public deck when updating publication details", async () => {
    const existingDeck = {
      id: "deck-1",
      title: "Legacy Public Deck",
      items: [],
      isPublic: true,
      format: "スタンダード",
      publishedAt: "2026-02-01T00:00:00.000Z",
    };
    writeSavedDecks([existingDeck]);
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([{ ...existingDeck, owner: user }])
    );

    const deck = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      description: "説明だけ更新",
      format: "スタンダード",
    });

    expect(deck).toMatchObject({
      id: "deck-1",
      isPublic: true,
      description: "説明だけ更新",
      publishedAt: existingDeck.publishedAt,
    });
    expect(JSON.parse(window.localStorage.getItem(savedKey))[0]).toMatchObject({
      isPublic: true,
      description: "説明だけ更新",
      publishedAt: existingDeck.publishedAt,
    });
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))[0]).toMatchObject({
      isPublic: true,
      description: "説明だけ更新",
      publishedAt: existingDeck.publishedAt,
    });
  });

  test("rejects changing a public deck to a preset it does not satisfy", async () => {
    const items = validDeckItems();
    items[0] = {
      ...items[0],
      cardId: "101020126",
      card: { cardId: "101020126", name: "禁止テストカード" },
    };
    const existingDeck = {
      id: "deck-1",
      title: "Published Standard Deck",
      items,
      isPublic: true,
      description: "公開中",
      format: "スタンダード",
      publishedAt: "2026-02-01T00:00:00.000Z",
    };
    writeSavedDecks([existingDeck]);
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([{ ...existingDeck, owner: user }])
    );

    const error = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      description: "変更後の説明",
      format: "関西クラシック",
    }).catch((publicationError) => publicationError);

    expect(error).toMatchObject({
      code: "deck_format_violations",
      format: "関西クラシック",
      violations: expect.arrayContaining([
        expect.objectContaining({
          code: "banned",
          cardName: "禁止テストカード",
        }),
      ]),
    });
    expect(JSON.parse(window.localStorage.getItem(savedKey))[0]).toMatchObject({
      isPublic: true,
      description: "公開中",
      format: "スタンダード",
    });
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))[0]).toMatchObject({
      isPublic: true,
      description: "公開中",
      format: "スタンダード",
    });
  });

  test("allows changing a public deck to a preset it satisfies", async () => {
    const existingDeck = {
      id: "deck-1",
      title: "Published Standard Deck",
      items: validDeckItems(),
      isPublic: true,
      description: "公開中",
      format: "スタンダード",
      publishedAt: "2026-02-01T00:00:00.000Z",
    };
    writeSavedDecks([existingDeck]);
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([{ ...existingDeck, owner: user }])
    );

    const deck = await setDeckPublication({
      authMode: "mock",
      user,
      deckId: "deck-1",
      isPublic: true,
      description: "変更後の説明",
      format: "関西クラシック",
    });

    expect(deck).toMatchObject({
      isPublic: true,
      description: "変更後の説明",
      format: "関西クラシック",
      publishedAt: existingDeck.publishedAt,
    });
    expect(JSON.parse(window.localStorage.getItem(savedKey))[0]).toMatchObject({
      isPublic: true,
      format: "関西クラシック",
    });
    expect(JSON.parse(window.localStorage.getItem(PUBLIC_STORAGE_KEY))[0]).toMatchObject({
      isPublic: true,
      format: "関西クラシック",
    });
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
    expect(result.items[0]).toMatchObject({ id: "saved:other", format: "その他" });
  });

  test("保存デッキ詳細は大会参照を破棄し、非公開デッキを隠す", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "deck-1",
          title: "Public",
          isPublic: true,
          items: [],
          owner: user,
          tournamentId: "tournament-1",
          tournamentName: "テスト大会",
        },
        { id: "deck-2", title: "Private", isPublic: false, items: [], owner: user },
      ])
    );

    const publicDeck = await fetchPublicDeck("deck-1", { authMode: "mock" });
    expect(publicDeck).toMatchObject({
      id: "saved:deck-1",
      sourceType: "saved",
      title: "Public",
    });
    expect(publicDeck).not.toHaveProperty("tournament");
    await expect(fetchPublicDeck("deck-2", { authMode: "mock" })).rejects.toThrow(
      "公開デッキが見つかりません。"
    );
  });

  test("保存デッキと公開可能な大会提出デッキだけを混在させ、ID衝突を防ぐ", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        {
          id: "42",
          title: "保存デッキ42",
          isPublic: true,
          format: "その他",
          publishedAt: "2026-02-01T00:00:00.000Z",
          owner: user,
          tournamentId: "old-link",
          tournamentName: "保存側に残った旧大会参照",
        },
      ])
    );
    const publicTournament = tournament({
      id: "public-tournament",
      title: "春の公開大会",
      startsAt: "2026-03-01T00:00:00.000Z",
    });
    const privateTournament = tournament({
      id: "private-tournament",
      title: "非公開大会",
      decklistsPublic: false,
    });
    const activeTournament = tournament({
      id: "active-tournament",
      title: "進行中大会",
      status: "in_progress",
    });
    writeTournamentStore({
      tournaments: [publicTournament, privateTournament, activeTournament],
      entries: {
        [publicTournament.id]: [
          tournamentEntry({
            id: "42",
            tournamentId: publicTournament.id,
            finalRank: 2,
          }),
          tournamentEntry({
            id: "not-submitted",
            tournamentId: publicTournament.id,
            decklistSubmittedAt: null,
          }),
          tournamentEntry({
            id: "empty-deck",
            tournamentId: publicTournament.id,
            deckItems: [],
          }),
        ],
        [privateTournament.id]: [
          tournamentEntry({ id: "private-entry", tournamentId: privateTournament.id }),
        ],
        [activeTournament.id]: [
          tournamentEntry({ id: "active-entry", tournamentId: activeTournament.id }),
        ],
      },
    });

    const result = await fetchPublicDecks({ authMode: "mock", page: 1 });

    expect(result.items.map((deck) => deck.id)).toEqual(["entry:42", "saved:42"]);
    expect(result.items[0]).toMatchObject({
      sourceType: "tournament",
      sourceId: "42",
      title: "大会プレイヤーの大会デッキ",
      format: "スタンダード",
      finalRank: 2,
      participantCount: 3,
      owner: { id: "player-1", name: "大会プレイヤー" },
      tournament: {
        id: "public-tournament",
        title: "春の公開大会",
        startsAt: "2026-03-01T00:00:00.000Z",
      },
    });
    expect(result.items[1]).not.toHaveProperty("tournament");
    expect(result.items.map((deck) => deck.id)).not.toContain("entry:private-entry");
    expect(result.items.map((deck) => deck.id)).not.toContain("entry:active-entry");

    const filtered = await fetchPublicDecks({
      authMode: "mock",
      page: 1,
      query: "春の公開大会",
      format: "スタンダード",
    });
    expect(filtered.items.map((deck) => deck.id)).toEqual(["entry:42"]);
  });

  test("保存デッキがなくても公開大会の提出デッキだけを返す", async () => {
    const publicTournament = tournament({ id: "tournament-only" });
    writeTournamentStore({
      tournaments: [publicTournament],
      entries: {
        [publicTournament.id]: [
          tournamentEntry({ id: "only-entry", tournamentId: publicTournament.id }),
        ],
      },
    });

    const result = await fetchPublicDecks({ authMode: "mock", page: 1 });

    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(result.items).toEqual([
      expect.objectContaining({ id: "entry:only-entry", sourceType: "tournament" }),
    ]);
  });

  test("接頭辞付きIDを系統別に解決し、数値のみの既存URLは保存デッキとして扱う", async () => {
    window.localStorage.setItem(
      PUBLIC_STORAGE_KEY,
      JSON.stringify([
        { id: "42", title: "従来の保存デッキ", isPublic: true, items: [], owner: user },
      ])
    );
    const publicTournament = tournament({ id: "public-tournament" });
    const privateTournament = tournament({
      id: "private-tournament",
      decklistsPublic: false,
    });
    writeTournamentStore({
      tournaments: [publicTournament, privateTournament],
      entries: {
        [publicTournament.id]: [
          tournamentEntry({ id: "42", tournamentId: publicTournament.id }),
        ],
        [privateTournament.id]: [
          tournamentEntry({ id: "private-entry", tournamentId: privateTournament.id }),
        ],
      },
    });

    await expect(fetchPublicDeck("42", { authMode: "mock" })).resolves.toMatchObject({
      id: "saved:42",
      title: "従来の保存デッキ",
    });
    await expect(fetchPublicDeck("saved:42", { authMode: "mock" })).resolves.toMatchObject({
      id: "saved:42",
      title: "従来の保存デッキ",
    });
    await expect(fetchPublicDeck("entry:42", { authMode: "mock" })).resolves.toMatchObject({
      id: "entry:42",
      sourceType: "tournament",
    });
    await expect(fetchPublicDeck("entry:private-entry", { authMode: "mock" })).rejects.toThrow(
      "公開デッキが見つかりません。"
    );
  });

  test("API詳細もentry接頭辞だけ大会エンドポイントへ振り分ける", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          deck: {
            id: "42",
            title: "従来の保存デッキ",
            isPublic: true,
            items: [],
            owner: user,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          deck: {
            id: "42",
            entryId: "42",
            items: [],
            owner: { id: "player-1", name: "大会プレイヤー" },
            deckFormat: "スタンダード",
          },
          finalRank: 1,
          participantCount: 16,
          tournament: {
            id: "tournament-1",
            title: "公開大会",
            startsAt: "2026-02-01T00:00:00.000Z",
          },
        }),
      });

    try {
      await expect(fetchPublicDeck("42", { authMode: "api" })).resolves.toMatchObject({
        id: "saved:42",
        sourceType: "saved",
      });
      await expect(fetchPublicDeck("entry:42", { authMode: "api" })).resolves.toMatchObject({
        id: "entry:42",
        sourceType: "tournament",
        finalRank: 1,
        participantCount: 16,
        tournament: { id: "tournament-1", title: "公開大会" },
      });
      expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
        "/api/public-decks/42",
        "/api/tournament-decks/42",
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("大会デッキの公開設定は変更できない", async () => {
    await expect(
      setDeckPublication({
        authMode: "mock",
        user,
        deckId: "entry:42",
        isPublic: false,
      })
    ).rejects.toThrow("大会デッキの公開設定は変更できません。");
  });

  test("unpublishes a deck from the public deck store", async () => {
    writeSavedDecks([
      {
        id: "deck-1",
        title: "Blue Control",
        isPublic: true,
        description: "A test deck",
        publishedAt: "2026-02-01T00:00:00.000Z",
        format: "関西クラシック",
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
      format: "関西クラシック",
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
