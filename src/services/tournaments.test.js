import {
  checkInMyEntry,
  completeRound,
  createNextRound,
  createEntry,
  createTournament,
  deleteMyEntry,
  fetchEntries,
  fetchRounds,
  fetchStandings,
  fetchTournament,
  fetchTournaments,
  reportMatchResult,
  updateEntryStatus,
  updateMyEntry,
  updateTournament,
} from "./tournaments";

const STORAGE_KEY = "gundamwar.tournaments.v1";
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const user = { id: "test-user", name: "テストユーザー" };
const originalFetch = global.fetch;

function setMockUser() {
  window.localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
}

function readStore() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
}

function setRegistrationTournament(overrides = {}) {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tournaments: [
        {
          id: "t1",
          title: "受付中大会",
          description: "",
          format: "swiss",
          swissRounds: null,
          topCutSize: null,
          status: "registration",
          startsAt: future,
          registrationClosesAt: future,
          capacity: 8,
          venue: null,
          isOnline: false,
          selfCheckin: false,
          decklistsPublic: false,
          decklistRequired: false,
          regulation: {},
          createdBy: { id: "org", name: "主催者" },
          entryCount: 0,
          createdAt: future,
          updatedAt: future,
          ...overrides,
        },
      ],
      entries: { t1: [] },
      rounds: { t1: [] },
    })
  );
}

function makeValidDeck() {
  return Array.from({ length: 50 }, (_, index) => ({
    cardId: `card-${index + 1}`,
    count: 1,
    card: { cardId: `card-${index + 1}`, name: `Card ${index + 1}` },
    zone: "main",
  }));
}

function buildValidDeck(prefix = "card") {
  return Array.from({ length: 17 }, (_, index) => ({
    cardId: `${prefix}-${index + 1}`,
    count: index === 16 ? 2 : 3,
    card: { cardId: `${prefix}-${index + 1}`, name: `${prefix} ${index + 1}`, sets: ["S1"] },
    zone: "main",
  }));
}

