import { computeStandings } from "../utils/tournament/standings";
import { getRoundLabel } from "../utils/tournament/roundLabel";
import { buildBracket, nextRoundPairs } from "../utils/tournament/singleElimination";
import {
  getSwissEndCondition,
  SWISS_END_CONDITION_UNDEFEATED,
} from "../utils/tournament/swiss";
import { pairSwissRound } from "../utils/tournament/swissPairing";
import { validateDeck } from "../utils/deckValidation";
import { fetchUsers } from "./users";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const STORAGE_KEY = "gundamwar.tournaments.v1";
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const PAGE_SIZE = 10;
const MOCK_SEED_VERSION = 3;

// These IDs are also used by the format restriction data in src/data, so the
// seed decks resolve to real card images instead of test-only placeholder IDs.
const MOCK_DECK_CARD_IDS = [
  "101020126",
  "101050019",
  "102020114",
  "102030045",
  "102050016",
  "103021034",
  "103050016",
  "104020075",
  "104050016",
  "105023027",
  "105050011",
  "106020065",
  "106050009",
  "107010012",
  "107050008",
  "101010083",
  "101040070",
  "102020163",
  "102020180",
  "102030008",
  "102030118",
  "102040080",
  "102040082",
  "103030056",
  "103031014",
  "103011055",
  "104030005",
  "105010077",
  "105043035",
  "105043038",
  "107030001",
];

const MOCK_CARD_TYPE_NAMES = {
  "01": "UNIT",
  "02": "CHARACTER",
  "03": "COMMAND",
  "04": "OPERATION",
  "05": "GENERATION",
};

const DEFAULT_REGULATION = {
  name: "スタンダード",
  mainMin: 50,
  mainMax: 50,
  sideSize: 10,
  maxCopies: 3,
  bannedCards: [],
  limitedCards: [],
  allowedSets: null,
};

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function readMockViewer() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const id = user.googleSub || user.sub || user.id || user.userId;
    if (!id) return null;
    return {
      id: String(id),
      name: user.displayNickname || user.nickname || "プレイヤー",
      role: user.role || "user",
    };
  } catch (error) {
    console.warn("Failed to read mock user.", error);
    return null;
  }
}

function readMockUser() {
  const viewer = readMockViewer();
  return viewer ? { id: viewer.id, name: viewer.name } : null;
}

function getCurrentUser(user) {
  const currentUser = user?.id
    ? {
        id: String(user.id),
        name: user.displayNickname || user.nickname || "プレイヤー",
      }
    : readMockUser();
  if (!currentUser?.id) {
    throw new Error("ログインしてから操作してください。");
  }
  return currentUser;
}

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildMockDeck(offset = 0) {
  return Array.from({ length: 17 }, (_, index) => {
    const cardId = MOCK_DECK_CARD_IDS[(offset + index) % MOCK_DECK_CARD_IDS.length];
    return {
      cardId,
      count: index === 16 ? 2 : 3,
      card: {
        cardId,
        card_type_name: MOCK_CARD_TYPE_NAMES[cardId.slice(3, 5)] || "UNIT",
      },
      zone: "main",
    };
  });
}

