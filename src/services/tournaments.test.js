import {
  approveEntry,
  checkInMyEntry,
  completeRound,
  createNextRound,
  createEntry,
  createManualEntry,
  createTournament,
  deleteRound,
  deleteMyEntry,
  fetchEntries,
  fetchMyTournaments,
  fetchRounds,
  fetchRoundsForManage,
  fetchStandings,
  fetchTournament,
  fetchTournaments,
  reportMatchResult,
  rejectEntry,
  startRoundTimer,
  updateEntryStatus,
  updateRoundMatches,
  updateMyEntry,
  updateTournament,
} from "./tournaments";

const STORAGE_KEY = "gundamwar.tournaments.v1";
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const user = {
  id: "test-user",
  name: "非公開の本名",
  email: "private@example.test",
  nickname: "テストニックネーム",
  displayNickname: "表示ニックネーム",
};
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

  it("shows a draft only to its creator while keeping public tournaments visible", async () => {
    setRegistrationTournament();
    const draft = {
      ...readStore().tournaments[0],
      id: "draft-1",
      title: "作成者の下書き大会",
      status: "draft",
      createdBy: { id: user.id, name: user.name },
    };
    const publicTournament = {
      ...draft,
      id: "public-1",
      title: "公開中の大会",
      status: "registration",
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tournaments: [draft, publicTournament],
        entries: { "draft-1": [], "public-1": [] },
        rounds: { "draft-1": [], "public-1": [] },
      })
    );

    const creatorPayload = await fetchTournaments({ authMode: "mock", user });
    const otherUserPayload = await fetchTournaments({
      authMode: "mock",
      user: { ...user, id: "other-user" },
    });
    window.localStorage.removeItem(MOCK_USER_KEY);
    const guestPayload = await fetchTournaments({ authMode: "mock", user: null });

    expect(creatorPayload.items.map((tournament) => tournament.id)).toEqual([
      "draft-1",
      "public-1",
    ]);
    expect(otherUserPayload.items.map((tournament) => tournament.id)).toEqual(["public-1"]);
    expect(guestPayload.items.map((tournament) => tournament.id)).toEqual(["public-1"]);
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
    expect(created.user.name).toBe("表示ニックネーム");
    expect(created.user.name).not.toBe(user.name);
    expect(created.user.name).not.toBe(user.email);
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

  it("uses only the stored nickname for a public player name", async () => {
    setRegistrationTournament();
    window.localStorage.setItem(
      MOCK_USER_KEY,
      JSON.stringify({
        id: "stored-user",
        name: "保存された本名",
        email: "stored-private@example.test",
        nickname: "保存ニックネーム",
      })
    );

    const entry = await createEntry({ tournamentId: "t1", authMode: "mock" });

    expect(entry.user).toEqual({ id: "stored-user", name: "保存ニックネーム" });
    expect(JSON.stringify(entry)).not.toContain("保存された本名");
    expect(JSON.stringify(entry)).not.toContain("stored-private@example.test");
  });

  it("rejects entry without a decklist when the tournament requires it", async () => {
    setRegistrationTournament({ decklistRequired: true });

    await expect(
      createEntry({ tournamentId: "t1", authMode: "mock", user })
    ).rejects.toThrow("デッキリストがレギュレーションに違反しています。");
    expect(readStore().entries.t1).toEqual([]);
  });

  it("allows entry without a decklist when the decklist is optional", async () => {
    setRegistrationTournament({ decklistRequired: false });

    const entry = await createEntry({ tournamentId: "t1", deckItems: [], authMode: "mock", user });

    expect(entry.deckItems).toBeNull();
    expect(entry.decklistSubmittedAt).toBeNull();
  });

  it("rejects updating an entry with an empty decklist", async () => {
    setRegistrationTournament();
    await createEntry({ tournamentId: "t1", authMode: "mock", user });

    await expect(
      updateMyEntry({ tournamentId: "t1", deckItems: [], authMode: "mock", user })
    ).rejects.toThrow("デッキリストがレギュレーションに違反しています。");
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

    expect(standings.items.find((standing) => standing.entryId === "entry-1")).toMatchObject({
      wins: 1,
      losses: 0,
      points: 3,
    });
    expect(standings.items.find((standing) => standing.entryId === "entry-3")).toMatchObject({
      wins: 1,
      losses: 0,
      points: 3,
    });
    expect(standings.items.find((standing) => standing.entryId === "entry-2")).toMatchObject({
      wins: 0,
      losses: 1,
      points: 0,
    });
  });

  it("shows completed round results to third parties during an in-progress tournament", async () => {
    setRegistrationTournament({ status: "in_progress" });
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
    store.rounds.t1 = [
      {
        id: "round-1",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "completed",
        timerStartedAt: null,
        matches: [
          {
            id: "match-1",
            roundId: "round-1",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
          },
          {
            id: "match-2",
            roundId: "round-1",
            tableNo: 2,
            player1EntryId: "entry-3",
            player2EntryId: "entry-4",
            player1Games: 1,
            player2Games: 2,
            result: "p2_win",
          },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const thirdPartyView = await fetchRounds("t1", {
      authMode: "mock",
      user: { id: "spectator", name: "観戦者" },
    });
    expect(thirdPartyView.rounds[0].matches[0]).toMatchObject({
      result: "p1_win",
      player1Games: 2,
      player2Games: 0,
      winnerEntryId: "entry-1",
    });
    expect(thirdPartyView.rounds[0].matches[1]).toMatchObject({
      result: "p2_win",
      player1Games: 1,
      player2Games: 2,
      winnerEntryId: "entry-4",
    });

    window.localStorage.removeItem(MOCK_USER_KEY);
    const guestView = await fetchRounds("t1", { authMode: "mock" });
    expect(guestView.rounds[0].matches[1]).toMatchObject({
      result: "p2_win",
      player1Games: 1,
      player2Games: 2,
      winnerEntryId: "entry-4",
    });
  });

  it("hides in-progress round results and winnerEntryId from third parties", async () => {
    setRegistrationTournament({ status: "in_progress" });
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
    store.rounds.t1 = [
      {
        id: "round-1",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "in_progress",
        timerStartedAt: null,
        matches: [
          {
            id: "match-1",
            roundId: "round-1",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
            winnerEntryId: "entry-1",
          },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const thirdPartyView = await fetchRounds("t1", {
      authMode: "mock",
      user: { id: "spectator", name: "観戦者" },
    });
    expect(thirdPartyView.rounds[0].matches[0]).toMatchObject({
      result: null,
      player1Games: null,
      player2Games: null,
      winnerEntryId: null,
    });

    const participantView = await fetchRounds("t1", {
      authMode: "mock",
      user: { id: "player-1", name: "Player 1" },
    });
    expect(participantView.rounds[0].matches[0]).toMatchObject({
      result: "p1_win",
      winnerEntryId: "entry-1",
    });
  });

  it("recomputes standings at the selected round", async () => {
    setRegistrationTournament({ status: "in_progress" });
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
    store.rounds.t1 = [
      {
        id: "round-1",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          { id: "m1", roundId: "round-1", tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-2", result: "p1_win" },
          { id: "m2", roundId: "round-1", tableNo: 2, player1EntryId: "entry-3", player2EntryId: "entry-4", result: "p1_win" },
        ],
      },
      {
        id: "round-2",
        tournamentId: "t1",
        number: 2,
        stage: "swiss",
        status: "completed",
        matches: [
          { id: "m3", roundId: "round-2", tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-3", result: "p2_win" },
          { id: "m4", roundId: "round-2", tableNo: 2, player1EntryId: "entry-2", player2EntryId: "entry-4", result: "p2_win" },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const round1 = await fetchStandings("t1", { authMode: "mock", round: 1 });
    const latest = await fetchStandings("t1", { authMode: "mock" });

    expect(round1.items.find((standing) => standing.entryId === "entry-1").points).toBe(3);
    expect(latest.items.find((standing) => standing.entryId === "entry-1").points).toBe(3);
    expect(latest.items.find((standing) => standing.entryId === "entry-3").points).toBe(6);
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

  it("derives match results from BO3 game scores", async () => {
    setRegistrationTournament({ status: "registration" });
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
    const match = await reportMatchResult({
      matchId: round.matches[0].id,
      player1Games: 1,
      player2Games: 2,
      authMode: "mock",
    });

    expect(match).toMatchObject({ player1Games: 1, player2Games: 2, result: "p2_win" });
  });

  it("handles late entry pending approval, manual guest entry, and rejection", async () => {
    setRegistrationTournament({ status: "in_progress", lateEntry: true });
    const store = readStore();
    store.rounds.t1 = [{ id: "round-1", tournamentId: "t1", number: 1, stage: "swiss", status: "completed", matches: [] }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const pending = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(pending.status).toBe("pending");
    expect(pending.joinedAtRound).toBe(2);

    const approved = await approveEntry({ tournamentId: "t1", entryId: pending.id, authMode: "mock" });
    expect(approved.status).toBe("registered");
    expect(approved.joinedAtRound).toBe(2);

    const guest = await createManualEntry({ tournamentId: "t1", name: "ゲスト参加者", authMode: "mock" });
    expect(guest.user.id).toBeNull();
    expect(guest.joinedAtRound).toBe(2);

    const secondPending = {
      ...pending,
      id: "pending-2",
      user: { id: "pending-user", name: "Pending" },
      status: "pending",
    };
    const nextStore = readStore();
    nextStore.entries.t1 = [secondPending, ...nextStore.entries.t1];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
    await rejectEntry({ tournamentId: "t1", entryId: "pending-2", authMode: "mock" });
    expect(readStore().entries.t1.map((entry) => entry.id)).not.toContain("pending-2");
  });

  it("returns deck violations when regulation changes and accepts organizer deck updates", async () => {
    setRegistrationTournament({ regulation: { mainMin: 50, mainMax: 50, maxCopies: 3 } });
    const deckItems = makeValidDeck();
    const entry = await createEntry({ tournamentId: "t1", deckItems, authMode: "mock", user });

    const updatedEntry = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      deckItems: buildValidDeck("proxy"),
      authMode: "mock",
    });
    expect(updatedEntry.deckItems[0].cardId).toBe("proxy-1");

    const updatedTournament = await updateTournament({
      id: "t1",
      regulation: { bannedCards: ["proxy 1"] },
      authMode: "mock",
      user,
    });
    expect(updatedTournament.violations).toEqual([
      expect.objectContaining({ entryId: entry.id, violations: expect.any(Array) }),
    ]);
  });

  it("replaces, times, and deletes unfinished round matches with active participant validation", async () => {
    setRegistrationTournament({ status: "registration" });
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

    const round = await createNextRound("t1", { authMode: "mock" });
    await expect(
      updateRoundMatches({
        roundId: round.id,
        matches: [
          { tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-2" },
          { tableNo: 2, player1EntryId: "entry-2", player2EntryId: "entry-3" },
        ],
        authMode: "mock",
      })
    ).rejects.toThrow("複数");

    const replaced = await updateRoundMatches({
      roundId: round.id,
      matches: [
        { tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-4" },
        { tableNo: 2, player1EntryId: "entry-2", player2EntryId: "entry-3" },
      ],
      authMode: "mock",
    });
    expect(replaced.matches[0].player2EntryId).toBe("entry-4");

    const timed = await startRoundTimer(round.id, { timerStartedAt: "2026-07-08T00:00:00.000Z", authMode: "mock" });
    expect(timed.timerStartedAt).toBe("2026-07-08T00:00:00.000Z");

    await deleteRound(round.id, { authMode: "mock" });
    expect((await fetchRounds("t1", { authMode: "mock" })).rounds).toHaveLength(0);
  });

  it("prevents changing format settings after round generation", async () => {
    setRegistrationTournament({ status: "registration", swissRounds: 3 });
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

    await createNextRound("t1", { authMode: "mock" });
    await expect(
      updateTournament({ id: "t1", swissRounds: 4, authMode: "mock", user })
    ).rejects.toThrow("ラウンド生成後");
  });

  it("blocks single elimination result corrections that conflict with later rounds", async () => {
    setRegistrationTournament({ status: "registration", format: "single_elim" });
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
    await reportMatchResult({ matchId: round1.matches[0].id, player1Games: 2, player2Games: 0, authMode: "mock" });
    await reportMatchResult({ matchId: round1.matches[1].id, player1Games: 2, player2Games: 0, authMode: "mock" });
    await completeRound(round1.id, { authMode: "mock" });
    await createNextRound("t1", { authMode: "mock" });

    await expect(
      reportMatchResult({ matchId: round1.matches[0].id, player1Games: 0, player2Games: 2, authMode: "mock" })
    ).rejects.toThrow("後続ラウンドを破棄してください");
  });
});