describe("tournaments service mock mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = originalFetch;
    setMockUser();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("seeds and pages public tournaments", async () => {
    const payload = await fetchTournaments({ authMode: "mock", page: 1 });

    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.every((tournament) => tournament.status !== "draft")).toBe(true);
    expect(payload.page).toBe(1);
    expect(payload.pageSize).toBe(10);
    expect(payload.items.map((tournament) => tournament.title)).toContain("ローカルスイス杯");
    expect(payload.items.map((tournament) => tournament.title)).toContain("週末エントリー受付大会");
    expect(payload.items[0].regulation.name).toBe("スタンダード");
    expect(payload.items.find((tournament) => tournament.id === "mock-tournament-1")).toMatchObject({
      venue: "東京・秋葉原カードショップ○○",
      isOnline: false,
      selfCheckin: false,
      decklistsPublic: false,
    });
    expect(payload.items.find((tournament) => tournament.id === "mock-tournament-2")).toMatchObject({
      venue: null,
      isOnline: true,
      selfCheckin: true,
      decklistsPublic: false,
    });
  });

  it("uses the real API unless authMode is mock", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 2, pageSize: 10 }),
    });

    const payload = await fetchTournaments({ page: 2 });

    expect(payload.page).toBe(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/tournaments?page=2",
      expect.objectContaining({ credentials: "include", method: "GET" })
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("creates, updates, and deletes my entry", async () => {
    setRegistrationTournament();
    const deckItems = buildValidDeck("card");

    const created = await createEntry({ tournamentId: "t1", deckItems, authMode: "mock", user });
    expect(created.user.id).toBe(user.id);
    expect(created.deckItems).toHaveLength(17);

    const updatedItems = buildValidDeck("updated-card");
    const updated = await updateMyEntry({
      tournamentId: "t1",
      deckItems: updatedItems,
      authMode: "mock",
      user,
    });
    expect(updated.deckItems[0].cardId).toBe("updated-card-1");

    await deleteMyEntry("t1", { authMode: "mock", user });
    expect(readStore().entries.t1).toEqual([]);
  });

  it("requires a decklist when the tournament requires it", async () => {
    setRegistrationTournament({ decklistRequired: true });

    await expect(createEntry({ tournamentId: "t1", authMode: "mock", user })).rejects.toThrow(
      "デッキリスト"
    );
  });

  it("hides other players decklists before completed", async () => {
    setRegistrationTournament({ status: "in_progress" });
    const store = readStore();
    store.entries.t1 = [
      {
        id: "other-entry",
        tournamentId: "t1",
        user: { id: "other-user", name: "別プレイヤー" },
        deckItems: [{ cardId: "secret", count: 1, card: { cardId: "secret", name: "非公開" }, zone: "main" }],
        decklistSubmittedAt: new Date().toISOString(),
        status: "registered",
        createdAt: new Date().toISOString(),
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const tournament = await fetchTournament("t1", { authMode: "mock", user });
    expect(tournament.entries[0].deckItems).toBeNull();
    expect(tournament.entries[0].decklistSubmittedAt).toBeTruthy();
  });

  it("shows other players decklists only when completed and decklistsPublic is true", async () => {
    setRegistrationTournament({ status: "completed", decklistsPublic: false });
    const submittedAt = new Date().toISOString();
    const deckItems = [
      { cardId: "secret", count: 1, card: { cardId: "secret", name: "秘密兵器" }, zone: "main" },
    ];
    const store = readStore();
    store.entries.t1 = [
      {
        id: "other-entry",
        tournamentId: "t1",
        user: { id: "other-user", name: "別プレイヤー" },
        deckItems,
        decklistSubmittedAt: submittedAt,
        status: "registered",
        createdAt: submittedAt,
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const hidden = await fetchTournament("t1", { authMode: "mock", user });
    expect(hidden.entries[0].deckItems).toBeNull();

    store.tournaments[0].decklistsPublic = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    const visible = await fetchTournament("t1", { authMode: "mock", user });
    expect(visible.entries[0].deckItems).toEqual(deckItems);
  });

  it("allows owner and organizer to see submitted decklists even when not public", async () => {
    setRegistrationTournament({ status: "completed", decklistsPublic: false });
    const submittedAt = new Date().toISOString();
    const deckItems = [
      { cardId: "owner-card", count: 1, card: { cardId: "owner-card", name: "自分のカード" }, zone: "main" },
    ];
    const store = readStore();
    store.entries.t1 = [
      {
        id: "my-entry",
        tournamentId: "t1",
        user: { id: user.id, name: user.name },
        deckItems,
        decklistSubmittedAt: submittedAt,
        status: "registered",
        createdAt: submittedAt,
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const ownerView = await fetchTournament("t1", { authMode: "mock", user });
    expect(ownerView.entries[0].deckItems).toEqual(deckItems);

    const organizerView = await fetchTournament("t1", {
      authMode: "mock",
      user: { id: "org", name: "主催者" },
    });
    expect(organizerView.entries[0].deckItems).toEqual(deckItems);
  });

  it("checks in my entry only on the tournament day before rounds are generated", async () => {
    const today = new Date().toISOString();
    setRegistrationTournament({ startsAt: today, selfCheckin: true });
    const store = readStore();
    store.entries.t1 = [
      {
        id: "my-entry",
        tournamentId: "t1",
        user,
        deckItems: null,
        decklistSubmittedAt: null,
        status: "registered",
        createdAt: today,
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const checkedIn = await checkInMyEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(checkedIn.status).toBe("checked_in");
    expect(readStore().entries.t1[0].status).toBe("checked_in");
  });

  it("rejects self check-in when disabled, not on the day, or after rounds exist", async () => {
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const entry = {
      id: "my-entry",
      tournamentId: "t1",
      user,
      deckItems: null,
      decklistSubmittedAt: null,
      status: "registered",
      createdAt: today,
    };

    setRegistrationTournament({ startsAt: today, selfCheckin: false });
    let store = readStore();
    store.entries.t1 = [entry];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    await expect(checkInMyEntry({ tournamentId: "t1", authMode: "mock", user })).rejects.toThrow(
      "セルフチェックインを許可していません"
    );

    setRegistrationTournament({ startsAt: tomorrow, selfCheckin: true });
    store = readStore();
    store.entries.t1 = [entry];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    await expect(checkInMyEntry({ tournamentId: "t1", authMode: "mock", user })).rejects.toThrow(
      "開催日当日"
    );

    setRegistrationTournament({ startsAt: today, selfCheckin: true });
    store = readStore();
    store.entries.t1 = [entry];
    store.rounds.t1 = [{ id: "round-1", tournamentId: "t1", number: 1, stage: "swiss", matches: [] }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    await expect(checkInMyEntry({ tournamentId: "t1", authMode: "mock", user })).rejects.toThrow(
      "ラウンド生成後"
    );
  });

  it("computes standings from mock rounds using tournament utility", async () => {
    const standings = await fetchStandings("mock-tournament-1", { authMode: "mock" });

    expect(standings.items[0].points).toBe(3);
    expect(standings.items.map((standing) => standing.entryId)).toContain("entry-1");
    expect(standings.items.map((standing) => standing.entryId)).toContain("entry-3");
  });

  it("creates and updates organizer tournaments with forward status transitions", async () => {
    const created = await createTournament({
      title: "Organizer Cup",
      description: "test",
      format: "swiss",
      swissRounds: null,
      topCutSize: null,
      status: "draft",
      capacity: 16,
      venue: "オンライン Discord",
      isOnline: true,
      selfCheckin: true,
      decklistsPublic: true,
      decklistRequired: true,
      regulation: { name: "Custom", mainMin: 40 },
      authMode: "mock",
      user,
    });

    expect(created.id).toBeTruthy();
    expect(created.venue).toBe("オンライン Discord");
    expect(created.isOnline).toBe(true);
    expect(created.selfCheckin).toBe(true);
    expect(created.decklistsPublic).toBe(true);
    expect(created.regulation.name).toBe("Custom");
    expect(created.entryCount).toBe(0);

    const registration = await updateTournament({
      id: created.id,
      status: "registration",
      authMode: "mock",
      user,
    });
    expect(registration.status).toBe("registration");
    expect(registration.venue).toBe("オンライン Discord");

    await expect(
      updateTournament({ id: created.id, status: "draft", authMode: "mock", user })
    ).rejects.toThrow("ステータス");
  });

  it("updates organizer entry status and exposes submitted decklists", async () => {
    setRegistrationTournament();
    const deckItems = makeValidDeck();
    const entry = await createEntry({ tournamentId: "t1", deckItems, authMode: "mock", user });

    const checkedIn = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      status: "checked_in",
      authMode: "mock",
    });

    expect(checkedIn.status).toBe("checked_in");
    const entries = await fetchEntries("t1", { authMode: "mock" });
    expect(entries.items[0].deckItems).toHaveLength(50);
  });

  it("generates swiss pairings, reports results, completes rounds, and updates standings", async () => {
    setRegistrationTournament({
      status: "registration",
      swissRounds: null,
      registrationClosesAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    const store = readStore();
    store.entries.t1 = ["1", "2", "3", "4"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      createdAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const round1 = await createNextRound("t1", { authMode: "mock" });
    expect(round1.stage).toBe("swiss");
    expect(round1.matches).toHaveLength(2);
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe("in_progress");

    await reportMatchResult({ matchId: round1.matches[0].id, result: "p1_win", authMode: "mock" });
    await reportMatchResult({ matchId: round1.matches[1].id, result: "p2_win", authMode: "mock" });
    const completedRound1 = await completeRound(round1.id, { authMode: "mock" });
    expect(completedRound1.status).toBe("completed");

    const standings = await fetchStandings("t1", { authMode: "mock" });
    expect(standings.items[0].points).toBe(3);

    const round2 = await createNextRound("t1", { authMode: "mock" });
    expect(round2.number).toBe(2);
    expect(round2.matches).toHaveLength(2);

    const rounds = await fetchRounds("t1", { authMode: "mock" });
    expect(rounds.rounds).toHaveLength(2);
  });

  it("finishes a single elimination tournament when the final round completes", async () => {
    setRegistrationTournament({ status: "registration", format: "single_elim" });
    const store = readStore();
    store.entries.t1 = ["1", "2"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      createdAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const round = await createNextRound("t1", { authMode: "mock" });
    await reportMatchResult({ matchId: round.matches[0].id, result: "p1_win", authMode: "mock" });
    await completeRound(round.id, { authMode: "mock" });

    const tournament = await fetchTournament("t1", { authMode: "mock", user });
    expect(tournament.status).toBe("completed");
  });
});