function createInitialStore() {
  const tournamentId = "mock-tournament-1";
  const completedTournamentId = "mock-tournament-3";
  const organizer = { id: "organizer-1", name: "ローカル主催者" };
  const coOrganizer = { id: "co-organizer-1", name: "共同運営者" };
  const entries = [
    {
      id: "entry-1",
      tournamentId,
      user: { id: "mock-player-1", name: "プレイヤー1" },
      deckItems: null,
      decklistSubmittedAt: null,
      deckFormat: null,
      deckLockedAt: daysFromNow(-1),
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: null,
      deckUnlockedAt: null,
      finalRank: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
    {
      id: "entry-2",
      tournamentId,
      user: { id: "mock-player-2", name: "プレイヤー2" },
      deckItems: buildMockDeck(0),
      decklistSubmittedAt: daysFromNow(-3),
      deckFormat: DEFAULT_REGULATION.name,
      deckLockedAt: null,
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: organizer,
      deckUnlockedAt: daysFromNow(-1),
      finalRank: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
    {
      id: "entry-3",
      tournamentId,
      user: { id: "mock-player-3", name: "プレイヤー3" },
      deckItems: buildMockDeck(4),
      decklistSubmittedAt: daysFromNow(-3),
      deckFormat: DEFAULT_REGULATION.name,
      deckLockedAt: daysFromNow(-1),
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: null,
      deckUnlockedAt: null,
      finalRank: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
    {
      id: "entry-4",
      tournamentId,
      user: { id: "mock-player-4", name: "プレイヤー4" },
      deckItems: buildMockDeck(8),
      decklistSubmittedAt: daysFromNow(-1),
      deckFormat: DEFAULT_REGULATION.name,
      deckLockedAt: null,
      deckUpdatedBy: null,
      deckUpdatedAt: null,
      deckUnlockedBy: null,
      deckUnlockedAt: null,
      finalRank: null,
      status: "registered",
      joinedAtRound: 2,
      createdAt: daysFromNow(-1),
    },
  ];
  const completedEntries = [
    {
      id: "completed-entry-1",
      user: { id: "mock-finalist-1", name: "決勝参加者1" },
      finalRank: 1,
      deckOffset: 0,
    },
    {
      id: "completed-entry-2",
      user: { id: "mock-finalist-2", name: "決勝参加者2" },
      finalRank: 2,
      deckOffset: 4,
    },
    {
      id: "completed-entry-3",
      user: { id: "mock-finalist-3", name: "決勝参加者3" },
      finalRank: 3,
      deckOffset: 8,
    },
    {
      id: "completed-entry-4",
      user: { id: "mock-finalist-4", name: "決勝参加者4" },
      finalRank: 4,
      deckOffset: 12,
    },
  ].map(({ deckOffset, ...entry }) => ({
    ...entry,
    tournamentId: completedTournamentId,
    deckItems: buildMockDeck(deckOffset),
    decklistSubmittedAt: daysFromNow(-10),
    deckFormat: DEFAULT_REGULATION.name,
    deckLockedAt: daysFromNow(-7),
    deckUpdatedBy: null,
    deckUpdatedAt: null,
    deckUnlockedBy: null,
    deckUnlockedAt: null,
    status: "checked_in",
    createdAt: daysFromNow(-14),
  }));

  return {
    seedVersion: MOCK_SEED_VERSION,
    tournaments: [
      {
        id: tournamentId,
        title: "ローカルスイス杯",
        description: "ローカル開発用のモック大会です。",
        format: "swiss",
        swissRounds: 3,
        topCutSize: null,
        status: "in_progress",
        startsAt: daysFromNow(-1),
        registrationClosesAt: daysFromNow(-2),
        checkinOpensAt: null,
        capacity: 32,
        venue: "東京・秋葉原カードショップ○○",
        isOnline: false,
        selfCheckin: false,
        decklistsPublic: false,
        decklistRequired: true,
        announcement: null,
        roundTimeMinutes: null,
        lateEntry: true,
        regulation: DEFAULT_REGULATION,
        createdBy: organizer,
        coOrganizers: [coOrganizer],
        entryCount: entries.length,
        createdAt: daysFromNow(-10),
        updatedAt: daysFromNow(-1),
      },
      {
        id: "mock-tournament-2",
        title: "週末エントリー受付大会",
        description: "週末開催予定のエントリー受付中大会です。",
        format: "swiss",
        swissRounds: null,
        topCutSize: 8,
        status: "registration",
        startsAt: daysFromNow(7),
        registrationClosesAt: daysFromNow(6),
        checkinOpensAt: null,
        capacity: 16,
        venue: null,
        isOnline: true,
        selfCheckin: true,
        decklistsPublic: false,
        decklistRequired: false,
        announcement: null,
        roundTimeMinutes: null,
        lateEntry: false,
        regulation: DEFAULT_REGULATION,
        createdBy: organizer,
        coOrganizers: [],
        entryCount: 0,
        createdAt: daysFromNow(-2),
        updatedAt: daysFromNow(-2),
      },
      {
        id: completedTournamentId,
        title: "完了済みスタンダード杯",
        description: "公開大会デッキと最終順位を確認できる完了済みのモック大会です。",
        format: "swiss",
        swissRounds: 3,
        topCutSize: null,
        status: "completed",
        startsAt: daysFromNow(-7),
        endedAt: daysFromNow(-7),
        registrationClosesAt: daysFromNow(-8),
        checkinOpensAt: daysFromNow(-8),
        capacity: 16,
        venue: "東京・秋葉原カードショップ○○",
        isOnline: false,
        selfCheckin: true,
        decklistsPublic: true,
        decklistRequired: true,
        announcement: "全3回戦が終了しました。",
        roundTimeMinutes: 50,
        lateEntry: false,
        regulation: DEFAULT_REGULATION,
        createdBy: organizer,
        coOrganizers: [],
        entryCount: completedEntries.length,
        createdAt: daysFromNow(-21),
        updatedAt: daysFromNow(-7),
      },
    ],
    entries: {
      [tournamentId]: entries,
      "mock-tournament-2": [],
      [completedTournamentId]: completedEntries,
    },
    rounds: {
      [tournamentId]: [
        {
          id: "round-1",
          tournamentId,
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
              player2EntryId: null,
              player1Games: null,
              player2Games: null,
              result: "bye",
            },
          ],
        },
      ],
      "mock-tournament-2": [],
      [completedTournamentId]: [
        {
          id: "completed-round-1",
          tournamentId: completedTournamentId,
          number: 1,
          stage: "swiss",
          status: "completed",
          matches: [
            {
              id: "completed-match-1",
              roundId: "completed-round-1",
              tableNo: 1,
              player1EntryId: "completed-entry-1",
              player2EntryId: "completed-entry-4",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
            {
              id: "completed-match-2",
              roundId: "completed-round-1",
              tableNo: 2,
              player1EntryId: "completed-entry-2",
              player2EntryId: "completed-entry-3",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
          ],
        },
        {
          id: "completed-round-2",
          tournamentId: completedTournamentId,
          number: 2,
          stage: "swiss",
          status: "completed",
          matches: [
            {
              id: "completed-match-3",
              roundId: "completed-round-2",
              tableNo: 1,
              player1EntryId: "completed-entry-1",
              player2EntryId: "completed-entry-2",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
            {
              id: "completed-match-4",
              roundId: "completed-round-2",
              tableNo: 2,
              player1EntryId: "completed-entry-3",
              player2EntryId: "completed-entry-4",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
          ],
        },
        {
          id: "completed-round-3",
          tournamentId: completedTournamentId,
          number: 3,
          stage: "swiss",
          status: "completed",
          matches: [
            {
              id: "completed-match-5",
              roundId: "completed-round-3",
              tableNo: 1,
              player1EntryId: "completed-entry-1",
              player2EntryId: "completed-entry-3",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
            {
              id: "completed-match-6",
              roundId: "completed-round-3",
              tableNo: 2,
              player1EntryId: "completed-entry-2",
              player2EntryId: "completed-entry-4",
              player1Games: 2,
              player2Games: 0,
              result: "p1_win",
            },
          ],
        },
      ],
    },
    bans: {
      [tournamentId]: [],
      "mock-tournament-2": [],
      [completedTournamentId]: [],
    },
  };
}

function mergeSeedEntries(currentEntries, seedEntries) {
  const seedEntryIds = new Set(seedEntries.map((entry) => String(entry.id)));
  const customEntries = (Array.isArray(currentEntries) ? currentEntries : []).filter(
    (entry) => !seedEntryIds.has(String(entry?.id))
  );
  return [...seedEntries, ...customEntries];
}

function migrateMockSeedStore(store) {
  const seedVersion = Number(store.seedVersion || 0);
  const hasKnownSeed = store.tournaments.some(
    (tournament) => String(tournament?.id) === "mock-tournament-1"
  );
  if (!hasKnownSeed || seedVersion >= MOCK_SEED_VERSION) {
    return { store, migrated: false };
  }

  const latestSeed = createInitialStore();
  const inProgressId = "mock-tournament-1";
  const completedId = "mock-tournament-3";
  const latestInProgress = latestSeed.tournaments.find(
    (tournament) => tournament.id === inProgressId
  );
  const latestCompleted = latestSeed.tournaments.find(
    (tournament) => tournament.id === completedId
  );
  const inProgressEntries = mergeSeedEntries(
    store.entries[inProgressId],
    latestSeed.entries[inProgressId]
  );

  return {
    migrated: true,
    store: {
      ...store,
      seedVersion: MOCK_SEED_VERSION,
      tournaments: [
        ...store.tournaments
          .filter((tournament) => String(tournament?.id) !== completedId)
          .map((tournament) =>
            String(tournament?.id) === inProgressId
              ? {
                  ...tournament,
                  lateEntry: latestInProgress.lateEntry,
                  coOrganizers: Array.isArray(tournament.coOrganizers)
                    ? tournament.coOrganizers
                    : latestInProgress.coOrganizers,
                  entryCount: inProgressEntries.length,
                }
              : tournament
          ),
        latestCompleted,
      ],
      entries: {
        ...store.entries,
        [inProgressId]: inProgressEntries,
        [completedId]: mergeSeedEntries(
          store.entries[completedId],
          latestSeed.entries[completedId]
        ),
      },
      rounds: {
        ...store.rounds,
        [completedId]: latestSeed.rounds[completedId],
      },
    },
  };
}

function normalizeTournamentOperator(operator, fallbackName = "運営者") {
  if (!operator || operator.id == null) return null;
  return {
    id: String(operator.id),
    name: String(operator.name || operator.nickname || fallbackName),
  };
}

function normalizeCoOrganizers(coOrganizers) {
  const seen = new Set();
  return (Array.isArray(coOrganizers) ? coOrganizers : [])
    .map((operator) => normalizeTournamentOperator(operator, "共同運営者"))
    .filter((operator) => {
      if (!operator || seen.has(operator.id)) return false;
      seen.add(operator.id);
      return true;
    });
}

function normalizeTournament(tournament, entries = []) {
  if (!tournament?.id) return null;
  return {
    ...tournament,
    id: String(tournament.id),
    format: tournament.format || "swiss",
    swissRounds: tournament.swissRounds ?? null,
    swissEndCondition: getSwissEndCondition(tournament),
    topCutSize: tournament.topCutSize ?? null,
    status: tournament.status || "draft",
    checkinOpensAt: tournament.checkinOpensAt || null,
    capacity: tournament.capacity ?? null,
    venue: tournament.venue ? String(tournament.venue) : null,
    isOnline: Boolean(tournament.isOnline),
    isListed: tournament.isListed !== false,
    selfCheckin: Boolean(tournament.selfCheckin),
    decklistsPublic: Boolean(tournament.decklistsPublic),
    decklistRequired: Boolean(tournament.decklistRequired),
    announcement: tournament.announcement ? String(tournament.announcement) : null,
    roundTimeMinutes: tournament.roundTimeMinutes ?? null,
    lateEntry: Boolean(tournament.lateEntry),
    regulation: { ...DEFAULT_REGULATION, ...(tournament.regulation || {}) },
    createdBy: normalizeTournamentOperator(tournament.createdBy, "主催者"),
    coOrganizers: normalizeCoOrganizers(tournament.coOrganizers).filter(
      (operator) => String(operator.id) !== String(tournament.createdBy?.id)
    ),
    entryCount: countActiveEntries(entries),
  };
}

function normalizeEntryActor(actor) {
  if (actor == null) return null;
  if (typeof actor !== "object") {
    return { id: String(actor), name: "主催者" };
  }
  if (actor.id == null) return null;
  return {
    id: String(actor.id),
    name: actor.name || "主催者",
  };
}

function deriveDecklistState(entry, tournament) {
  // §2 explicitly keeps a checked-in but unsubmitted entry in `none`;
  // deckLockedAt still blocks submission independently.
  if (!entry.decklistSubmittedAt) return "none";
  if (tournament?.status === "completed" && tournament.decklistsPublic) return "revealed";
  if (entry.deckLockedAt) return "locked";
  return "submitted";
}

function normalizeEntry(entry, tournament) {
  if (!entry?.id) return null;
  const normalized = {
    ...entry,
    id: String(entry.id),
    tournamentId: String(entry.tournamentId),
    user: {
      id: entry.user?.id == null ? null : String(entry.user.id),
      name: entry.user?.name || "プレイヤー",
    },
    deckItems: Array.isArray(entry.deckItems) ? entry.deckItems : null,
    decklistSubmittedAt: entry.decklistSubmittedAt || null,
    deckFormat: entry.deckFormat || null,
    deckLockedAt: entry.deckLockedAt || null,
    deckUpdatedBy: normalizeEntryActor(entry.deckUpdatedBy),
    deckUpdatedAt: entry.deckUpdatedAt || null,
    deckUnlockedBy: normalizeEntryActor(entry.deckUnlockedBy),
    deckUnlockedAt: entry.deckUnlockedAt || null,
    finalRank:
      entry.finalRank == null || !Number.isFinite(Number(entry.finalRank))
        ? null
        : Number(entry.finalRank),
    status: entry.status || "registered",
    isWaitlisted: Boolean(entry.isWaitlisted),
    joinedAtRound: Math.max(1, Number(entry.joinedAtRound || 1)),
    createdAt: entry.createdAt || nowIso(),
  };
  return {
    ...normalized,
    decklistState: deriveDecklistState(normalized, tournament),
  };
}

function withoutDerivedEntryState(entry) {
  const { decklistState, ...storedEntry } = entry;
  return storedEntry;
}

function setEntries(store, tournamentId, entries) {
  store.entries[String(tournamentId)] = entries.map(withoutDerivedEntryState);
}

function countActiveEntries(entries) {
  return entries.filter((entry) => entry.status !== "dropped").length;
}

function countAdmittedEntries(entries) {
  return entries.filter(
    (entry) =>
      !["pending", "dropped"].includes(entry.status) && !entry.isWaitlisted
  ).length;
}

function shouldWaitlistEntry(tournament, entries) {
  if (tournament.capacity == null) return false;
  const capacity = Number(tournament.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) return false;
  const hasActiveWaitlist = entries.some(
    (entry) => entry.isWaitlisted && entry.status !== "dropped"
  );
  return hasActiveWaitlist || countAdmittedEntries(entries) >= capacity;
}

function compareEntriesByRegistrationOrder(left, right) {
  const createdAtComparison = String(left.createdAt || "").localeCompare(
    String(right.createdAt || "")
  );
  if (createdAtComparison !== 0) return createdAtComparison;
  return compareEntryIds(left.id, right.id);
}

function normalizeBanRecord(record) {
  const userId = record?.user?.id ?? record?.userId;
  if (userId == null) return null;
  return {
    user: {
      id: String(userId),
      name: record?.user?.name || record?.userName || "参加者",
    },
    bannedAt: record?.bannedAt || null,
  };
}

function getTournamentBans(store, tournamentId) {
  const records = store.bans?.[String(tournamentId)];
  return (Array.isArray(records) ? records : []).map(normalizeBanRecord).filter(Boolean);
}

function setTournamentBans(store, tournamentId, records) {
  if (!store.bans || typeof store.bans !== "object") store.bans = {};
  store.bans[String(tournamentId)] = records.map(normalizeBanRecord).filter(Boolean);
}

function createUniqueEntryId(entries, prefix) {
  const ids = new Set(entries.map((entry) => String(entry.id)));
  if (!ids.has(prefix)) return prefix;
  let suffix = 2;
  while (ids.has(`${prefix}-${suffix}`)) suffix += 1;
  return `${prefix}-${suffix}`;
}

function readStore() {
  if (typeof window === "undefined") return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initialStore = createInitialStore();
      writeStore(initialStore);
      return initialStore;
    }
    const parsed = JSON.parse(raw);
    const store = {
      tournaments: Array.isArray(parsed.tournaments) ? parsed.tournaments : [],
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
      rounds: parsed.rounds && typeof parsed.rounds === "object" ? parsed.rounds : {},
      bans: parsed.bans && typeof parsed.bans === "object" ? parsed.bans : {},
    };
    if (parsed.seedVersion != null) {
      store.seedVersion = Number(parsed.seedVersion) || 0;
    }
    const migration = migrateMockSeedStore(store);
    if (migration.migrated) writeStore(migration.store);
    return migration.store;
  } catch (error) {
    console.warn("Failed to read tournaments from localStorage.", error);
    return createInitialStore();
  }
}

function writeStore(store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function ensureMockTournamentStore() {
  const store = readStore();
  return {
    ...(store.seedVersion != null ? { seedVersion: store.seedVersion } : {}),
    tournaments: store.tournaments,
    entries: store.entries,
    rounds: store.rounds,
  };
}

function getTournamentOrThrow(store, tournamentId) {
  const id = String(tournamentId);
  const tournament = store.tournaments.find((item) => String(item.id) === id);
  if (!tournament) throw new Error("大会が見つかりません。");
  return tournament;
}

function createServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getCurrentViewer(user) {
  const viewer = user?.id ? user : readMockViewer();
  if (!viewer?.id) {
    throw createServiceError("ログインしてから操作してください。", 401);
  }
  return {
    id: String(viewer.id),
    role: viewer.role || "user",
  };
}

function getAuditActor(user, tournament) {
  const viewer = user?.id ? user : readMockViewer();
  if (!viewer?.id) {
    throw createServiceError("ログインしてから操作してください。", 401);
  }
  const id = String(viewer.id);
  const { isCreator } = getTournamentPermissions(tournament, viewer);
  const name = user?.id
    ? user.displayNickname ||
      user.nickname ||
      user.name ||
      (isCreator ? tournament.createdBy?.name : null)
    : viewer.name;
  return { id, name: name || "主催者" };
}

function deckFormatForTournament(tournament) {
  return tournament?.regulation?.name || DEFAULT_REGULATION.name || null;
}

export function getTournamentPermissions(tournament, viewer) {
  const viewerId = viewer?.id == null ? "" : String(viewer.id);
  const isAuthenticated = Boolean(viewerId);
  const isAdmin = isAuthenticated && viewer?.role === "admin";
  const isCreator =
    isAuthenticated &&
    tournament?.createdBy?.id != null &&
    String(tournament.createdBy.id) === viewerId;
  const isCoOrganizer =
    isAuthenticated &&
    normalizeCoOrganizers(tournament?.coOrganizers).some(
      (operator) => operator.id === viewerId
    );

  return {
    isAuthenticated,
    isAdmin,
    isCreator,
    isCoOrganizer,
    canCreate: isAuthenticated && (viewer?.role === "organizer" || isAdmin),
    canManage: isAdmin || isCreator || isCoOrganizer,
    canDelete: isAdmin || isCreator,
    canManageCoOrganizers: isAdmin || isCreator,
  };
}

export function canManageTournament(tournament, viewer) {
  return getTournamentPermissions(tournament, viewer).canManage;
}

function assertCanManageTournament(tournament, viewer) {
  if (canManageTournament(tournament, viewer)) return;
  throw createServiceError("この大会を管理する権限がありません。", 403);
}

function assertCanAdministerTournament(tournament, viewer) {
  if (getTournamentPermissions(tournament, viewer).canManageCoOrganizers) return;
  throw createServiceError("この操作は大会の作成者または管理者のみ実行できます。", 403);
}

function getEntries(store, tournamentId) {
  const tournament = store.tournaments.find(
    (item) => String(item.id) === String(tournamentId)
  );
  return (store.entries[String(tournamentId)] || [])
    .map((entry) => normalizeEntry(entry, tournament))
    .filter(Boolean);
}

function getRounds(store, tournamentId) {
  return Array.isArray(store.rounds[String(tournamentId)]) ? store.rounds[String(tournamentId)] : [];
}

function isBefore(dateString) {
  if (!dateString) return true;
  return Date.now() < new Date(dateString).getTime();
}

function isSameLocalDate(dateString, now = new Date()) {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatMonthDayTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "設定された時刻";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function assertCheckinOpensAtIsValid(checkinOpensAt, startsAt) {
  if (!checkinOpensAt) return;
  const checkinTime = new Date(checkinOpensAt).getTime();
  if (Number.isNaN(checkinTime)) {
    throw new Error("チェックイン開始に正しい日時を設定してください。");
  }
  const startTime = new Date(startsAt).getTime();
  if (!Number.isNaN(startTime) && checkinTime > startTime) {
    throw new Error("チェックイン開始は大会の開始日時以前に設定してください。");
  }
}

function assertCanEnter(tournament, entries, currentUser) {
  const acceptsLateEntry = tournament.status === "in_progress" && tournament.lateEntry;
  if (tournament.status !== "registration" && !acceptsLateEntry) {
    throw new Error("現在この大会にはエントリーできません。");
  }
  if (!acceptsLateEntry && !isBefore(tournament.registrationClosesAt)) {
    throw new Error("エントリー締切を過ぎています。");
  }
  if (entries.some((entry) => entry.user.id === currentUser.id && entry.status !== "dropped")) {
    throw new Error("すでにエントリー済みです。");
  }
}

function assertUserIsNotBanned(store, tournamentId, currentUser) {
  if (
    getTournamentBans(store, tournamentId).some(
      (record) => record.user.id === String(currentUser.id)
    )
  ) {
    throw createServiceError(
      "この大会への再エントリーは禁止されています。主催者にお問い合わせください。",
      403
    );
  }
}

function assertDeckIsValid(deckItems, regulation, { required = false } = {}) {
  if ((!Array.isArray(deckItems) || deckItems.length === 0) && !required) return;
  const violations = validateDeck(deckItems, regulation);
  if (violations.length === 0) return;

  const error = new Error("デッキリストがレギュレーションに違反しています。");
  error.violations = violations;
  throw error;
}

function assertCanChangeEntry(tournament, entry) {
  if (!["registration", "in_progress"].includes(tournament.status)) {
    throw new Error("この大会のエントリーは変更できません。");
  }
  if (!isBefore(tournament.registrationClosesAt)) {
    throw new Error("デッキリスト提出締切を過ぎています。");
  }
  if (entry.deckLockedAt) {
    throw new Error("デッキリストはロックされています。主催者にお問い合わせください。");
  }
}

function assertCanDeleteEntry(tournament) {
  if (tournament.status !== "registration" || !isBefore(tournament.startsAt)) {
    throw new Error("エントリー取消は大会開始前のみ可能です。");
  }
}

function sanitizeEntryForViewer(entry, tournament, viewer) {
  const isOwner = viewer?.id && entry.user.id === String(viewer.id);
  const canManage = canManageTournament(tournament, viewer);
  const isPublicAfterCompleted = tournament.status === "completed" && tournament.decklistsPublic;
  if (isOwner || canManage || isPublicAfterCompleted) return entry;
  return { ...entry, deckItems: null, decklistSubmittedAt: entry.decklistSubmittedAt };
}

function flattenMatches(rounds) {
  return rounds.flatMap((round) => (Array.isArray(round.matches) ? round.matches : []));
}

function entryHasMatchReference(rounds, entryId) {
  const id = String(entryId);
  return flattenMatches(rounds).some(
    (match) =>
      String(match.player1EntryId) === id ||
      (match.player2EntryId != null && String(match.player2EntryId) === id)
  );
}

function activeEntriesForPairing(entries) {
  return entries.filter(
    (entry) => entry.status === "checked_in" && !entry.isWaitlisted
  );
}

function activeEntriesForRound(entries, roundNumber) {
  return activeEntriesForPairing(entries).filter(
    (entry) => Number(entry.joinedAtRound || 1) <= Number(roundNumber)
  );
}

function nextJoinRound(store, tournamentId) {
  return getRounds(store, tournamentId).length + 1;
}

function deriveResultFromGames({ player1Games, player2Games, result, isBye }) {
  if (isBye) return "bye";
  if (result != null && (player1Games == null || player2Games == null)) {
    if (!["p1_win", "p2_win", "draw"].includes(result)) {
      throw new Error("不正な結果です。");
    }
    return result;
  }

  const p1 = Number(player1Games);
  const p2 = Number(player2Games);
  if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0) {
    throw new Error("ゲーム数を正しく入力してください。");
  }
  if (p1 > p2) return "p1_win";
  if (p2 > p1) return "p2_win";
  return "draw";
}

function winnerEntryId(match, result = match.result) {
  if (result === "p1_win" || result === "bye") return match.player1EntryId;
  if (result === "p2_win") return match.player2EntryId;
  return null;
}

function isMatchParticipant(match, viewer, entries) {
  if (!viewer?.id) return false;
  const viewerEntry = entries.find((entry) => entry.user?.id === String(viewer.id));
  if (!viewerEntry) return false;
  return [match.player1EntryId, match.player2EntryId].some(
    (entryId) => entryId != null && String(entryId) === String(viewerEntry.id)
  );
}

function sanitizeMatchForViewer(match, tournament, viewer, entries, roundStatus) {
  const nextWinnerEntryId = winnerEntryId(match);
  if (
    tournament.status === "completed" ||
    roundStatus === "completed" ||
    canManageTournament(tournament, viewer) ||
    isMatchParticipant(match, viewer, entries)
  ) {
    return { ...match, winnerEntryId: nextWinnerEntryId };
  }
  return {
    ...match,
    player1Games: null,
    player2Games: null,
    result: null,
    winnerEntryId: null,
  };
}

function sanitizeRoundsForViewer(rounds, tournament, viewer, entries) {
  return rounds.map((round) => ({
    ...round,
    matches: (round.matches || []).map((match) =>
      sanitizeMatchForViewer(match, tournament, viewer, entries, round.status)
    ),
  }));
}

function swissRoundLimit(tournament, activeCount) {
  if (tournament.swissRounds != null && Number(tournament.swissRounds) > 0) {
    return Number(tournament.swissRounds);
  }
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, activeCount))));
}

function makeRound({ tournamentId, number, stage, pairs }) {
  const roundId = `round-${tournamentId}-${number}-${Date.now()}`;
  return {
    id: roundId,
    tournamentId: String(tournamentId),
    number,
    stage,
    status: "in_progress",
    matches: pairs.map((pair, index) => ({
      id: `match-${roundId}-${index + 1}`,
      roundId,
      tableNo: index + 1,
      player1EntryId: pair.player1EntryId,
      player2EntryId: pair.player2EntryId ?? null,
      player1Games: null,
      player2Games: null,
      result: pair.player2EntryId == null ? "bye" : null,
    })),
    timerStartedAt: null,
  };
}

function roundComplete(round) {
  return (round.matches || []).every((match) => Boolean(match.result));
}

function completedRounds(rounds, stage = null) {
  return rounds.filter((round) => round.status === "completed" && (!stage || round.stage === stage));
}

function swissStageIsDone(tournament, rounds, entries) {
  const completedSwissRounds = completedRounds(rounds, "swiss");
  if (completedSwissRounds.length >= swissRoundLimit(tournament, entries.length)) {
    return true;
  }
  if (
    completedSwissRounds.length === 0 ||
    getSwissEndCondition(tournament) !== SWISS_END_CONDITION_UNDEFEATED
  ) {
    return false;
  }

  const standings = computeStandings(entries, flattenMatches(completedSwissRounds));
  const undefeatedCount = standings.filter(
    (standing) => standing.losses === 0 && standing.draws === 0
  ).length;
  return undefeatedCount <= 1;
}

function assertNoOpenRound(rounds) {
  if (rounds.some((round) => round.status !== "completed")) {
    throw new Error("進行中のラウンドがあります。");
  }
}

function updateTournamentStatusIfDone(tournament, rounds, entries) {
  const completed = completedRounds(rounds);
  const topCutRounds = completedRounds(rounds, "top_cut");

  if (tournament.format === "single_elim") {
    const lastRound = completed[completed.length - 1];
    if (lastRound?.matches?.length === 1) return "completed";
    return tournament.status;
  }

  if (topCutRounds.length > 0) {
    const lastTopCut = topCutRounds[topCutRounds.length - 1];
    if (lastTopCut?.matches?.length === 1) return "completed";
    return tournament.status;
  }

  if (!tournament.topCutSize && swissStageIsDone(tournament, rounds, entries)) {
    return "completed";
  }
  return tournament.status;
}

function retainActivePairParticipants(pairs, activeEntryIds) {
  return pairs
    .map((pair) => {
      const player1EntryId = activeEntryIds.has(String(pair.player1EntryId))
        ? pair.player1EntryId
        : null;
      const player2EntryId = activeEntryIds.has(String(pair.player2EntryId))
        ? pair.player2EntryId
        : null;
      if (player1EntryId == null && player2EntryId == null) return null;
      return player1EntryId == null
        ? { player1EntryId: player2EntryId, player2EntryId: null }
        : { player1EntryId, player2EntryId };
    })
    .filter(Boolean);
}

function buildNextRound(store, tournamentId) {
  const tournament = getTournamentOrThrow(store, tournamentId);
  const rounds = getRounds(store, tournamentId);
  assertNoOpenRound(rounds);

  const nextNumber = rounds.length + 1;
  const allEntries = getEntries(store, tournamentId);
  const entries = activeEntriesForRound(allEntries, nextNumber);
  const activeEntryIds = new Set(entries.map((entry) => String(entry.id)));
  if (entries.length < 2) {
    throw new Error(
      `次ラウンド生成にはチェックイン済みの参加者が2人以上必要です（現在${entries.length}人）。`
    );
  }
  let pairs = [];
  let stage = "swiss";

  if (tournament.format === "single_elim") {
    stage = "top_cut";
    const lastCompleted = completedRounds(rounds).slice(-1)[0];
    pairs = lastCompleted
      ? retainActivePairParticipants(
          nextRoundPairs(lastCompleted.matches || []),
          activeEntryIds
        )
      : buildBracket(entries.map((entry) => entry.id));
  } else {
    const topCutCompleted = completedRounds(rounds, "top_cut");

    if (topCutCompleted.length > 0) {
      stage = "top_cut";
      pairs = retainActivePairParticipants(
        nextRoundPairs(topCutCompleted[topCutCompleted.length - 1].matches || []),
        activeEntryIds
      );
    } else if (swissStageIsDone(tournament, rounds, entries)) {
      if (!tournament.topCutSize) {
        throw new Error("全ラウンドが終了しています。");
      }
      stage = "top_cut";
      const matches = flattenMatches(rounds);
      const cutEntryIds = computeStandings(allEntries, matches)
        .filter((standing) => activeEntryIds.has(String(standing.entryId)))
        .slice(0, Number(tournament.topCutSize))
        .map((standing) => standing.entryId);
      pairs = buildBracket(cutEntryIds);
    } else {
      pairs = pairSwissRound(entries, flattenMatches(rounds), allEntries);
    }
  }

  if (pairs.length === 0 || (pairs.length === 1 && pairs[0].player2EntryId == null)) {
    throw new Error("次ラウンドを生成できません。");
  }

  return makeRound({ tournamentId, number: nextNumber, stage, pairs });
}

async function requestJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response
    .json()
    .catch(() => ({ error: `Request failed with status ${response.status}` }));

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    if (payload?.code) error.code = payload.code;
    if (response.status === 404 && !error.code) error.code = "not_found";
    if (payload?.firstDiscardedRoundNumber != null) {
      error.firstDiscardedRoundNumber = Number(payload.firstDiscardedRoundNumber);
    }
    if (payload?.discardedRoundCount != null) {
      error.discardedRoundCount = Number(payload.discardedRoundCount);
    }
    if (payload?.violations) error.violations = payload.violations;
    throw error;
  }

  return payload;
}

