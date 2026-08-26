import {
  addTournamentCoOrganizer,
  approveEntry,
  checkInMyEntry,
  completeRound,
  createNextRound,
  createEntry,
  createManualEntry,
  createTournament,
  deleteTournament,
  deleteRound,
  deleteMyEntry,
  fetchEntries,
  fetchMyTournaments,
  fetchRounds,
  fetchRoundsForManage,
  fetchStandings,
  fetchTournament,
  fetchTournamentBans,
  fetchTournaments,
  kickEntry,
  getTournamentPermissions,
  reopenRound,
  reportMatchResult,
  rejectEntry,
  removeTournamentCoOrganizer,
  startRoundTimer,
  updateEntryStatus,
  updateRoundMatches,
  updateMyEntry,
  updateTournament,
  unbanTournamentUser,
} from "./tournaments";
import { fetchPublicDeck, fetchPublicDecks } from "./publicDecks";
import { USERS_STORAGE_KEY } from "./users";

const STORAGE_KEY = "gundamwar.tournaments.v1";
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const user = {
  id: "test-user",
  name: "非公開の本名",
  email: "private@example.test",
  nickname: "テストニックネーム",
  displayNickname: "表示ニックネーム",
};
const organizer = {
  id: "org",
  name: "主催者",
  role: "organizer",
};
const coOrganizer = {
  id: "co-org",
  name: "共同運営者",
  role: "user",
};
const participant = {
  id: "participant",
  name: "一般参加者",
  role: "user",
};
const admin = {
  id: "admin-user",
  name: "管理者",
  role: "admin",
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
          checkinOpensAt: null,
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
  window.localStorage.setItem(MOCK_USER_KEY, JSON.stringify(organizer));
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

function makeResultRound(number, status, result = "p1_win") {
  const roundId = `round-${number}`;
  return {
    id: roundId,
    tournamentId: "t1",
    number,
    stage: "swiss",
    status,
    timerStartedAt: null,
    matches: [
      {
        id: `match-${number}`,
        roundId,
        tableNo: 1,
        player1EntryId: "entry-1",
        player2EntryId: "entry-2",
        player1Games: result === "p1_win" ? 2 : 0,
        player2Games: result === "p2_win" ? 2 : 0,
        result,
      },
    ],
  };
}

function setRoundRollbackTournament(rounds, status = "in_progress") {
  setRegistrationTournament({ status, swissRounds: 4 });
  const store = readStore();
  store.entries.t1 = ["1", "2"].map((suffix) => ({
    id: `entry-${suffix}`,
    tournamentId: "t1",
    user: { id: `player-${suffix}`, name: `Player ${suffix}` },
    deckItems: null,
    decklistSubmittedAt: null,
    status: "checked_in",
    joinedAtRound: 1,
    createdAt: new Date().toISOString(),
  }));
  store.rounds.t1 = rounds;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function setManagementAuthorizationTournament() {
  setRegistrationTournament({
    status: "in_progress",
    swissRounds: 3,
    roundTimeMinutes: 30,
    coOrganizers: [{ id: coOrganizer.id, name: coOrganizer.name }],
  });
  const store = readStore();
  const now = new Date().toISOString();
  store.entries.t1 = [
    {
      id: "entry-1",
      tournamentId: "t1",
      user: { id: "player-1", name: "Player 1" },
      deckItems: buildValidDeck("secret"),
      decklistSubmittedAt: now,
      deckLockedAt: now,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    },
    {
      id: "entry-2",
      tournamentId: "t1",
      user: { id: "player-2", name: "Player 2" },
      deckItems: null,
      decklistSubmittedAt: null,
      deckLockedAt: null,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    },
    {
      id: "entry-pending-approve",
      tournamentId: "t1",
      user: { id: "pending-approve", name: "承認待ち1" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "pending",
      joinedAtRound: 2,
      createdAt: now,
    },
    {
      id: "entry-pending-reject",
      tournamentId: "t1",
      user: { id: "pending-reject", name: "承認待ち2" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "pending",
      joinedAtRound: 2,
      createdAt: now,
    },
    {
      id: "entry-kick",
      tournamentId: "t1",
      user: { id: "kick-user", name: "キック対象" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "registered",
      joinedAtRound: 1,
      createdAt: now,
    },
  ];
  store.rounds.t1 = [
    {
      id: "round-auth",
      tournamentId: "t1",
      number: 1,
      stage: "swiss",
      status: "completed",
      timerStartedAt: null,
      matches: [
        {
          id: "match-auth",
          roundId: "round-auth",
          tableNo: 1,
          player1EntryId: "entry-1",
          player2EntryId: "entry-2",
          player1Games: 2,
          player2Games: 0,
          result: "p1_win",
        },
      ],
    },
  ];
  store.bans = {
    t1: [{ user: { id: "banned-user", name: "禁止対象" }, bannedAt: now }],
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function makeCheckedInEntries(count, { startAt = 1, joinedAtRound = 1 } = {}) {
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, index) => {
    const number = startAt + index;
    return {
      id: `entry-${number}`,
      tournamentId: "t1",
      user: { id: `player-${number}`, name: `Player ${number}` },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      joinedAtRound,
      createdAt: now,
    };
  });
}

function seedCheckedInSwissTournament(entryCount, overrides = {}) {
  setRegistrationTournament({ status: "registration", swissRounds: 3, ...overrides });
  const store = readStore();
  store.entries.t1 = makeCheckedInEntries(entryCount);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

async function reportOpenRoundMatches(round, resultForMatch = () => "p1_win") {
  for (const match of round.matches || []) {
    if (match.result) continue;
    await reportMatchResult({
      matchId: match.id,
      result: resultForMatch(match),
      authMode: "mock",
    });
  }
}

async function undefeatedEntryIds() {
  const standings = await fetchStandings("t1", { authMode: "mock" });
  return standings.items
    .filter((standing) => standing.losses === 0 && standing.draws === 0)
    .map((standing) => standing.entryId);
}

async function prepareTwoSwissRoundsWithOneUndefeated(overrides = {}) {
  seedCheckedInSwissTournament(8, overrides);

  const round1 = await createNextRound("t1", { authMode: "mock" });
  await reportOpenRoundMatches(round1);
  await completeRound(round1.id, { authMode: "mock" });
  const statusAfterRound1 = (await fetchTournament("t1", { authMode: "mock", user })).status;
  const firstRoundWinners = new Set(
    round1.matches.map((match) => match.player1EntryId)
  );
  const survivorEntryId = firstRoundWinners.values().next().value;

  const round2 = await createNextRound("t1", { authMode: "mock" });
  let recovery = null;
  await reportOpenRoundMatches(round2, (match) => {
    if (match.player1EntryId === survivorEntryId) return "p1_win";
    if (match.player2EntryId === survivorEntryId) return "p2_win";

    const formerUndefeatedEntryId = [match.player1EntryId, match.player2EntryId].find(
      (entryId) => firstRoundWinners.has(entryId)
    );
    if (formerUndefeatedEntryId) {
      if (!recovery) {
        recovery = {
          matchId: match.id,
          result:
            match.player1EntryId === formerUndefeatedEntryId ? "p1_win" : "p2_win",
        };
      }
      return "draw";
    }
    return "p1_win";
  });

  return { recovery, round1, round2, statusAfterRound1, survivorEntryId };
}

describe("tournaments service mock mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = originalFetch;
    setMockUser();
  });

  afterEach(() => {
    jest.useRealTimers();
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
      lateEntry: true,
      entryCount: 4,
    });
    expect(payload.items.find((tournament) => tournament.id === "mock-tournament-2")).toMatchObject({
      venue: null,
      isOnline: true,
      selfCheckin: true,
      decklistsPublic: false,
    });
    expect(payload.items.find((tournament) => tournament.id === "mock-tournament-3")).toMatchObject({
      title: "完了済みスタンダード杯",
      status: "completed",
      decklistsPublic: true,
      entryCount: 4,
    });
  });

  it("seeds none, submitted, locked, and organizer-unlocked decklist examples", async () => {
    const payload = await fetchEntries("mock-tournament-1", {
      authMode: "mock",
      user: { id: "organizer-1", role: "organizer" },
    });
    const entries = payload.items;

    expect(entries.map((entry) => entry.decklistState)).toEqual(
      expect.arrayContaining(["none", "submitted", "locked"])
    );
    expect(entries.find((entry) => entry.decklistState === "none")).toMatchObject({
      id: "entry-1",
      deckItems: null,
      decklistSubmittedAt: null,
    });
    expect(entries.find((entry) => entry.decklistState === "locked")).toMatchObject({
      id: "entry-3",
      deckFormat: "スタンダード",
    });
    expect(entries.find((entry) => entry.id === "entry-4")).toMatchObject({
      decklistState: "submitted",
      deckFormat: "スタンダード",
      deckLockedAt: null,
      deckUnlockedAt: null,
      status: "registered",
      joinedAtRound: 2,
    });

    const unlocked = entries.find((entry) => entry.deckUnlockedAt);
    expect(unlocked).toMatchObject({
      id: "entry-2",
      decklistState: "submitted",
      deckFormat: "スタンダード",
      deckLockedAt: null,
      deckUnlockedBy: { id: "organizer-1", name: "ローカル主催者" },
      status: "checked_in",
    });
    expect(unlocked.deckItems).toHaveLength(17);
  });

  it("migrates legacy seed data in place while preserving user-created tournaments", async () => {
    await fetchTournaments({ authMode: "mock" });
    const legacyStore = readStore();
    delete legacyStore.seedVersion;
    legacyStore.tournaments = legacyStore.tournaments
      .filter((tournament) => tournament.id !== "mock-tournament-3")
      .map((tournament) =>
        tournament.id === "mock-tournament-1"
          ? { ...tournament, lateEntry: false, entryCount: 3 }
          : tournament
      );
    legacyStore.tournaments.push({
      ...legacyStore.tournaments.find((tournament) => tournament.id === "mock-tournament-2"),
      id: "user-created-tournament",
      title: "利用者作成大会",
    });
    legacyStore.entries["mock-tournament-1"] = legacyStore.entries["mock-tournament-1"]
      .filter((entry) => entry.id !== "entry-4")
      .map((entry) => ({
        ...entry,
        deckItems: null,
        decklistSubmittedAt: null,
        deckFormat: null,
        deckUnlockedBy: null,
        deckUnlockedAt: null,
      }));
    delete legacyStore.entries["mock-tournament-3"];
    delete legacyStore.rounds["mock-tournament-3"];
    legacyStore.entries["user-created-tournament"] = [];
    legacyStore.rounds["user-created-tournament"] = [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyStore));

    await fetchTournaments({ authMode: "mock" });
    const migratedStore = readStore();
    const serializedAfterMigration = window.localStorage.getItem(STORAGE_KEY);

    expect(migratedStore.seedVersion).toBe(3);
    expect(migratedStore.tournaments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "mock-tournament-3", status: "completed" }),
        expect.objectContaining({ id: "user-created-tournament", title: "利用者作成大会" }),
      ])
    );
    expect(migratedStore.entries["mock-tournament-1"].map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["entry-1", "entry-2", "entry-3", "entry-4"])
    );
    expect(migratedStore.rounds["mock-tournament-1"]).toEqual(legacyStore.rounds["mock-tournament-1"]);

    await fetchTournaments({ authMode: "mock" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(serializedAfterMigration);
  });

  it("seeds a coherent completed tournament with ranked locked decklists and results", async () => {
    const tournament = await fetchTournament("mock-tournament-3", { authMode: "mock" });
    const rounds = await fetchRounds("mock-tournament-3", { authMode: "mock" });
    const standings = await fetchStandings("mock-tournament-3", { authMode: "mock" });
    const entryIds = new Set(tournament.entries.map((entry) => entry.id));

    expect(tournament).toMatchObject({
      status: "completed",
      decklistsPublic: true,
      entryCount: 4,
    });
    expect(new Date(tournament.startsAt).getTime()).toBeLessThanOrEqual(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    );
    expect(tournament.entries.map((entry) => entry.finalRank)).toEqual([1, 2, 3, 4]);
    tournament.entries.forEach((entry) => {
      expect(entry).toMatchObject({
        decklistState: "revealed",
        deckFormat: "スタンダード",
        status: "checked_in",
      });
      expect(entry.decklistSubmittedAt).toBeTruthy();
      expect(entry.deckLockedAt).toBeTruthy();
      expect(entry.deckItems).toHaveLength(17);
      expect(entry.deckItems.reduce((sum, item) => sum + item.count, 0)).toBe(50);
      expect(entry.deckItems.every((item) => /^\d{9}$/.test(item.cardId))).toBe(true);
      expect(entry.deckItems.every((item) => item.card?.card_type_name)).toBe(true);
    });

    expect(rounds.rounds).toHaveLength(3);
    rounds.rounds.forEach((round) => {
      expect(round.status).toBe("completed");
      expect(round.matches).toHaveLength(2);
      round.matches.forEach((match) => {
        expect(entryIds.has(match.player1EntryId)).toBe(true);
        expect(entryIds.has(match.player2EntryId)).toBe(true);
        expect(match.result).toBe("p1_win");
      });
    });
    expect(standings.items.map((standing) => standing.entryId)).toEqual([
      "completed-entry-1",
      "completed-entry-2",
      "completed-entry-3",
      "completed-entry-4",
    ]);
    expect(standings.items.map((standing) => standing.points)).toEqual([9, 6, 3, 0]);
  });

  it("initializes and publishes seeded tournament decks with tournament metadata", async () => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const payload = await fetchPublicDecks({ authMode: "mock" });
    const tournamentDecks = payload.items.filter(
      (deck) => deck.tournament?.id === "mock-tournament-3"
    );
    const winner = tournamentDecks.find((deck) => deck.sourceId === "completed-entry-1");

    expect(tournamentDecks).toHaveLength(4);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    expect(winner).toMatchObject({
      id: "entry:completed-entry-1",
      sourceType: "tournament",
      title: "決勝参加者1の大会デッキ",
      format: "スタンダード",
      finalRank: 1,
      participantCount: 4,
      tournament: {
        id: "mock-tournament-3",
        title: "完了済みスタンダード杯",
        finalRank: 1,
        participantCount: 4,
      },
    });

    const detail = await fetchPublicDeck(winner.id, { authMode: "mock" });
    expect(detail).toMatchObject({
      id: "entry:completed-entry-1",
      finalRank: 1,
      participantCount: 4,
      tournament: { title: "完了済みスタンダード杯" },
    });
    expect(detail.items.reduce((sum, item) => sum + item.count, 0)).toBe(50);
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

  it("filters unlisted tournaments before paging and treats a missing isListed flag as listed", async () => {
    setRegistrationTournament();
    const store = readStore();
    const legacyTournament = store.tournaments[0];
    const listedTournaments = [
      legacyTournament,
      ...Array.from({ length: 11 }, (_, index) => ({
        ...legacyTournament,
        id: `listed-${index + 1}`,
        title: `掲載大会${index + 1}`,
        isListed: true,
        startsAt: `2030-01-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      })),
    ];
    const unlistedTournaments = Array.from({ length: 3 }, (_, index) => ({
      ...legacyTournament,
      id: `unlisted-${index + 1}`,
      title: `URL限定大会${index + 1}`,
      isListed: false,
      startsAt: `2031-01-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
    store.tournaments = [...unlistedTournaments, ...listedTournaments];
    [...unlistedTournaments, ...listedTournaments].forEach((tournament) => {
      store.entries[tournament.id] = [];
      store.rounds[tournament.id] = [];
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const firstPage = await fetchTournaments({
      authMode: "mock",
      page: 1,
      user: participant,
    });
    const secondPage = await fetchTournaments({
      authMode: "mock",
      page: 2,
      user: participant,
    });
    const visibleItems = [...firstPage.items, ...secondPage.items];

    expect(firstPage.items).toHaveLength(10);
    expect(secondPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(12);
    expect(secondPage.total).toBe(12);
    expect(new Set(visibleItems.map((tournament) => tournament.id)).size).toBe(12);
    expect(visibleItems.every((tournament) => tournament.isListed)).toBe(true);
    expect(visibleItems.find((tournament) => tournament.id === "t1")?.isListed).toBe(true);
    expect(visibleItems.some((tournament) => tournament.id.startsWith("unlisted-"))).toBe(false);
  });

  it("shows an unlisted tournament only to its creator and co-organizers in the public list", async () => {
    setRegistrationTournament({
      isListed: false,
      coOrganizers: [{ id: coOrganizer.id, name: coOrganizer.name }],
    });

    const participantPayload = await fetchTournaments({
      authMode: "mock",
      user: participant,
    });
    const creatorPayload = await fetchTournaments({
      authMode: "mock",
      user: organizer,
    });
    const coOrganizerPayload = await fetchTournaments({
      authMode: "mock",
      user: coOrganizer,
    });

    expect(participantPayload.items).toEqual([]);
    expect(creatorPayload.items.map((tournament) => tournament.id)).toEqual(["t1"]);
    expect(coOrganizerPayload.items.map((tournament) => tournament.id)).toEqual(["t1"]);
  });

  it("allows direct access and entry for an unlisted tournament and exposes it only in related users' own list", async () => {
    setRegistrationTournament({ isListed: false });
    const unrelatedOrganizer = {
      id: "unrelated-organizer",
      name: "無関係な主催者",
      role: "organizer",
    };

    const directDetail = await fetchTournament("t1", {
      authMode: "mock",
      user: unrelatedOrganizer,
    });
    expect(directDetail).toMatchObject({ id: "t1", isListed: false });

    const entry = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(entry).toMatchObject({ tournamentId: "t1", user: { id: user.id } });

    const participantPayload = await fetchMyTournaments({ authMode: "mock", user });
    expect(participantPayload.items).toEqual([
      expect.objectContaining({
        tournament: expect.objectContaining({ id: "t1", isListed: false }),
        entry: expect.objectContaining({ id: entry.id, user: { id: user.id, name: "表示ニックネーム" } }),
      }),
    ]);

    const creatorPayload = await fetchMyTournaments({ authMode: "mock", user: organizer });
    expect(creatorPayload.items).toEqual([
      expect.objectContaining({
        tournament: expect.objectContaining({ id: "t1", isListed: false }),
        entry: null,
        needsDecklist: false,
      }),
    ]);

    const unrelatedPayload = await fetchMyTournaments({
      authMode: "mock",
      user: unrelatedOrganizer,
    });
    expect(unrelatedPayload.items).toEqual([]);
  });

  it("defaults created tournaments to listed and preserves explicit isListed values on create and update", async () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    const listedByDefault = await createTournament({
      title: "既定の掲載大会",
      authMode: "mock",
      user,
    });

    jest.setSystemTime(new Date("2030-01-01T00:00:00.001Z"));
    const createdUnlisted = await createTournament({
      title: "作成時からURL限定",
      isListed: false,
      authMode: "mock",
      user,
    });

    expect(listedByDefault.isListed).toBe(true);
    expect(createdUnlisted.isListed).toBe(false);

    const updatedUnlisted = await updateTournament({
      id: listedByDefault.id,
      isListed: false,
      authMode: "mock",
      user,
    });
    const updatedListed = await updateTournament({
      id: createdUnlisted.id,
      isListed: true,
      authMode: "mock",
      user,
    });

    expect(updatedUnlisted.isListed).toBe(false);
    expect(updatedListed.isListed).toBe(true);
    expect(
      readStore().tournaments.find((tournament) => tournament.id === listedByDefault.id)?.isListed
    ).toBe(false);
    expect(
      readStore().tournaments.find((tournament) => tournament.id === createdUnlisted.id)?.isListed
    ).toBe(true);
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
    expect(hidden.entries[0]).toMatchObject({
      deckFormat: null,
      decklistState: "submitted",
      deckLockedAt: null,
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: null,
      deckUnlockedAt: null,
      finalRank: null,
    });

    store.tournaments[0].decklistsPublic = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    const visible = await fetchTournament("t1", { authMode: "mock", user });
    expect(visible.entries[0].deckItems).toEqual(deckItems);
    expect(visible.entries[0].decklistState).toBe("revealed");
  });

  it("keeps a completed non-public decklist locked", async () => {
    setRegistrationTournament({ status: "completed", decklistsPublic: false });
    const lockedAt = new Date().toISOString();
    const store = readStore();
    store.entries.t1 = [
      {
        id: "locked-entry",
        tournamentId: "t1",
        user: { id: "other-user", name: "別プレイヤー" },
        deckItems: buildValidDeck("locked"),
        decklistSubmittedAt: lockedAt,
        deckLockedAt: lockedAt,
        status: "checked_in",
        createdAt: lockedAt,
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const tournament = await fetchTournament("t1", { authMode: "mock", user });
    expect(tournament.entries[0].deckItems).toBeNull();
    expect(tournament.entries[0].decklistState).toBe("locked");
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
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
    const today = new Date(2026, 7, 26, 18, 0).toISOString();
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
    expect(checkedIn.deckLockedAt).toBeTruthy();
    expect(checkedIn.decklistState).toBe("none");
    expect(readStore().entries.t1[0].status).toBe("checked_in");
    expect(readStore().entries.t1[0].deckLockedAt).toBe(checkedIn.deckLockedAt);
    expect(readStore().entries.t1[0].decklistState).toBeUndefined();
    await expect(
      updateMyEntry({
        tournamentId: "t1",
        deckItems: buildValidDeck("after-checkin"),
        authMode: "mock",
        user,
      })
    ).rejects.toThrow("デッキリストはロックされています");
  });

  it("transitions a decklist through submit, lock, organizer update, unlock, and automatic relock", async () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
    const today = new Date(2026, 7, 26, 18, 0).toISOString();
    setRegistrationTournament({ startsAt: today, selfCheckin: true });

    const none = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(none).toMatchObject({
      decklistState: "none",
      deckFormat: null,
      deckLockedAt: null,
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: null,
      deckUnlockedAt: null,
      finalRank: null,
    });

    const submitted = await updateMyEntry({
      tournamentId: "t1",
      deckItems: buildValidDeck("submitted"),
      authMode: "mock",
      user,
    });
    expect(submitted.decklistState).toBe("submitted");
    expect(submitted.deckFormat).toBe("スタンダード");

    const locked = await checkInMyEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(locked.decklistState).toBe("locked");
    expect(locked.deckLockedAt).toBeTruthy();
    const firstLockedAt = locked.deckLockedAt;

    await expect(
      updateMyEntry({
        tournamentId: "t1",
        deckItems: buildValidDeck("blocked"),
        authMode: "mock",
        user,
      })
    ).rejects.toThrow("デッキリストはロックされています");

    const organizerUpdated = await updateEntryStatus({
      tournamentId: "t1",
      entryId: none.id,
      deckItems: buildValidDeck("organizer"),
      authMode: "mock",
      user: organizer,
    });
    expect(organizerUpdated.deckItems[0].cardId).toBe("organizer-1");
    expect(organizerUpdated.deckLockedAt).toBe(firstLockedAt);
    expect(organizerUpdated.deckUpdatedBy).toEqual({ id: organizer.id, name: organizer.name });
    expect(organizerUpdated.deckUpdatedAt).toBeTruthy();

    const unlocked = await updateEntryStatus({
      tournamentId: "t1",
      entryId: none.id,
      decklistLocked: false,
      authMode: "mock",
      user: organizer,
    });
    expect(unlocked.decklistState).toBe("submitted");
    expect(unlocked.deckLockedAt).toBeNull();
    expect(unlocked.deckUnlockedBy).toEqual({ id: organizer.id, name: organizer.name });
    expect(unlocked.deckUnlockedAt).toBeTruthy();

    const relocked = await updateMyEntry({
      tournamentId: "t1",
      deckItems: buildValidDeck("resubmitted"),
      authMode: "mock",
      user,
    });
    expect(relocked.deckItems[0].cardId).toBe("resubmitted-1");
    expect(relocked.decklistState).toBe("locked");
    expect(relocked.deckLockedAt).toBeTruthy();
    expect(relocked.deckUnlockedBy).toEqual({ id: organizer.id, name: organizer.name });
    expect(relocked.deckUnlockedAt).toBe(unlocked.deckUnlockedAt);
  });

  it("rejects self check-in when disabled, not on the day, or after rounds exist", async () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
    const today = new Date(2026, 7, 26, 18, 0).toISOString();
    const tomorrow = new Date(2026, 7, 27, 18, 0).toISOString();
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

  it("uses a configured check-in opening time without restricting self check-in to the tournament day", async () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
    const checkinOpensAt = new Date(2026, 7, 26, 11, 0).toISOString();
    const startsAt = new Date(2026, 7, 27, 10, 0).toISOString();
    setRegistrationTournament({ startsAt, checkinOpensAt, selfCheckin: true });
    const entry = {
      id: "my-entry",
      tournamentId: "t1",
      user,
      deckItems: null,
      decklistSubmittedAt: null,
      status: "registered",
      createdAt: new Date().toISOString(),
    };
    let store = readStore();
    store.entries.t1 = [entry];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    await expect(checkInMyEntry({ tournamentId: "t1", authMode: "mock", user })).rejects.toThrow(
      "セルフチェックインは8月26日 11:00から利用できます。"
    );
    expect(readStore().entries.t1[0]).toMatchObject({ status: "registered" });
    expect(readStore().entries.t1[0].deckLockedAt).toBeUndefined();

    jest.setSystemTime(new Date(2026, 7, 26, 11, 0));
    const checkedIn = await checkInMyEntry({ tournamentId: "t1", authMode: "mock", user });

    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.deckLockedAt).toBe(new Date(2026, 7, 26, 11, 0).toISOString());
    store = readStore();
    expect(store.entries.t1[0].status).toBe("checked_in");

    setRegistrationTournament({ startsAt, checkinOpensAt, selfCheckin: true });
    store = readStore();
    store.entries.t1 = [entry];
    store.rounds.t1 = [
      { id: "round-1", tournamentId: "t1", number: 1, stage: "swiss", matches: [] },
    ];
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

  it("does not expose submitted decklists through standings", async () => {
    setRegistrationTournament({ status: "in_progress" });
    const store = readStore();
    store.entries.t1 = [
      {
        id: "secret-entry",
        tournamentId: "t1",
        user: { id: "secret-player", name: "非公開プレイヤー" },
        deckItems: [
          {
            cardId: "secret-card",
            count: 1,
            card: { cardId: "secret-card", name: "非公開カード" },
            zone: "main",
          },
        ],
        decklistSubmittedAt: new Date().toISOString(),
        status: "checked_in",
        createdAt: new Date().toISOString(),
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const standings = await fetchStandings("t1", { authMode: "mock" });

    expect(standings.items[0].entry).toMatchObject({
      id: "secret-entry",
      deckItems: null,
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

  it("keeps top-cut results out of swiss standings", async () => {
    setRegistrationTournament({ status: "completed", swissRounds: 1, topCutSize: 4 });
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
          { id: "swiss-1", roundId: "round-1", tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-2", result: "p1_win" },
          { id: "swiss-2", roundId: "round-1", tableNo: 2, player1EntryId: "entry-3", player2EntryId: "entry-4", result: "p1_win" },
        ],
      },
      {
        id: "round-2",
        tournamentId: "t1",
        number: 2,
        stage: "top_cut",
        status: "completed",
        matches: [
          { id: "se-1", roundId: "round-2", tableNo: 1, player1EntryId: "entry-1", player2EntryId: "entry-2", result: "p2_win" },
          { id: "se-2", roundId: "round-2", tableNo: 2, player1EntryId: "entry-3", player2EntryId: "entry-4", result: "p2_win" },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const latest = await fetchStandings("t1", { authMode: "mock" });
    const throughTopCutRound = await fetchStandings("t1", { authMode: "mock", round: 2 });

    [latest, throughTopCutRound].forEach((payload) => {
      expect(payload.items.find((standing) => standing.entryId === "entry-1")).toMatchObject({
        wins: 1,
        losses: 0,
        points: 3,
      });
      expect(payload.items.find((standing) => standing.entryId === "entry-2")).toMatchObject({
        wins: 0,
        losses: 1,
        points: 0,
      });
    });
  });

  it("creates and updates organizer tournaments with forward status transitions", async () => {
    const startsAt = "2030-01-02T10:00:00.000Z";
    const checkinOpensAt = "2030-01-02T09:00:00.000Z";
    const created = await createTournament({
      title: "Organizer Cup",
      description: "test",
      format: "swiss",
      swissRounds: null,
      swissEndCondition: "undefeated",
      topCutSize: null,
      status: "draft",
      startsAt,
      checkinOpensAt,
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
    expect(created.checkinOpensAt).toBe(checkinOpensAt);
    expect(created.swissEndCondition).toBe("undefeated");
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
    expect(registration.checkinOpensAt).toBe(checkinOpensAt);
    expect(registration.swissEndCondition).toBe("undefeated");

    await expect(
      updateTournament({ id: created.id, status: "draft", authMode: "mock", user })
    ).rejects.toThrow("ステータス");
  });

  it("rejects a check-in opening time later than the tournament start on create and update", async () => {
    const startsAt = "2030-01-02T10:00:00.000Z";
    const invalidCheckinOpensAt = "2030-01-02T10:01:00.000Z";

    await expect(
      createTournament({
        title: "Invalid Check-in Cup",
        startsAt,
        checkinOpensAt: invalidCheckinOpensAt,
        authMode: "mock",
        user,
      })
    ).rejects.toThrow("チェックイン開始は大会の開始日時以前に設定してください。");

    const sameTime = await createTournament({
      title: "Same-time Check-in Cup",
      startsAt,
      checkinOpensAt: startsAt,
      authMode: "mock",
      user,
    });
    expect(sameTime.checkinOpensAt).toBe(startsAt);

    const created = await createTournament({
      title: "Valid Check-in Cup",
      startsAt,
      checkinOpensAt: "2030-01-02T09:00:00.000Z",
      authMode: "mock",
      user,
    });
    await expect(
      updateTournament({
        id: created.id,
        checkinOpensAt: invalidCheckinOpensAt,
        authMode: "mock",
        user,
      })
    ).rejects.toThrow("チェックイン開始は大会の開始日時以前に設定してください。");
    await expect(
      updateTournament({
        id: created.id,
        startsAt: "2030-01-02T08:59:00.000Z",
        authMode: "mock",
        user,
      })
    ).rejects.toThrow("チェックイン開始は大会の開始日時以前に設定してください。");
  });

  it("updates organizer entry status and exposes submitted decklists", async () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(new Date(2026, 7, 26, 10, 0));
    setRegistrationTournament({
      startsAt: new Date(2026, 7, 26, 18, 0).toISOString(),
      checkinOpensAt: new Date(2026, 7, 26, 12, 0).toISOString(),
    });
    const deckItems = makeValidDeck();
    const entry = await createEntry({ tournamentId: "t1", deckItems, authMode: "mock", user });

    const checkedIn = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      status: "checked_in",
      authMode: "mock",
      user: organizer,
    });

    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.decklistState).toBe("locked");
    expect(checkedIn.deckLockedAt).toBeTruthy();
    const lockedAt = checkedIn.deckLockedAt;

    const checkInCancelled = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      status: "registered",
      authMode: "mock",
      user: organizer,
    });
    expect(checkInCancelled.deckLockedAt).toBe(lockedAt);
    expect(checkInCancelled.decklistState).toBe("locked");
    const entries = await fetchEntries("t1", { authMode: "mock", user: organizer });
    expect(entries.items[0].deckItems).toHaveLength(50);
  });

  it("allows the tournament creator regardless of role or an admin to manage raw entries", async () => {
    setRegistrationTournament();
    const deckItems = [{ cardId: "secret", count: 1, zone: "main" }];
    const admin = { id: "admin-user", name: "管理者", role: "admin" };
    const store = readStore();
    store.entries.t1 = [
      {
        id: "entry-secret",
        tournamentId: "t1",
        user: { id: "player-secret", name: "参加者" },
        deckItems,
        decklistSubmittedAt: new Date().toISOString(),
        deckLockedAt: new Date().toISOString(),
        status: "registered",
        createdAt: new Date().toISOString(),
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const creatorView = await fetchEntries("t1", { authMode: "mock", user: organizer });
    const adminView = await fetchEntries("t1", {
      authMode: "mock",
      user: admin,
    });
    expect(creatorView.items[0].deckItems).toEqual(deckItems);
    expect(adminView.items[0].deckItems).toEqual(deckItems);

    const adminUpdated = await updateEntryStatus({
      tournamentId: "t1",
      entryId: "entry-secret",
      deckItems: buildValidDeck("admin-update"),
      authMode: "mock",
      user: admin,
    });
    expect(adminUpdated.deckUpdatedBy).toEqual({ id: admin.id, name: admin.name });

    await expect(
      fetchEntries("t1", {
        authMode: "mock",
        user: { id: "other-organizer", name: "別の主催者", role: "organizer" },
      })
    ).rejects.toMatchObject({
      message: "この大会を管理する権限がありません。",
      status: 403,
    });
    await expect(
      fetchEntries("t1", {
        authMode: "mock",
        user: { id: "org", name: "一般ユーザー", role: "user" },
      })
    ).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: "entry-secret",
        status: "checked_in",
        authMode: "mock",
        user: { id: "other-organizer", name: "別の主催者", role: "organizer" },
      })
    ).rejects.toMatchObject({
      message: "この大会を管理する権限がありません。",
      status: 403,
    });
    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: "entry-secret",
        decklistLocked: false,
        authMode: "mock",
        user: { id: "regular-user", name: "一般ユーザー", role: "user" },
      })
    ).rejects.toMatchObject({
      message: "この大会を管理する権限がありません。",
      status: 403,
    });

    window.localStorage.removeItem(MOCK_USER_KEY);
    await expect(fetchEntries("t1", { authMode: "mock" })).rejects.toMatchObject({
      message: "ログインしてから操作してください。",
      status: 401,
    });
    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: "entry-secret",
        status: "checked_in",
        authMode: "mock",
      })
    ).rejects.toMatchObject({
      message: "ログインしてから操作してください。",
      status: 401,
    });
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

  it("locks automatic swiss rounds on the first generation even when a late entrant increases attendance", async () => {
    seedCheckedInSwissTournament(4, { swissRounds: null });

    const round1 = await createNextRound("t1", { authMode: "mock" });
    expect(readStore().tournaments[0].swissRounds).toBe(2);
    expect(await fetchTournament("t1", { authMode: "mock", user })).toMatchObject({
      swissRounds: 2,
      swissEndCondition: "fixed_rounds",
    });

    const storeWithLateEntry = readStore();
    storeWithLateEntry.entries.t1.push(
      ...makeCheckedInEntries(1, { startAt: 5, joinedAtRound: 2 })
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storeWithLateEntry));

    await reportOpenRoundMatches(round1);
    await completeRound(round1.id, { authMode: "mock" });
    const round2 = await createNextRound("t1", { authMode: "mock" });
    expect(round2.stage).toBe("swiss");
    expect(
      round2.matches.flatMap((match) => [match.player1EntryId, match.player2EntryId])
    ).toContain("entry-5");

    await reportOpenRoundMatches(round2);
    await completeRound(round2.id, { authMode: "mock" });

    const completedStore = readStore();
    expect(completedStore.tournaments[0]).toMatchObject({
      swissRounds: 2,
      status: "completed",
    });
    expect(completedStore.rounds.t1).toHaveLength(2);
  });

  it("ends swiss early when one or fewer undefeated players remain", async () => {
    const { round2, statusAfterRound1, survivorEntryId } =
      await prepareTwoSwissRoundsWithOneUndefeated({
        swissEndCondition: "undefeated",
      });

    expect(statusAfterRound1).toBe("in_progress");
    expect(await undefeatedEntryIds()).toEqual([survivorEntryId]);

    await completeRound(round2.id, { authMode: "mock" });

    expect(await fetchTournament("t1", { authMode: "mock", user })).toMatchObject({
      status: "completed",
      swissRounds: 3,
      swissEndCondition: "undefeated",
    });
    expect((await fetchRounds("t1", { authMode: "mock" })).rounds).toHaveLength(2);
  });

  it("moves an early-ended swiss stage into top cut and completes the bracket", async () => {
    const { round2 } = await prepareTwoSwissRoundsWithOneUndefeated({
      swissEndCondition: "undefeated",
      topCutSize: 4,
    });

    await completeRound(round2.id, { authMode: "mock" });
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "in_progress"
    );

    const semifinal = await createNextRound("t1", { authMode: "mock" });
    expect(semifinal).toMatchObject({ stage: "top_cut" });
    expect(semifinal.matches).toHaveLength(2);
    await reportOpenRoundMatches(semifinal);
    await completeRound(semifinal.id, { authMode: "mock" });

    const final = await createNextRound("t1", { authMode: "mock" });
    expect(final).toMatchObject({ stage: "top_cut" });
    expect(final.matches).toHaveLength(1);
    await reportOpenRoundMatches(final);
    await completeRound(final.id, { authMode: "mock" });

    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "completed"
    );
  });

  it("treats legacy tournaments without an ending condition as fixed rounds", async () => {
    const { round2 } = await prepareTwoSwissRoundsWithOneUndefeated();
    expect((await fetchTournament("t1", { authMode: "mock", user })).swissEndCondition).toBe(
      "fixed_rounds"
    );
    expect(await undefeatedEntryIds()).toHaveLength(1);

    await completeRound(round2.id, { authMode: "mock" });
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "in_progress"
    );

    const round3 = await createNextRound("t1", { authMode: "mock" });
    expect(round3).toMatchObject({ number: 3, stage: "swiss" });
  });

  it("generates pairings with only checked-in entries eligible for the next round", async () => {
    setRegistrationTournament({ status: "in_progress", swissRounds: 3 });
    const store = readStore();
    const now = new Date().toISOString();
    store.entries.t1 = [
      { id: "checked-1", status: "checked_in", joinedAtRound: 1 },
      { id: "checked-2", status: "checked_in", joinedAtRound: 1 },
      { id: "checked-late", status: "checked_in", joinedAtRound: 2 },
      { id: "registered", status: "registered", joinedAtRound: 1 },
      { id: "registered-late", status: "registered", joinedAtRound: 2 },
      { id: "pending", status: "pending", joinedAtRound: 2 },
      { id: "dropped", status: "dropped", joinedAtRound: 1 },
      { id: "checked-future", status: "checked_in", joinedAtRound: 3 },
    ].map((entry) => ({
      ...entry,
      tournamentId: "t1",
      user: { id: `user-${entry.id}`, name: entry.id },
      deckItems: null,
      decklistSubmittedAt: null,
      createdAt: now,
    }));
    store.rounds.t1 = [
      {
        id: "round-1",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "completed",
        matches: [
          {
            id: "match-1",
            roundId: "round-1",
            tableNo: 1,
            player1EntryId: "checked-1",
            player2EntryId: "checked-2",
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
          },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const round2 = await createNextRound("t1", { authMode: "mock" });
    const pairedEntryIds = round2.matches
      .flatMap((match) => [match.player1EntryId, match.player2EntryId])
      .filter(Boolean)
      .sort();

    expect(pairedEntryIds).toEqual(["checked-1", "checked-2", "checked-late"]);
  });

  it.each([0, 1])(
    "explains when only %i checked-in entries are available for pairing",
    async (checkedInCount) => {
      setRegistrationTournament({ status: "in_progress" });
      const store = readStore();
      const now = new Date().toISOString();
      store.entries.t1 = [
        ...Array.from({ length: checkedInCount }, (_, index) => ({
          id: `checked-${index + 1}`,
          tournamentId: "t1",
          user: { id: `checked-user-${index + 1}`, name: `Checked ${index + 1}` },
          status: "checked_in",
          joinedAtRound: 1,
          createdAt: now,
        })),
        {
          id: "registered",
          tournamentId: "t1",
          user: { id: "registered-user", name: "Registered" },
          status: "registered",
          joinedAtRound: 1,
          createdAt: now,
        },
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

      await expect(createNextRound("t1", { authMode: "mock" })).rejects.toThrow(
        `次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在${checkedInCount}人）。`
      );
    }
  );

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

  it("rejects direct and game-score draws in a top-cut round", async () => {
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
    const matchId = round.matches[0].id;
    const drawError =
      "SEラウンドでは引き分けにできません。勝者が決まる結果を入力してください。";

    await expect(
      reportMatchResult({ matchId, result: "draw", authMode: "mock" })
    ).rejects.toThrow(drawError);
    await expect(
      reportMatchResult({
        matchId,
        player1Games: 1,
        player2Games: 1,
        authMode: "mock",
      })
    ).rejects.toThrow(drawError);

    expect(readStore().rounds.t1[0].matches[0]).toMatchObject({
      player1Games: null,
      player2Games: null,
      result: null,
    });
  });

  it("rejects top-cut draws before sending an API request", async () => {
    global.fetch = jest.fn();
    const drawError =
      "SEラウンドでは引き分けにできません。勝者が決まる結果を入力してください。";

    await expect(
      reportMatchResult({
        matchId: "api-match",
        result: "draw",
        stage: "top_cut",
        authMode: "api",
      })
    ).rejects.toThrow(drawError);
    await expect(
      reportMatchResult({
        matchId: "api-match",
        player1Games: 1,
        player2Games: 1,
        stage: "top_cut",
        authMode: "api",
      })
    ).rejects.toThrow(drawError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("continues to allow draws in swiss rounds", async () => {
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
    const matchId = round.matches[0].id;

    await expect(
      reportMatchResult({ matchId, result: "draw", authMode: "mock" })
    ).resolves.toMatchObject({ result: "draw" });
    await expect(
      reportMatchResult({
        matchId,
        player1Games: 1,
        player2Games: 1,
        authMode: "mock",
      })
    ).resolves.toMatchObject({ player1Games: 1, player2Games: 1, result: "draw" });
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
    setRegistrationTournament({ status: "in_progress", lateEntry: true, swissRounds: 3 });
    const store = readStore();
    store.rounds.t1 = [{ id: "round-1", tournamentId: "t1", number: 1, stage: "swiss", status: "in_progress", matches: [] }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const pending = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(pending.status).toBe("pending");
    expect(pending.joinedAtRound).toBe(2);

    const approved = await approveEntry({ tournamentId: "t1", entryId: pending.id, authMode: "mock" });
    expect(approved.status).toBe("registered");
    expect(approved.joinedAtRound).toBe(2);

    const checkedIn = await updateEntryStatus({
      tournamentId: "t1",
      entryId: approved.id,
      status: "checked_in",
      authMode: "mock",
      user: organizer,
    });
    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.joinedAtRound).toBe(2);
    expect(checkedIn.deckLockedAt).toBeTruthy();

    const guest = await createManualEntry({ tournamentId: "t1", name: "ゲスト参加者", authMode: "mock" });
    expect(guest.user.id).toBeNull();
    expect(guest.status).toBe("registered");
    expect(guest.joinedAtRound).toBe(2);
    expect(guest.deckLockedAt).toBeTruthy();
    expect(guest.decklistState).toBe("none");

    await updateEntryStatus({
      tournamentId: "t1",
      entryId: guest.id,
      status: "checked_in",
      authMode: "mock",
      user: organizer,
    });
    await completeRound("round-1", { authMode: "mock" });
    const nextRound = await createNextRound("t1", { authMode: "mock" });
    const nextRoundEntryIds = nextRound.matches
      .flatMap((match) => [match.player1EntryId, match.player2EntryId])
      .filter(Boolean);
    expect(nextRoundEntryIds).toEqual(expect.arrayContaining([approved.id, guest.id]));

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

  it("allows organizer relocking and refuses unlocking after tournament completion", async () => {
    setRegistrationTournament();
    const entry = await createEntry({
      tournamentId: "t1",
      deckItems: buildValidDeck("manual-lock"),
      authMode: "mock",
      user,
    });

    const initiallyLocked = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      decklistLocked: true,
      authMode: "mock",
      user: organizer,
    });
    const unlocked = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      decklistLocked: false,
      authMode: "mock",
      user: organizer,
    });
    const manuallyLocked = await updateEntryStatus({
      tournamentId: "t1",
      entryId: entry.id,
      decklistLocked: true,
      authMode: "mock",
      user: organizer,
    });
    expect(initiallyLocked.deckLockedAt).toBeTruthy();
    expect(unlocked.deckLockedAt).toBeNull();
    expect(unlocked.deckUnlockedBy).toEqual({ id: organizer.id, name: organizer.name });
    expect(manuallyLocked.decklistState).toBe("locked");
    expect(manuallyLocked.deckLockedAt).toBeTruthy();
    expect(manuallyLocked.deckUnlockedAt).toBe(unlocked.deckUnlockedAt);

    const store = readStore();
    store.tournaments[0].status = "completed";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: entry.id,
        decklistLocked: false,
        authMode: "mock",
        user: organizer,
      })
    ).rejects.toThrow("大会終了後はデッキリストのロックを解除できません");
    expect(readStore().entries.t1[0].deckLockedAt).toBe(manuallyLocked.deckLockedAt);
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
      user: organizer,
    });
    expect(updatedEntry.deckItems[0].cardId).toBe("proxy-1");

    const updatedTournament = await updateTournament({
      id: "t1",
      regulation: { bannedCards: ["proxy 1"] },
      authMode: "mock",
      user: organizer,
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
      updateTournament({ id: "t1", swissRounds: 4, authMode: "mock", user: organizer })
    ).rejects.toThrow("ラウンド生成後");
    await expect(
      updateTournament({
        id: "t1",
        swissEndCondition: "undefeated",
        authMode: "mock",
        user: organizer,
      })
    ).rejects.toThrow("ラウンド生成後");
  });

  it("re-evaluates the undefeated ending condition after reopening an early-ending round", async () => {
    const { recovery, round2 } = await prepareTwoSwissRoundsWithOneUndefeated({
      swissEndCondition: "undefeated",
    });
    expect(recovery).toBeTruthy();

    await completeRound(round2.id, { authMode: "mock" });
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "completed"
    );

    const reopened = await reopenRound(round2.id, { authMode: "mock" });
    expect(reopened.status).toBe("in_progress");
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "in_progress"
    );

    await reportMatchResult({ ...recovery, authMode: "mock" });
    expect(await undefeatedEntryIds()).toHaveLength(2);
    await completeRound(round2.id, { authMode: "mock" });

    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe(
      "in_progress"
    );
    const round3 = await createNextRound("t1", { authMode: "mock" });
    expect(round3).toMatchObject({ number: 3, stage: "swiss" });
  });

  it("reopens the latest completed round and allows its result to be corrected", async () => {
    setRoundRollbackTournament([makeResultRound(1, "completed")]);

    await expect(
      reportMatchResult({
        matchId: "match-1",
        player1Games: 0,
        player2Games: 2,
        authMode: "mock",
      })
    ).rejects.toThrow("先にラウンドを完了前へ戻してください");

    const reopened = await reopenRound("round-1", { authMode: "mock" });
    expect(reopened).toMatchObject({
      id: "round-1",
      status: "in_progress",
      matches: [expect.objectContaining({ id: "match-1", result: "p1_win" })],
    });

    const corrected = await reportMatchResult({
      matchId: "match-1",
      player1Games: 0,
      player2Games: 2,
      authMode: "mock",
    });
    expect(corrected).toMatchObject({ result: "p2_win", player1Games: 0, player2Games: 2 });
    await expect(completeRound("round-1", { authMode: "mock" })).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("rejects rewinding a completed round older than the latest completed round", async () => {
    setRoundRollbackTournament([
      makeResultRound(1, "completed"),
      makeResultRound(2, "completed", "p2_win"),
    ], "completed");
    const before = window.localStorage.getItem(STORAGE_KEY);

    await expect(reopenRound("round-1", { authMode: "mock" })).rejects.toThrow(
      "修正できるのは直前に完了した第2回戦のみです"
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("requires confirmation before discarding later rounds and removes their results from standings", async () => {
    setRoundRollbackTournament([
      makeResultRound(1, "completed"),
      makeResultRound(2, "in_progress", "p2_win"),
    ]);
    const beforeStandings = await fetchStandings("t1", { authMode: "mock" });
    expect(beforeStandings.items.find((standing) => standing.entryId === "entry-2")).toMatchObject({
      wins: 1,
      losses: 1,
      points: 3,
    });

    await expect(reopenRound("round-1", { authMode: "mock" })).rejects.toMatchObject({
      code: "later_rounds_exist",
      firstDiscardedRoundNumber: 2,
      discardedRoundCount: 1,
    });
    expect(readStore().rounds.t1).toHaveLength(2);

    await reopenRound("round-1", { authMode: "mock", discardLaterRounds: true });
    const storedRounds = readStore().rounds.t1;
    expect(storedRounds).toHaveLength(1);
    expect(storedRounds[0]).toMatchObject({ id: "round-1", status: "in_progress" });
    expect(storedRounds.flatMap((round) => round.matches).map((match) => match.id)).not.toContain(
      "match-2"
    );

    const afterStandings = await fetchStandings("t1", { authMode: "mock" });
    expect(afterStandings.items.find((standing) => standing.entryId === "entry-1")).toMatchObject({
      wins: 1,
      losses: 0,
      points: 3,
    });
    expect(afterStandings.items.find((standing) => standing.entryId === "entry-2")).toMatchObject({
      wins: 0,
      losses: 1,
      points: 0,
    });
  });

  it("reopens the final round of a completed tournament and completes the tournament again", async () => {
    setRegistrationTournament({ status: "registration", swissRounds: 1 });
    const store = readStore();
    store.entries.t1 = ["1", "2"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const finalRound = await createNextRound("t1", { authMode: "mock" });
    await reportMatchResult({
      matchId: finalRound.matches[0].id,
      player1Games: 2,
      player2Games: 0,
      authMode: "mock",
    });
    await completeRound(finalRound.id, { authMode: "mock" });
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe("completed");

    const reopened = await reopenRound(finalRound.id, { authMode: "mock" });
    expect(reopened.status).toBe("in_progress");
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe("in_progress");

    await reportMatchResult({
      matchId: finalRound.matches[0].id,
      player1Games: 0,
      player2Games: 2,
      authMode: "mock",
    });
    await completeRound(finalRound.id, { authMode: "mock" });
    expect((await fetchTournament("t1", { authMode: "mock", user })).status).toBe("completed");
  });

  it("rewinds single elimination results only after discarding the later bracket", async () => {
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
    ).rejects.toThrow("先にラウンドを完了前へ戻してください");
    await expect(reopenRound(round1.id, { authMode: "mock" })).rejects.toMatchObject({
      code: "later_rounds_exist",
    });
    await reopenRound(round1.id, { authMode: "mock", discardLaterRounds: true });
    await expect(
      reportMatchResult({ matchId: round1.matches[0].id, player1Games: 0, player2Games: 2, authMode: "mock" })
    ).resolves.toMatchObject({ result: "p2_win" });
  });

  it("physically kicks an unpaired participant, frees the slot, and keeps legacy stores compatible", async () => {
    setRegistrationTournament({ capacity: 1 });

    await expect(
      fetchTournamentBans("t1", { authMode: "mock", user: organizer })
    ).resolves.toEqual({ items: [] });
    const entered = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    const kicked = await kickEntry({
      tournamentId: "t1",
      entryId: entered.id,
      authMode: "mock",
      user: organizer,
    });

    expect(kicked).toEqual({ disposition: "removed", entry: null, ban: null });
    expect(readStore().entries.t1).toEqual([]);
    const afterKick = await fetchTournament("t1", { authMode: "mock", user });
    expect(afterKick.entryCount).toBe(0);
    expect(afterKick.myEntry).toBeNull();

    const reentered = await createEntry({ tournamentId: "t1", authMode: "mock", user });
    expect(reentered.status).toBe("registered");
    expect((await fetchTournament("t1", { authMode: "mock", user })).entryCount).toBe(1);
  });

  it("adds a tournament ban, rejects re-entry in Japanese, hides it publicly, and allows unban", async () => {
    setRegistrationTournament();
    const entered = await createEntry({ tournamentId: "t1", authMode: "mock", user });

    const kicked = await kickEntry({
      tournamentId: "t1",
      entryId: entered.id,
      ban: true,
      authMode: "mock",
      user: organizer,
    });
    expect(kicked).toMatchObject({
      disposition: "removed",
      entry: null,
      ban: {
        user: { id: user.id, name: user.displayNickname },
        bannedAt: expect.any(String),
      },
    });
    await expect(
      fetchTournamentBans("t1", { authMode: "mock", user: organizer })
    ).resolves.toEqual({ items: [kicked.ban] });
    await expect(
      fetchTournamentBans("t1", { authMode: "mock", user })
    ).rejects.toMatchObject({ status: 403 });

    const publicView = await fetchTournament("t1", { authMode: "mock", user });
    expect(publicView).not.toHaveProperty("bans");
    await expect(
      createEntry({ tournamentId: "t1", authMode: "mock", user })
    ).rejects.toMatchObject({
      message: "この大会への再エントリーは禁止されています。主催者にお問い合わせください。",
      status: 403,
    });
    expect(readStore().entries.t1).toEqual([]);

    await unbanTournamentUser({
      tournamentId: "t1",
      userId: user.id,
      authMode: "mock",
      user: organizer,
    });
    await expect(
      fetchTournamentBans("t1", { authMode: "mock", user: organizer })
    ).resolves.toEqual({ items: [] });
    await expect(
      createEntry({ tournamentId: "t1", authMode: "mock", user })
    ).resolves.toMatchObject({ user: { id: user.id } });
  });

  it("drops a paired participant while preserving match references and the opponent's standings", async () => {
    setRegistrationTournament({ status: "in_progress", swissRounds: 3, capacity: 4 });
    const store = readStore();
    const now = new Date().toISOString();
    store.entries.t1 = ["1", "2", "3", "4"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      deckItems: null,
      decklistSubmittedAt: null,
      deckLockedAt: `locked-${suffix}`,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    }));
    store.rounds.t1 = [
      {
        id: "round-1",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "completed",
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
            player1Games: 2,
            player2Games: 0,
            result: "p1_win",
          },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    const before = (await fetchStandings("t1", { authMode: "mock" })).items.find(
      (standing) => standing.entryId === "entry-1"
    );

    const kicked = await kickEntry({
      tournamentId: "t1",
      entryId: "entry-2",
      authMode: "mock",
      user: organizer,
    });
    expect(kicked).toMatchObject({ disposition: "dropped", entry: { status: "dropped" } });
    const persisted = readStore();
    expect(persisted.rounds.t1[0].matches[0]).toMatchObject({
      player1EntryId: "entry-1",
      player2EntryId: "entry-2",
      result: "p1_win",
    });
    expect(persisted.entries.t1.find((entry) => entry.id === "entry-2")).toMatchObject({
      status: "dropped",
      deckLockedAt: "locked-2",
    });
    expect(persisted.entries.t1.find((entry) => entry.id === "entry-1")).toMatchObject({
      status: "checked_in",
      deckLockedAt: "locked-1",
    });

    const afterItems = (await fetchStandings("t1", { authMode: "mock" })).items;
    const after = afterItems.find((standing) => standing.entryId === "entry-1");
    expect(after).toMatchObject({
      wins: before.wins,
      losses: before.losses,
      points: before.points,
    });
    expect(after.omwPercent).toBeCloseTo(before.omwPercent);
    expect(afterItems.map((standing) => standing.entryId)).not.toContain("entry-2");
    expect((await fetchTournament("t1", { authMode: "mock", user })).entryCount).toBe(3);

    const posthocBan = await kickEntry({
      tournamentId: "t1",
      entryId: "entry-2",
      ban: true,
      authMode: "mock",
      user: organizer,
    });
    expect(posthocBan).toMatchObject({
      disposition: "dropped",
      entry: { status: "dropped" },
      ban: { user: { id: "player-2" } },
    });
    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: "entry-2",
        status: "checked_in",
        authMode: "mock",
        user: organizer,
      })
    ).rejects.toMatchObject({
      message: "この大会への再エントリーは禁止されています。主催者にお問い合わせください。",
      status: 403,
    });
    expect(readStore().entries.t1.find((entry) => entry.id === "entry-2").status).toBe(
      "dropped"
    );

    const nextRound = await createNextRound("t1", { authMode: "mock" });
    const pairedIds = nextRound.matches
      .flatMap((match) => [match.player1EntryId, match.player2EntryId])
      .filter(Boolean);
    expect(pairedIds).not.toContain("entry-2");
    expect(pairedIds).toEqual(expect.arrayContaining(["entry-1", "entry-3", "entry-4"]));
  });

  it("keeps an entry as dropped when an unfinished match already references it", async () => {
    setRegistrationTournament({ status: "in_progress" });
    const store = readStore();
    store.entries.t1 = ["1", "2"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: new Date().toISOString(),
    }));
    store.rounds.t1 = [
      {
        id: "round-in-progress",
        tournamentId: "t1",
        number: 1,
        stage: "swiss",
        status: "in_progress",
        matches: [
          {
            id: "match-in-progress",
            roundId: "round-in-progress",
            tableNo: 1,
            player1EntryId: "entry-1",
            player2EntryId: "entry-2",
            player1Games: 0,
            player2Games: 0,
            result: "pending",
          },
        ],
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    await expect(
      kickEntry({
        tournamentId: "t1",
        entryId: "entry-2",
        authMode: "mock",
        user: organizer,
      })
    ).resolves.toMatchObject({ disposition: "dropped", entry: { status: "dropped" } });
    expect(readStore().rounds.t1[0].matches[0]).toMatchObject({
      player1EntryId: "entry-1",
      player2EntryId: "entry-2",
      result: "pending",
    });
  });

  it.each(["draft", "registration", "in_progress", "completed", "cancelled"])(
    "allows an organizer to kick during the %s phase",
    async (status) => {
      setRegistrationTournament({ status });
      const store = readStore();
      store.entries.t1 = [
        {
          id: `phase-entry-${status}`,
          tournamentId: "t1",
          user: { id: `phase-user-${status}`, name: "Phase Player" },
          deckItems: null,
          decklistSubmittedAt: null,
          status: "registered",
          createdAt: new Date().toISOString(),
        },
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

      await expect(
        kickEntry({
          tournamentId: "t1",
          entryId: `phase-entry-${status}`,
          authMode: "mock",
          user: organizer,
        })
      ).resolves.toMatchObject({ disposition: "removed" });
    }
  );

  it("normalizes legacy co-organizer data and centralizes creator, co-organizer, participant, and admin permissions", async () => {
    const seeded = await fetchTournament("mock-tournament-1", { authMode: "mock" });
    expect(seeded.coOrganizers).toEqual([
      { id: "co-organizer-1", name: "共同運営者" },
    ]);

    setRegistrationTournament({ coOrganizers: undefined });
    const legacy = await fetchTournament("t1", { authMode: "mock", user: participant });
    expect(legacy.coOrganizers).toEqual([]);

    const tournament = {
      ...legacy,
      createdBy: { id: organizer.id, name: organizer.name },
      coOrganizers: [{ id: coOrganizer.id, name: coOrganizer.name }],
    };
    expect(getTournamentPermissions(tournament, { ...organizer, role: "user" })).toMatchObject({
      isCreator: true,
      canManage: true,
      canDelete: true,
      canManageCoOrganizers: true,
    });
    expect(getTournamentPermissions(tournament, coOrganizer)).toMatchObject({
      isCoOrganizer: true,
      canManage: true,
      canDelete: false,
      canManageCoOrganizers: false,
    });
    expect(getTournamentPermissions(tournament, participant)).toMatchObject({
      canManage: false,
      canDelete: false,
      canManageCoOrganizers: false,
    });
    expect(getTournamentPermissions(tournament, admin)).toMatchObject({
      isAdmin: true,
      canManage: true,
      canDelete: true,
      canManageCoOrganizers: true,
    });

    const created = await createTournament({
      title: "共同運営者初期化テスト",
      authMode: "mock",
      user: organizer,
    });
    expect(created.coOrganizers).toEqual([]);
  });

  it("keeps private decklists visible to creator, co-organizer, and admin but hidden from participants", async () => {
    setManagementAuthorizationTournament();

    for (const manager of [organizer, coOrganizer, admin]) {
      const managedEntries = await fetchEntries("t1", { authMode: "mock", user: manager });
      expect(managedEntries.items.find((entry) => entry.id === "entry-1").deckItems).toHaveLength(17);
      const detail = await fetchTournament("t1", { authMode: "mock", user: manager });
      expect(detail.entries.find((entry) => entry.id === "entry-1").deckItems).toHaveLength(17);
    }

    await expect(
      fetchEntries("t1", { authMode: "mock", user: participant })
    ).rejects.toMatchObject({ status: 403 });
    const participantDetail = await fetchTournament("t1", {
      authMode: "mock",
      user: participant,
    });
    expect(participantDetail.entries.find((entry) => entry.id === "entry-1").deckItems).toBeNull();

    const store = readStore();
    store.rounds.t1[0].status = "in_progress";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    const coOrganizerRounds = await fetchRounds("t1", {
      authMode: "mock",
      user: coOrganizer,
    });
    const participantRounds = await fetchRounds("t1", {
      authMode: "mock",
      user: participant,
    });
    expect(coOrganizerRounds.rounds[0].matches[0]).toMatchObject({ result: "p1_win" });
    expect(participantRounds.rounds[0].matches[0]).toMatchObject({
      result: null,
      player1Games: null,
      player2Games: null,
    });
  });

  it("allows a co-organizer to edit tournament and entry state, proxy decks, and kick or ban users", async () => {
    setManagementAuthorizationTournament();

    const updatedTournament = await updateTournament({
      id: "t1",
      title: "共同運営更新済み大会",
      authMode: "mock",
      user: coOrganizer,
    });
    expect(updatedTournament.title).toBe("共同運営更新済み大会");

    await expect(
      approveEntry({
        tournamentId: "t1",
        entryId: "entry-pending-approve",
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toMatchObject({ status: "registered" });
    await expect(
      rejectEntry({
        tournamentId: "t1",
        entryId: "entry-pending-reject",
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toBeUndefined();
    await expect(
      createManualEntry({
        tournamentId: "t1",
        name: "共同運営追加ゲスト",
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toMatchObject({ user: { name: "共同運営追加ゲスト" } });
    await expect(
      updateEntryStatus({
        tournamentId: "t1",
        entryId: "entry-2",
        status: "dropped",
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toMatchObject({ status: "dropped" });

    const proxyUpdated = await updateEntryStatus({
      tournamentId: "t1",
      entryId: "entry-1",
      deckItems: buildValidDeck("co-proxy"),
      authMode: "mock",
      user: coOrganizer,
    });
    expect(proxyUpdated.deckUpdatedBy).toEqual({ id: coOrganizer.id, name: coOrganizer.name });
    const unlocked = await updateEntryStatus({
      tournamentId: "t1",
      entryId: "entry-1",
      decklistLocked: false,
      authMode: "mock",
      user: coOrganizer,
    });
    expect(unlocked.deckUnlockedBy).toEqual({ id: coOrganizer.id, name: coOrganizer.name });

    const kicked = await kickEntry({
      tournamentId: "t1",
      entryId: "entry-kick",
      ban: true,
      authMode: "mock",
      user: coOrganizer,
    });
    expect(kicked).toMatchObject({
      disposition: "removed",
      ban: { user: { id: "kick-user" } },
    });
    await expect(
      unbanTournamentUser({
        tournamentId: "t1",
        userId: "kick-user",
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toBeUndefined();

    await expect(
      updateTournament({
        id: "t1",
        title: "管理者更新済み大会",
        authMode: "mock",
        user: admin,
      })
    ).resolves.toMatchObject({ title: "管理者更新済み大会" });
  });

  it("allows a co-organizer to generate and edit pairings, enter results, complete, and reopen rounds", async () => {
    setRegistrationTournament({
      status: "registration",
      swissRounds: null,
      roundTimeMinutes: 30,
      coOrganizers: [{ id: coOrganizer.id, name: coOrganizer.name }],
    });
    const store = readStore();
    const now = new Date().toISOString();
    store.entries.t1 = ["1", "2", "3", "4"].map((suffix) => ({
      id: `entry-${suffix}`,
      tournamentId: "t1",
      user: { id: `player-${suffix}`, name: `Player ${suffix}` },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      joinedAtRound: 1,
      createdAt: now,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

    const round = await createNextRound("t1", { authMode: "mock", user: coOrganizer });
    await expect(
      fetchTournament("t1", { authMode: "mock", user: coOrganizer })
    ).resolves.toMatchObject({
      swissRounds: 2,
      swissEndCondition: "fixed_rounds",
    });
    const editedRound = await updateRoundMatches({
      roundId: round.id,
      matches: round.matches,
      authMode: "mock",
      user: coOrganizer,
    });
    expect(editedRound.matches).toHaveLength(2);
    await expect(
      startRoundTimer(round.id, {
        timerStartedAt: now,
        authMode: "mock",
        user: coOrganizer,
      })
    ).resolves.toMatchObject({ timerStartedAt: now });
    for (const match of round.matches) {
      await reportMatchResult({
        matchId: match.id,
        player1Games: 2,
        player2Games: 0,
        authMode: "mock",
        user: coOrganizer,
      });
    }
    await expect(
      completeRound(round.id, { authMode: "mock", user: coOrganizer })
    ).resolves.toMatchObject({ status: "completed" });
    await expect(
      fetchRoundsForManage("t1", { authMode: "mock", user: coOrganizer })
    ).resolves.toMatchObject({ rounds: expect.any(Array) });
    await expect(
      reopenRound(round.id, { authMode: "mock", user: coOrganizer })
    ).resolves.toMatchObject({ status: "in_progress" });
    await expect(
      deleteRound(round.id, { authMode: "mock", user: coOrganizer })
    ).resolves.toBeUndefined();
  });

  it.each([
    ["大会情報の編集", () => updateTournament({ id: "t1", title: "拒否", authMode: "mock", user: participant })],
    ["管理用エントリー取得", () => fetchEntries("t1", { authMode: "mock", user: participant })],
    ["ban一覧取得", () => fetchTournamentBans("t1", { authMode: "mock", user: participant })],
    ["管理用ラウンド取得", () => fetchRoundsForManage("t1", { authMode: "mock", user: participant })],
    ["手動参加者追加", () => createManualEntry({ tournamentId: "t1", name: "拒否", authMode: "mock", user: participant })],
    ["エントリー承認", () => approveEntry({ tournamentId: "t1", entryId: "entry-pending-approve", authMode: "mock", user: participant })],
    ["エントリー却下", () => rejectEntry({ tournamentId: "t1", entryId: "entry-pending-reject", authMode: "mock", user: participant })],
    ["参加状態変更", () => updateEntryStatus({ tournamentId: "t1", entryId: "entry-2", status: "dropped", authMode: "mock", user: participant })],
    ["デッキリストの代理上書き", () => updateEntryStatus({ tournamentId: "t1", entryId: "entry-1", deckItems: buildValidDeck("denied-proxy"), authMode: "mock", user: participant })],
    ["デッキリストのロック解除", () => updateEntryStatus({ tournamentId: "t1", entryId: "entry-1", decklistLocked: false, authMode: "mock", user: participant })],
    ["キック・ban", () => kickEntry({ tournamentId: "t1", entryId: "entry-kick", ban: true, authMode: "mock", user: participant })],
    ["ban解除", () => unbanTournamentUser({ tournamentId: "t1", userId: "banned-user", authMode: "mock", user: participant })],
    ["ペアリング生成", () => createNextRound("t1", { authMode: "mock", user: participant })],
    ["ペアリング編集", () => updateRoundMatches({ roundId: "round-auth", matches: [], authMode: "mock", user: participant })],
    ["結果入力", () => reportMatchResult({ matchId: "match-auth", result: "p1_win", authMode: "mock", user: participant })],
    ["タイマー開始", () => startRoundTimer("round-auth", { authMode: "mock", user: participant })],
    ["ラウンド完了", () => completeRound("round-auth", { authMode: "mock", user: participant })],
    ["ラウンド巻き戻し", () => reopenRound("round-auth", { authMode: "mock", user: participant })],
    ["ラウンド削除", () => deleteRound("round-auth", { authMode: "mock", user: participant })],
  ])("rejects a general participant attempting %s", async (_label, operation) => {
    setManagementAuthorizationTournament();
    await expect(operation()).rejects.toMatchObject({
      message: "この大会を管理する権限がありません。",
      status: 403,
    });
  });

  it("keeps co-organizer management and tournament deletion limited to creator and admin", async () => {
    window.localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify([
        { id: "new-co", name: "非公開名", nickname: "追加対象", role: "user" },
      ])
    );
    setRegistrationTournament({
      status: "draft",
      coOrganizers: [{ id: coOrganizer.id, name: coOrganizer.name }],
    });

    await expect(
      addTournamentCoOrganizer({
        tournamentId: "t1",
        userId: "new-co",
        authMode: "mock",
        user: coOrganizer,
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      removeTournamentCoOrganizer({
        tournamentId: "t1",
        userId: coOrganizer.id,
        authMode: "mock",
        user: coOrganizer,
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      removeTournamentCoOrganizer({
        tournamentId: "t1",
        userId: coOrganizer.id,
        authMode: "mock",
        user: participant,
      })
    ).rejects.toMatchObject({ status: 403 });

    const added = await addTournamentCoOrganizer({
      tournamentId: "t1",
      userId: "new-co",
      authMode: "mock",
      user: organizer,
    });
    expect(added.coOrganizers).toEqual(
      expect.arrayContaining([{ id: "new-co", name: "追加対象" }])
    );
    await expect(
      removeTournamentCoOrganizer({
        tournamentId: "t1",
        userId: organizer.id,
        authMode: "mock",
        user: admin,
      })
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      removeTournamentCoOrganizer({
        tournamentId: "t1",
        userId: coOrganizer.id,
        authMode: "mock",
        user: organizer,
      })
    ).resolves.toMatchObject({ coOrganizers: [{ id: "new-co", name: "追加対象" }] });
    await expect(
      removeTournamentCoOrganizer({
        tournamentId: "t1",
        userId: "new-co",
        authMode: "mock",
        user: admin,
      })
    ).resolves.toMatchObject({ coOrganizers: [] });
    await expect(
      addTournamentCoOrganizer({
        tournamentId: "t1",
        userId: "new-co",
        authMode: "mock",
        user: admin,
      })
    ).resolves.toMatchObject({
      coOrganizers: [{ id: "new-co", name: "追加対象" }],
    });

    await expect(
      deleteTournament("t1", { authMode: "mock", user: coOrganizer })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteTournament("t1", { authMode: "mock", user: participant })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteTournament("t1", { authMode: "mock", user: admin })
    ).resolves.toBeUndefined();

    setRegistrationTournament({ status: "draft" });
    await expect(
      deleteTournament("t1", { authMode: "mock", user: organizer })
    ).resolves.toBeUndefined();
  });
});