export async function fetchTournaments({ status = "", page = 1, authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const viewer = user?.id ? user : readMockViewer();
    const visible = store.tournaments
      .map((tournament) => normalizeTournament(tournament, getEntries(store, tournament.id)))
      .filter(Boolean)
      .filter((tournament) => {
        const { isCreator, isCoOrganizer } = getTournamentPermissions(
          tournament,
          viewer
        );
        return tournament.isListed || isCreator || isCoOrganizer;
      })
      .filter(
        (tournament) =>
          tournament.status !== "draft" ||
          canManageTournament(tournament, viewer)
      )
      .filter((tournament) => !status || tournament.status === status)
      .sort((left, right) => String(right.startsAt || "").localeCompare(String(left.startsAt || "")));
    const safePage = Math.max(1, Number(page) || 1);
    const start = (safePage - 1) * PAGE_SIZE;
    return {
      items: visible.slice(start, start + PAGE_SIZE),
      total: visible.length,
      page: safePage,
      pageSize: PAGE_SIZE,
    };
  }

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page) query.set("page", String(page));
  return requestJson(`/api/tournaments?${query.toString()}`, { method: "GET" });
}

export async function fetchTournament(id, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = normalizeTournament(getTournamentOrThrow(store, id), getEntries(store, id));
    const viewer = user?.id ? user : readMockViewer();
    const entries = getEntries(store, id).map((entry) =>
      sanitizeEntryForViewer(entry, tournament, viewer)
    );
    const currentUserId = viewer?.id;
    const myEntry = currentUserId
      ? entries.find(
          (entry) =>
            entry.user.id === String(currentUserId) && entry.status !== "dropped"
        ) || null
      : null;
    return { ...tournament, entries, myEntry };
  }

  return requestJson(`/api/tournaments/${id}`, { method: "GET" });
}

export async function fetchMyTournaments({ authMode, user } = {}) {
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const items = store.tournaments
      .map((rawTournament) => {
        const entries = getEntries(store, rawTournament.id);
        const entry = entries.find(
          (item) => item.user?.id === currentUser.id && item.status !== "dropped"
        );
        const canManage = canManageTournament(rawTournament, viewer);
        if (!entry && !canManage) return null;
        const tournament = normalizeTournament(rawTournament, entries);
        return {
          tournament,
          entry: entry || null,
          needsDecklist: Boolean(
            entry && tournament.decklistRequired && !entry.decklistSubmittedAt
          ),
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        String(right.tournament.startsAt || "").localeCompare(String(left.tournament.startsAt || ""))
      );
    return { items };
  }

  return requestJson("/api/users/me/tournaments", { method: "GET" });
}

export async function fetchStandings(id, { authMode, round } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const entries = getEntries(store, id);
    const rounds = getRounds(store, id).filter((item) => item.stage !== "top_cut");
    const matches = flattenMatches(
      round == null ? rounds : rounds.filter((item) => Number(item.number) <= Number(round))
    );
    const standings = computeStandings(entries, matches).map((standing) => {
      const entry = entries.find((item) => item.id === standing.entryId);
      return {
        ...standing,
        entry: entry ? { ...entry, deckItems: null } : entry,
      };
    });
    return { items: standings };
  }

  const query = round == null ? "" : `?round=${encodeURIComponent(round)}`;
  return requestJson(`/api/tournaments/${id}/standings${query}`, { method: "GET" });
}

export async function fetchRounds(id, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, id);
    const viewer = user?.id ? user : readMockViewer();
    return {
      rounds: sanitizeRoundsForViewer(getRounds(store, id), tournament, viewer, getEntries(store, id)),
    };
  }

  return requestJson(`/api/tournaments/${id}/rounds`, { method: "GET" });
}

export async function fetchRoundsForManage(id, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, id);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    return {
      rounds: getRounds(store, id).map((round) => ({
        ...round,
        matches: (round.matches || []).map((match) => ({
          ...match,
          winnerEntryId: winnerEntryId(match),
        })),
      })),
    };
  }

  return requestJson(`/api/tournaments/${id}/rounds`, { method: "GET" });
}

export async function createEntry({ tournamentId, deckItems = null, authMode, user }) {
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    const entries = getEntries(store, tournamentId);
    assertUserIsNotBanned(store, tournamentId, currentUser);
    assertCanEnter(tournament, entries, currentUser);
    assertDeckIsValid(deckItems, tournament.regulation, { required: tournament.decklistRequired });

    const now = nowIso();
    const isLatePending = tournament.status === "in_progress" && tournament.lateEntry;
    const isWaitlisted = !isLatePending && shouldWaitlistEntry(tournament, entries);
    const hasDeckItems = Array.isArray(deckItems) && deckItems.length > 0;
    const entry = normalizeEntry(
      {
        id: createUniqueEntryId(entries, `entry-${Date.now()}`),
        tournamentId,
        user: currentUser,
        deckItems: hasDeckItems ? deckItems : null,
        decklistSubmittedAt: hasDeckItems ? now : null,
        deckFormat: hasDeckItems ? deckFormatForTournament(tournament) : null,
        status: isLatePending ? "pending" : "registered",
        isWaitlisted,
        joinedAtRound: isLatePending ? nextJoinRound(store, tournamentId) : 1,
        createdAt: now,
      },
      tournament
    );
    setEntries(store, tournamentId, [entry, ...entries]);
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: countActiveEntries(entries) + 1, updatedAt: now }
        : item
    );
    writeStore(store);
    return entry;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries`, {
    method: "POST",
    body: JSON.stringify({
      deckItems: Array.isArray(deckItems) && deckItems.length > 0 ? deckItems : undefined,
    }),
  });
}

export async function updateMyEntry({ tournamentId, deckItems = null, authMode, user }) {
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    const entries = getEntries(store, tournamentId);
    const existing = entries.find(
      (entry) => entry.user.id === currentUser.id && entry.status !== "dropped"
    );
    if (!existing) throw new Error("エントリーが見つかりません。");
    assertCanChangeEntry(tournament, existing);
    assertDeckIsValid(deckItems, tournament.regulation, { required: true });

    const now = nowIso();
    const hasDeckItems = Array.isArray(deckItems) && deckItems.length > 0;
    const updated = normalizeEntry(
      {
        ...existing,
        deckItems: hasDeckItems ? deckItems : null,
        decklistSubmittedAt: hasDeckItems ? now : null,
        deckFormat: hasDeckItems ? deckFormatForTournament(tournament) : null,
        deckLockedAt: existing.deckUnlockedAt ? now : null,
      },
      tournament
    );
    setEntries(
      store,
      tournamentId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    writeStore(store);
    return updated;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/me`, {
    method: "PUT",
    body: JSON.stringify({
      deckItems: Array.isArray(deckItems) && deckItems.length > 0 ? deckItems : undefined,
    }),
  });
}

export async function deleteMyEntry(tournamentId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanDeleteEntry(tournament);
    const entries = getEntries(store, tournamentId);
    const nextEntries = entries.filter((entry) => entry.user.id !== currentUser.id);
    if (nextEntries.length === entries.length) throw new Error("エントリーが見つかりません。");
    setEntries(store, tournamentId, nextEntries);
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: countActiveEntries(nextEntries), updatedAt: nowIso() }
        : item
    );
    writeStore(store);
    return;
  }

  await requestJson(`/api/tournaments/${tournamentId}/entries/me`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

export async function createTournament(data = {}) {
  const { authMode, user, ...payload } = data;
  const swissEndCondition = getSwissEndCondition(payload);
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const checkinOpensAt = payload.checkinOpensAt || null;
    assertCheckinOpensAtIsValid(checkinOpensAt, payload.startsAt);
    const now = nowIso();
    const id = `tournament-${Date.now()}`;
    const tournament = normalizeTournament(
      {
        id,
        title: payload.title || "新規大会",
        description: payload.description || "",
        format: payload.format || "swiss",
        swissRounds: payload.swissRounds ?? null,
        swissEndCondition,
        topCutSize: payload.topCutSize ?? null,
        status: payload.status || "draft",
        startsAt: payload.startsAt || "",
        registrationClosesAt: payload.registrationClosesAt || "",
        checkinOpensAt,
        capacity: payload.capacity ?? null,
        venue: payload.venue ? String(payload.venue) : null,
        isOnline: Boolean(payload.isOnline),
        isListed: payload.isListed !== false,
        selfCheckin: Boolean(payload.selfCheckin),
        decklistsPublic: Boolean(payload.decklistsPublic),
        decklistRequired: Boolean(payload.decklistRequired),
        announcement: payload.announcement ? String(payload.announcement) : null,
        roundTimeMinutes: payload.roundTimeMinutes ?? null,
        lateEntry: Boolean(payload.lateEntry),
        regulation: { ...DEFAULT_REGULATION, ...(payload.regulation || {}) },
        createdBy: currentUser,
        coOrganizers: [],
        entryCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      []
    );
    store.tournaments = [tournament, ...store.tournaments];
    store.entries[id] = [];
    store.rounds[id] = [];
    if (!store.bans || typeof store.bans !== "object") store.bans = {};
    store.bans[id] = [];
    writeStore(store);
    return tournament;
  }

  return requestJson("/api/tournaments", {
    method: "POST",
    body: JSON.stringify({ ...payload, swissEndCondition }),
  });
}

export async function updateTournament({ id, authMode, user, ...data }) {
  delete data.createdBy;
  delete data.coOrganizers;
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const existing = getTournamentOrThrow(store, id);
    assertCanManageTournament(existing, viewer);
    const nextStartsAt = Object.prototype.hasOwnProperty.call(data, "startsAt")
      ? data.startsAt
      : existing.startsAt;
    const nextCheckinOpensAt = Object.prototype.hasOwnProperty.call(data, "checkinOpensAt")
      ? data.checkinOpensAt
      : existing.checkinOpensAt;
    assertCheckinOpensAtIsValid(nextCheckinOpensAt, nextStartsAt);
    const statusOrder = ["draft", "registration", "in_progress", "completed"];
    if (data.status && data.status !== existing.status) {
      const from = statusOrder.indexOf(existing.status);
      const to = statusOrder.indexOf(data.status);
      const canCancel = data.status === "cancelled" && existing.status !== "completed";
      if (!canCancel && (to === -1 || from === -1 || to < from || to > from + 1)) {
        throw new Error("不正なステータス遷移です。");
      }
    }

    const entries = getEntries(store, id);
    const rounds = getRounds(store, id);
    if (rounds.length > 0) {
      ["format", "swissRounds", "swissEndCondition", "topCutSize"].forEach((field) => {
        const nextValue =
          field === "swissEndCondition"
            ? getSwissEndCondition({ swissEndCondition: data[field] })
            : data[field];
        const existingValue =
          field === "swissEndCondition" ? getSwissEndCondition(existing) : existing[field];
        if (
          Object.prototype.hasOwnProperty.call(data, field) &&
          nextValue !== existingValue
        ) {
          throw new Error(
            "ラウンド生成後は大会形式・回戦数・終了条件・トップカット人数を変更できません。"
          );
        }
      });
    }
    const regulationChanged = Object.prototype.hasOwnProperty.call(data, "regulation");
    const nextRegulation = {
      ...DEFAULT_REGULATION,
      ...(existing.regulation || {}),
      ...(data.regulation || {}),
    };
    const violations = regulationChanged
      ? entries
          .filter((entry) => Array.isArray(entry.deckItems) && entry.deckItems.length > 0)
          .map((entry) => ({
            entryId: entry.id,
            violations: validateDeck(entry.deckItems, nextRegulation),
          }))
          .filter((item) => item.violations.length > 0)
      : [];
    const updated = normalizeTournament(
      {
        ...existing,
        ...data,
        regulation: nextRegulation,
        updatedAt: nowIso(),
      },
      entries
    );
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(id) ? updated : item
    );
    writeStore(store);
    return regulationChanged ? { ...updated, violations } : updated;
  }

  return requestJson(`/api/tournaments/${id}`, {
    method: "PUT",
    body: JSON.stringify(
      Object.prototype.hasOwnProperty.call(data, "swissEndCondition")
        ? { ...data, swissEndCondition: getSwissEndCondition(data) }
        : data
    ),
  });
}

export async function deleteTournament(id, { authMode, user } = {}) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const existing = getTournamentOrThrow(store, id);
    assertCanAdministerTournament(existing, viewer);
    if (existing.status !== "draft") {
      throw new Error("下書きの大会のみ削除できます。");
    }
    store.tournaments = store.tournaments.filter((item) => String(item.id) !== String(id));
    delete store.entries[String(id)];
    delete store.rounds[String(id)];
    if (store.bans && typeof store.bans === "object") delete store.bans[String(id)];
    writeStore(store);
    return;
  }

  await requestJson(`/api/tournaments/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

async function resolveCoOrganizerUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw createServiceError("追加するユーザーを選択してください。", 400);
  }
  const payload = await fetchUsers({ query: normalizedUserId, authMode: "mock" });
  const target = (payload.items || []).find((item) => String(item.id) === normalizedUserId);
  if (!target) {
    throw createServiceError("ユーザーが見つかりません。", 404);
  }
  return {
    id: normalizedUserId,
    name: target.nickname || normalizedUserId,
  };
}

export async function addTournamentCoOrganizer({ tournamentId, userId, authMode, user }) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanAdministerTournament(tournament, viewer);
    const target = await resolveCoOrganizerUser(userId);
    if (String(tournament.createdBy?.id) === target.id) {
      throw createServiceError("大会の作成者はすでに運営者です。", 409);
    }
    const coOrganizers = normalizeCoOrganizers(tournament.coOrganizers);
    if (coOrganizers.some((operator) => operator.id === target.id)) {
      throw createServiceError("このユーザーはすでに共同運営者です。", 409);
    }
    const updated = normalizeTournament(
      {
        ...tournament,
        coOrganizers: [...coOrganizers, target],
        updatedAt: nowIso(),
      },
      getEntries(store, tournamentId)
    );
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId) ? updated : item
    );
    writeStore(store);
    return updated;
  }

  const payload = await requestJson(`/api/tournaments/${tournamentId}/co-organizers`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return payload.tournament || payload;
}

export async function removeTournamentCoOrganizer({ tournamentId, userId, authMode, user }) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanAdministerTournament(tournament, viewer);
    const targetUserId = String(userId || "").trim();
    if (!targetUserId) {
      throw createServiceError("削除する共同運営者を指定してください。", 400);
    }
    if (String(tournament.createdBy?.id) === targetUserId) {
      throw createServiceError("大会の作成者は運営者から削除できません。", 409);
    }
    const coOrganizers = normalizeCoOrganizers(tournament.coOrganizers);
    const nextCoOrganizers = coOrganizers.filter((operator) => operator.id !== targetUserId);
    if (nextCoOrganizers.length === coOrganizers.length) {
      throw createServiceError("共同運営者が見つかりません。", 404);
    }
    const updated = normalizeTournament(
      {
        ...tournament,
        coOrganizers: nextCoOrganizers,
        updatedAt: nowIso(),
      },
      getEntries(store, tournamentId)
    );
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId) ? updated : item
    );
    writeStore(store);
    return updated;
  }

  const payload = await requestJson(
    `/api/tournaments/${tournamentId}/co-organizers/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({}),
    }
  );
  return payload.tournament || payload;
}

export async function checkInMyEntry({ tournamentId, authMode, user }) {
  if (authMode === "mock") {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = normalizeTournament(
      getTournamentOrThrow(store, tournamentId),
      getEntries(store, tournamentId)
    );
    if (!tournament.selfCheckin) {
      throw new Error("この大会はセルフチェックインを許可していません。");
    }
    if (tournament.checkinOpensAt) {
      const checkinOpensAt = new Date(tournament.checkinOpensAt).getTime();
      if (Number.isNaN(checkinOpensAt)) {
        throw new Error("チェックイン開始時刻が正しく設定されていません。主催者にお問い合わせください。");
      }
      if (Date.now() < checkinOpensAt) {
        throw new Error(
          `セルフチェックインは${formatMonthDayTime(tournament.checkinOpensAt)}から利用できます。`
        );
      }
    } else if (!isSameLocalDate(tournament.startsAt)) {
      throw new Error("セルフチェックインは開催日当日のみ利用できます。");
    }
    if (getRounds(store, tournamentId).length > 0) {
      throw new Error("ラウンド生成後はセルフチェックインできません。");
    }

    const entries = getEntries(store, tournamentId);
    const existing = entries.find(
      (entry) => entry.user.id === currentUser.id && entry.status !== "dropped"
    );
    if (!existing) throw new Error("エントリーが見つかりません。");

    const updated = normalizeEntry(
      {
        ...existing,
        status: "checked_in",
        deckLockedAt: existing.deckLockedAt || nowIso(),
      },
      tournament
    );
    setEntries(
      store,
      tournamentId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    writeStore(store);
    return updated;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/me/checkin`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchEntries(tournamentId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    return { items: getEntries(store, tournamentId) };
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries`, { method: "GET" });
}

export async function promoteWaitlistedEntries({ tournamentId, authMode, user }) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    const entries = getEntries(store, tournamentId);
    const capacity = tournament.capacity == null ? null : Number(tournament.capacity);
    const checkedInCount = entries.filter(
      (entry) => entry.status === "checked_in" && !entry.isWaitlisted
    ).length;
    const availableSlots =
      capacity == null || !Number.isFinite(capacity)
        ? 0
        : Math.max(0, Math.floor(capacity) - checkedInCount);
    const eligibleEntries = entries
      .filter((entry) => entry.isWaitlisted && entry.status === "checked_in")
      .sort(compareEntriesByRegistrationOrder);
    const promotedEntryIds = new Set(
      eligibleEntries.slice(0, availableSlots).map((entry) => entry.id)
    );
    const joinedAtRound = nextJoinRound(store, tournamentId);
    const nextEntries = entries.map((entry) =>
      promotedEntryIds.has(entry.id)
        ? normalizeEntry(
            {
              ...entry,
              isWaitlisted: false,
              joinedAtRound: Math.max(Number(entry.joinedAtRound || 1), joinedAtRound),
            },
            tournament
          )
        : entry
    );
    const promotedEntries = nextEntries.filter((entry) => promotedEntryIds.has(entry.id));

    if (promotedEntries.length > 0) {
      setEntries(store, tournamentId, nextEntries);
      store.tournaments = store.tournaments.map((item) =>
        String(item.id) === String(tournamentId)
          ? { ...item, updatedAt: nowIso() }
          : item
      );
      writeStore(store);
    }

    return {
      promotedCount: promotedEntries.length,
      promotedEntries,
      eligibleWaitlistCount: eligibleEntries.length,
      availableSlotsBefore: availableSlots,
      remainingSlots:
        capacity == null || !Number.isFinite(capacity)
          ? null
          : Math.max(0, Math.floor(capacity) - checkedInCount - promotedEntries.length),
      remainingWaitlistCount: nextEntries.filter(
        (entry) => entry.isWaitlisted && entry.status !== "dropped"
      ).length,
    };
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/waitlist/promote`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchTournamentBans(tournamentId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    return { items: getTournamentBans(store, tournamentId) };
  }

  return requestJson(`/api/tournaments/${tournamentId}/bans`, { method: "GET" });
}

export async function unbanTournamentUser({ tournamentId, userId, authMode, user }) {
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    const bans = getTournamentBans(store, tournamentId);
    const nextBans = bans.filter((record) => record.user.id !== String(userId));
    if (nextBans.length === bans.length) {
      throw new Error("再エントリー禁止中のユーザーが見つかりません。");
    }
    setTournamentBans(store, tournamentId, nextBans);
    writeStore(store);
    return;
  }

  await requestJson(
    `/api/tournaments/${tournamentId}/bans/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({}),
    }
  );
}

export async function createManualEntry({ tournamentId, name, deckItems = null, authMode, user }) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    const entries = getEntries(store, tournamentId);
    if (!name || !String(name).trim()) {
      throw new Error("参加者名を入力してください。");
    }
    assertDeckIsValid(deckItems, tournament.regulation);

    const now = nowIso();
    const hasDeckItems = Array.isArray(deckItems) && deckItems.length > 0;
    const entry = normalizeEntry(
      {
        id: createUniqueEntryId(entries, `entry-manual-${Date.now()}`),
        tournamentId,
        user: { id: null, name: String(name).trim() },
        deckItems: hasDeckItems ? deckItems : null,
        decklistSubmittedAt: hasDeckItems ? now : null,
        deckFormat: hasDeckItems ? deckFormatForTournament(tournament) : null,
        deckLockedAt: tournament.status === "in_progress" ? now : null,
        status: "registered",
        isWaitlisted: shouldWaitlistEntry(tournament, entries),
        joinedAtRound:
          tournament.status === "in_progress" ? nextJoinRound(store, tournamentId) : 1,
        createdAt: now,
      },
      tournament
    );
    setEntries(store, tournamentId, [entry, ...entries]);
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: countActiveEntries(entries) + 1, updatedAt: now }
        : item
    );
    writeStore(store);
    return entry;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/manual`, {
    method: "POST",
    body: JSON.stringify({ name, deckItems: Array.isArray(deckItems) ? deckItems : undefined }),
  });
}

export async function approveEntry({ tournamentId, entryId, authMode, user }) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    const entries = getEntries(store, tournamentId);
    const existing = entries.find((entry) => entry.id === String(entryId));
    if (!existing || existing.status !== "pending") {
      throw new Error("承認できる申請中の参加者が見つかりません。");
    }
    const updated = normalizeEntry(
      {
        ...existing,
        status: "registered",
        isWaitlisted: shouldWaitlistEntry(tournament, entries),
        joinedAtRound: nextJoinRound(store, tournamentId),
      },
      tournament
    );
    setEntries(
      store,
      tournamentId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    writeStore(store);
    return updated;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/${entryId}/approve`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function rejectEntry({ tournamentId, entryId, authMode, user }) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    const entries = getEntries(store, tournamentId);
    const existing = entries.find((entry) => entry.id === String(entryId));
    if (!existing || existing.status !== "pending") {
      throw new Error("却下できる申請中の参加者が見つかりません。");
    }
    const nextEntries = entries.filter((entry) => entry.id !== String(entryId));
    setEntries(store, tournamentId, nextEntries);
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: countActiveEntries(nextEntries), updatedAt: nowIso() }
        : item
    );
    writeStore(store);
    return;
  }

  await requestJson(`/api/tournaments/${tournamentId}/entries/${entryId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

export async function kickEntry({
  tournamentId,
  entryId,
  ban = false,
  authMode,
  user,
}) {
  if (typeof ban !== "boolean") {
    throw new Error("再エントリー禁止の指定が不正です。");
  }
  if (authMode === "mock") {
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    const entries = getEntries(store, tournamentId);
    const existing = entries.find((entry) => entry.id === String(entryId));
    if (!existing) throw new Error("参加者が見つかりません。");
    if (ban && existing.user?.id == null) {
      throw new Error("ユーザーIDのないゲストは再エントリー禁止にできません。");
    }

    const now = nowIso();
    const hasMatchReference = entryHasMatchReference(
      getRounds(store, tournamentId),
      existing.id
    );
    const droppedEntry = hasMatchReference
      ? normalizeEntry({ ...existing, status: "dropped" }, tournament)
      : null;
    const nextEntries = hasMatchReference
      ? entries.map((entry) => (entry.id === existing.id ? droppedEntry : entry))
      : entries.filter((entry) => entry.id !== existing.id);
    const currentBans = getTournamentBans(store, tournamentId);
    const existingBan = currentBans.find(
      (record) => record.user.id === String(existing.user?.id)
    );
    const banRecord = ban
      ? existingBan || {
          user: {
            id: String(existing.user.id),
            name: existing.user.name || "参加者",
          },
          bannedAt: now,
        }
      : null;

    setEntries(store, tournamentId, nextEntries);
    if (banRecord) {
      setTournamentBans(store, tournamentId, [
        banRecord,
        ...currentBans.filter((record) => record.user.id !== banRecord.user.id),
      ]);
    }
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: countActiveEntries(nextEntries), updatedAt: now }
        : item
    );
    writeStore(store);
    return {
      disposition: hasMatchReference ? "dropped" : "removed",
      entry: droppedEntry,
      ban: banRecord,
    };
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/${entryId}/kick`, {
    method: "POST",
    body: JSON.stringify({ ban }),
  });
}

export async function updateEntryStatus({
  tournamentId,
  entryId,
  status,
  deckItems,
  decklistLocked,
  authMode,
  user,
}) {
  if (authMode === "mock") {
    if (status && !["registered", "checked_in", "dropped"].includes(status)) {
      throw new Error("不正な参加ステータスです。");
    }
    if (decklistLocked !== undefined && typeof decklistLocked !== "boolean") {
      throw new Error("不正なデッキロック状態です。");
    }
    const viewer = getCurrentViewer(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, viewer);
    const entries = getEntries(store, tournamentId);
    const existing = entries.find((entry) => entry.id === String(entryId));
    if (!existing) throw new Error("参加者が見つかりません。");
    if (status && status !== "dropped" && existing.user?.id != null) {
      assertUserIsNotBanned(store, tournamentId, existing.user);
    }
    if (decklistLocked === false && tournament.status === "completed") {
      throw new Error("大会終了後はデッキリストのロックを解除できません。");
    }
    if (
      tournament.status === "completed" &&
      tournament.decklistsPublic &&
      (deckItems !== undefined || decklistLocked !== undefined)
    ) {
      throw new Error("公開済みのデッキリストは変更できません。");
    }
    if (deckItems !== undefined) {
      assertDeckIsValid(deckItems, tournament.regulation);
    }
    const now = nowIso();
    const hasDeckItems = Array.isArray(deckItems) && deckItems.length > 0;
    const isLockedDeckUpdate = deckItems !== undefined && Boolean(existing.deckLockedAt);
    const isUnlocking = decklistLocked === false && Boolean(existing.deckLockedAt);
    const auditActor = isLockedDeckUpdate || isUnlocking ? getAuditActor(user, tournament) : null;
    let nextDeckLockedAt = existing.deckLockedAt;
    let nextDeckUnlockedBy = existing.deckUnlockedBy;
    let nextDeckUnlockedAt = existing.deckUnlockedAt;
    if (status === "checked_in") {
      nextDeckLockedAt = existing.deckLockedAt || now;
    } else if (decklistLocked === false && existing.deckLockedAt) {
      nextDeckLockedAt = null;
      nextDeckUnlockedBy = auditActor;
      nextDeckUnlockedAt = now;
    } else if (decklistLocked === true) {
      nextDeckLockedAt = existing.deckLockedAt || now;
    }
    const updated = normalizeEntry(
      {
        ...existing,
        status: status || existing.status,
        deckItems: deckItems === undefined ? existing.deckItems : hasDeckItems ? deckItems : null,
        decklistSubmittedAt:
          deckItems === undefined ? existing.decklistSubmittedAt : hasDeckItems ? now : null,
        deckFormat:
          deckItems === undefined
            ? existing.deckFormat
            : hasDeckItems
              ? deckFormatForTournament(tournament)
              : null,
        deckLockedAt: nextDeckLockedAt,
        deckUpdatedBy: isLockedDeckUpdate ? auditActor : existing.deckUpdatedBy,
        deckUpdatedAt: isLockedDeckUpdate ? now : existing.deckUpdatedAt,
        deckUnlockedBy: nextDeckUnlockedBy,
        deckUnlockedAt: nextDeckUnlockedAt,
      },
      tournament
    );
    setEntries(
      store,
      tournamentId,
      entries.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    writeStore(store);
    return updated;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/${entryId}`, {
    method: "PUT",
    body: JSON.stringify({
      status,
      deckItems: Array.isArray(deckItems) ? deckItems : undefined,
      decklistLocked: typeof decklistLocked === "boolean" ? decklistLocked : undefined,
    }),
  });
}

export async function createNextRound(tournamentId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    const shouldLockSwissRounds =
      tournament.format !== "single_elim" &&
      getRounds(store, tournamentId).length === 0 &&
      !(tournament.swissRounds != null && Number(tournament.swissRounds) > 0);
    const lockedSwissRounds = shouldLockSwissRounds
      ? swissRoundLimit(
          tournament,
          activeEntriesForRound(getEntries(store, tournamentId), 1).length
        )
      : null;
    const round = buildNextRound(store, tournamentId);
    store.rounds[String(tournamentId)] = [...getRounds(store, tournamentId), round];
    const now = nowIso();
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? {
            ...item,
            swissRounds: shouldLockSwissRounds ? lockedSwissRounds : item.swissRounds,
            swissEndCondition: getSwissEndCondition(item),
            status: item.status === "registration" ? "in_progress" : item.status,
            updatedAt: now,
          }
        : item
    );
    writeStore(store);
    return round;
  }

  return requestJson(`/api/tournaments/${tournamentId}/rounds`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function reportMatchResult({
  matchId,
  player1Games,
  player2Games,
  result,
  stage,
  authMode,
  user,
}) {
  const hasBothGameCounts =
    player1Games !== undefined &&
    player1Games !== null &&
    player1Games !== "" &&
    player2Games !== undefined &&
    player2Games !== null &&
    player2Games !== "";
  if (
    stage === "top_cut" &&
    (result === "draw" ||
      (hasBothGameCounts && Number(player1Games) === Number(player2Games)))
  ) {
    throw new Error("決勝トーナメントでは引き分けにできません。勝者が決まる結果を入力してください。");
  }

  if (authMode === "mock") {
    if (result !== undefined && !["p1_win", "p2_win", "draw", "bye", null].includes(result)) {
      throw new Error("不正な結果です。");
    }
    const store = readStore();
    let updatedMatch = null;
    let found = null;
    Object.keys(store.rounds).forEach((tournamentId) => {
      getRounds(store, tournamentId).forEach((round) => {
        (round.matches || []).forEach((match) => {
          if (match.id === matchId) found = { tournamentId, round, match };
        });
      });
    });
    if (!found) throw new Error("試合が見つかりません。");

    const tournament = getTournamentOrThrow(store, found.tournamentId);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    if (tournament.status === "completed") {
      throw new Error("完了した大会のラウンド結果は修正できません。");
    }
    if (found.round.status === "completed") {
      throw new Error(
        "完了済みラウンドの結果を修正するには、先にラウンドを完了前へ戻してください。"
      );
    }

    const isTopCutRound = found.round.stage === "top_cut" || stage === "top_cut";
    if (isTopCutRound && result === "draw") {
      throw new Error("決勝トーナメントでは引き分けにできません。勝者が決まる結果を入力してください。");
    }
    const isBye = found.match.player2EntryId == null || found.match.result === "bye" || result === "bye";
    const nextResult =
      result === null && player1Games == null && player2Games == null
        ? null
        : deriveResultFromGames({ player1Games, player2Games, result, isBye });
    if (isTopCutRound && nextResult === "draw") {
      throw new Error("決勝トーナメントでは引き分けにできません。勝者が決まる結果を入力してください。");
    }
    const oldWinner = winnerEntryId(found.match);
    const nextWinner = nextResult ? winnerEntryId(found.match, nextResult) : null;
    const isElimination = isTopCutRound || tournament.format === "single_elim";
    const hasLaterRounds = getRounds(store, found.tournamentId).some(
      (round) => Number(round.number) > Number(found.round.number)
    );
    if (isElimination && hasLaterRounds && oldWinner !== nextWinner) {
      throw new Error("結果の訂正が後続ラウンドの組み合わせと矛盾します。後続ラウンドを破棄してください。");
    }
    Object.keys(store.rounds).forEach((tournamentId) => {
      store.rounds[tournamentId] = getRounds(store, tournamentId).map((round) => ({
        ...round,
        matches: (round.matches || []).map((match) => {
          if (match.id !== matchId) return match;
          updatedMatch = {
            ...match,
            player1Games:
              nextResult === null || isBye
                ? null
                : player1Games == null
                  ? match.player1Games ?? null
                  : Number(player1Games),
            player2Games:
              nextResult === null || isBye
                ? null
                : player2Games == null
                  ? match.player2Games ?? null
                  : Number(player2Games),
            result: nextResult,
          };
          return updatedMatch;
        }),
      }));
    });
    if (!updatedMatch) throw new Error("卓が見つかりません。");
    writeStore(store);
    return updatedMatch;
  }

  return requestJson(`/api/matches/${matchId}/result`, {
    method: "PUT",
    body: JSON.stringify({ player1Games, player2Games }),
  });
}

export async function updateRoundMatches({ roundId, matches, authMode, user }) {
  if (authMode === "mock") {
    const store = readStore();
    let updatedRound = null;
    let tournamentIdForRound = "";
    let targetRound = null;

    Object.keys(store.rounds).forEach((tournamentId) => {
      const round = getRounds(store, tournamentId).find((item) => item.id === roundId);
      if (round) {
        tournamentIdForRound = tournamentId;
        targetRound = round;
      }
    });
    if (!targetRound) throw new Error("ラウンドが見つかりません。");
    assertCanManageTournament(
      getTournamentOrThrow(store, tournamentIdForRound),
      getCurrentViewer(user)
    );
    if (targetRound.status === "completed") {
      throw new Error("完了済みラウンドの組み合わせは変更できません。");
    }
    if (!Array.isArray(matches) || matches.length === 0) {
      throw new Error("組み合わせを入力してください。");
    }

    const activeIds = activeEntriesForRound(
      getEntries(store, tournamentIdForRound),
      targetRound.number
    ).map((entry) => entry.id);
    const expected = new Set(activeIds);
    const seen = new Set();
    matches.forEach((match) => {
      [match.player1EntryId, match.player2EntryId].forEach((entryId) => {
        if (entryId == null) return;
        const id = String(entryId);
        if (!expected.has(id)) throw new Error("組み合わせに参加対象外の参加者が含まれています。");
        if (seen.has(id)) throw new Error("同じ参加者が複数の卓に含まれています。");
        seen.add(id);
      });
    });
    if (seen.size !== expected.size) {
      throw new Error("全アクティブ参加者がちょうど1回ずつ出場する必要があります。");
    }

    const nextMatches = matches.map((match, index) => ({
      id: match.id || `match-${roundId}-${index + 1}-${Date.now()}`,
      roundId,
      tableNo: Number(match.tableNo || index + 1),
      player1EntryId: String(match.player1EntryId),
      player2EntryId: match.player2EntryId == null ? null : String(match.player2EntryId),
      player1Games: null,
      player2Games: null,
      result: match.player2EntryId == null ? "bye" : null,
    }));

    store.rounds[tournamentIdForRound] = getRounds(store, tournamentIdForRound).map((round) => {
      if (round.id !== roundId) return round;
      updatedRound = { ...round, matches: nextMatches };
      return updatedRound;
    });
    writeStore(store);
    return updatedRound;
  }

  return requestJson(`/api/rounds/${roundId}/matches`, {
    method: "PUT",
    body: JSON.stringify({ matches }),
  });
}

export async function deleteRound(roundId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    let deleted = false;
    Object.keys(store.rounds).forEach((tournamentId) => {
      const rounds = getRounds(store, tournamentId);
      const target = rounds.find((round) => round.id === roundId);
      if (!target) return;
      assertCanManageTournament(
        getTournamentOrThrow(store, tournamentId),
        getCurrentViewer(user)
      );
      if (target.status === "completed") {
        throw new Error("完了済みラウンドは削除できません。");
      }
      store.rounds[tournamentId] = rounds.filter((round) => round.id !== roundId);
      deleted = true;
    });
    if (!deleted) throw new Error("ラウンドが見つかりません。");
    writeStore(store);
    return;
  }

  await requestJson(`/api/rounds/${roundId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

export async function startRoundTimer(roundId, { timerStartedAt, authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    let updatedRound = null;
    Object.keys(store.rounds).forEach((tournamentId) => {
      store.rounds[tournamentId] = getRounds(store, tournamentId).map((round) => {
        if (round.id !== roundId) return round;
        assertCanManageTournament(
          getTournamentOrThrow(store, tournamentId),
          getCurrentViewer(user)
        );
        updatedRound = { ...round, timerStartedAt: timerStartedAt || nowIso() };
        return updatedRound;
      });
    });
    if (!updatedRound) throw new Error("ラウンドが見つかりません。");
    writeStore(store);
    return updatedRound;
  }

  return requestJson(`/api/rounds/${roundId}/timer`, {
    method: "POST",
    body: JSON.stringify({ timerStartedAt }),
  });
}

export async function completeRound(roundId, { authMode, user } = {}) {
  if (authMode === "mock") {
    const store = readStore();
    let completedRound = null;
    let tournamentIdForRound = "";

    Object.keys(store.rounds).forEach((tournamentId) => {
      store.rounds[tournamentId] = getRounds(store, tournamentId).map((round) => {
        if (round.id !== roundId) return round;
        assertCanManageTournament(
          getTournamentOrThrow(store, tournamentId),
          getCurrentViewer(user)
        );
        if (!roundComplete(round)) {
          throw new Error("全ての卓結果を入力してください。");
        }
        completedRound = { ...round, status: "completed" };
        tournamentIdForRound = tournamentId;
        return completedRound;
      });
    });

    if (!completedRound) throw new Error("ラウンドが見つかりません。");

    const tournament = getTournamentOrThrow(store, tournamentIdForRound);
    const entries = activeEntriesForPairing(getEntries(store, tournamentIdForRound));
    const status = updateTournamentStatusIfDone(
      tournament,
      getRounds(store, tournamentIdForRound),
      entries
    );
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentIdForRound)
        ? { ...item, status, updatedAt: nowIso() }
        : item
    );
    writeStore(store);
    return completedRound;
  }

  return requestJson(`/api/rounds/${roundId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "completed" }),
  });
}

export async function reopenRound(
  roundId,
  { authMode, discardLaterRounds = false, user } = {}
) {
  if (authMode === "mock") {
    const store = readStore();
    let tournamentIdForRound = "";
    let targetRound = null;

    Object.keys(store.rounds).forEach((tournamentId) => {
      const round = getRounds(store, tournamentId).find((item) => item.id === roundId);
      if (round) {
        tournamentIdForRound = tournamentId;
        targetRound = round;
      }
    });

    if (!targetRound) throw new Error("ラウンドが見つかりません。");

    const tournament = getTournamentOrThrow(store, tournamentIdForRound);
    assertCanManageTournament(tournament, getCurrentViewer(user));
    if (!["in_progress", "completed"].includes(tournament.status)) {
      throw new Error("進行中または完了した大会のラウンドのみ巻き戻せます。");
    }
    if (targetRound.status !== "completed") {
      throw new Error("完了済みのラウンドのみ巻き戻せます。");
    }

    const rounds = getRounds(store, tournamentIdForRound);
    const latestCompletedRound = rounds
      .filter((round) => round.status === "completed")
      .reduce(
        (latest, round) =>
          !latest || Number(round.number) > Number(latest.number) ? round : latest,
        null
      );

    if (!latestCompletedRound || latestCompletedRound.id !== targetRound.id) {
      const latestRoundLabel = latestCompletedRound
        ? getRoundLabel(latestCompletedRound, rounds)
        : "直前に完了したラウンド";
      throw new Error(
        `修正できるのは直前に完了した${latestRoundLabel}のみです。${getRoundLabel(
          targetRound,
          rounds
        )}は巻き戻せません。`
      );
    }

    const laterRounds = rounds.filter(
      (round) => Number(round.number) > Number(targetRound.number)
    );
    if (laterRounds.length > 0 && !discardLaterRounds) {
      const firstDiscardedRoundNumber = Math.min(
        ...laterRounds.map((round) => Number(round.number))
      );
      const firstDiscardedRound = laterRounds.find(
        (round) => Number(round.number) === firstDiscardedRoundNumber
      );
      const error = createServiceError(
        `${getRoundLabel(
          firstDiscardedRound,
          rounds
        )}以降のラウンドと対戦結果を破棄する確認が必要です。`,
        409
      );
      error.code = "later_rounds_exist";
      error.firstDiscardedRoundNumber = firstDiscardedRoundNumber;
      error.discardedRoundCount = laterRounds.length;
      throw error;
    }

    const reopenedRound = { ...targetRound, status: "in_progress" };
    store.rounds[tournamentIdForRound] = rounds
      .filter((round) => Number(round.number) <= Number(targetRound.number))
      .map((round) => (round.id === targetRound.id ? reopenedRound : round));
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentIdForRound)
        ? { ...item, status: "in_progress", updatedAt: nowIso() }
        : item
    );
    writeStore(store);
    return reopenedRound;
  }

  return requestJson(`/api/rounds/${roundId}`, {
    method: "PUT",
    body: JSON.stringify({
      status: "in_progress",
      discardLaterRounds: Boolean(discardLaterRounds),
    }),
  });
}
