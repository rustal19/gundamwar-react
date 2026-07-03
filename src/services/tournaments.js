import { computeStandings } from "../utils/tournament/standings";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const STORAGE_KEY = "gundamwar.tournaments.v1";
const MOCK_USER_KEY = "gundamwar.auth.mockUser.v1";
const PAGE_SIZE = 10;

const DEFAULT_REGULATION = {
  name: "Standard",
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

function shouldUseMock(authMode) {
  return authMode === "mock" || (!API_BASE_URL && typeof window !== "undefined");
}

function readMockUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const id = user.googleSub || user.sub || user.id || user.userId;
    if (!id) return null;
    return {
      id: String(id),
      name: user.name || user.displayName || user.email || "Local Player",
    };
  } catch (error) {
    console.warn("Failed to read mock user.", error);
    return null;
  }
}

function getCurrentUser(user) {
  const currentUser = user?.id ? user : readMockUser();
  if (!currentUser?.id) {
    throw new Error("ログインしてから操作してください。");
  }
  return {
    id: String(currentUser.id),
    name: currentUser.name || currentUser.email || "Player",
  };
}

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function createInitialStore() {
  const tournamentId = "mock-tournament-1";
  const entries = [
    {
      id: "entry-1",
      tournamentId,
      user: { id: "mock-player-1", name: "Player 1" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
    {
      id: "entry-2",
      tournamentId,
      user: { id: "mock-player-2", name: "Player 2" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
    {
      id: "entry-3",
      tournamentId,
      user: { id: "mock-player-3", name: "Player 3" },
      deckItems: null,
      decklistSubmittedAt: null,
      status: "checked_in",
      createdAt: daysFromNow(-5),
    },
  ];

  return {
    tournaments: [
      {
        id: tournamentId,
        title: "Local Swiss Cup",
        description: "Mock tournament for local portal development.",
        format: "swiss",
        swissRounds: 3,
        topCutSize: null,
        status: "in_progress",
        startsAt: daysFromNow(-1),
        registrationClosesAt: daysFromNow(-2),
        capacity: 32,
        decklistRequired: true,
        regulation: DEFAULT_REGULATION,
        createdBy: { id: "organizer-1", name: "Local Organizer" },
        entryCount: entries.length,
        createdAt: daysFromNow(-10),
        updatedAt: daysFromNow(-1),
      },
      {
        id: "mock-tournament-2",
        title: "Weekend Registration",
        description: "Open registration event.",
        format: "swiss",
        swissRounds: null,
        topCutSize: 8,
        status: "registration",
        startsAt: daysFromNow(7),
        registrationClosesAt: daysFromNow(6),
        capacity: 16,
        decklistRequired: false,
        regulation: DEFAULT_REGULATION,
        createdBy: { id: "organizer-1", name: "Local Organizer" },
        entryCount: 0,
        createdAt: daysFromNow(-2),
        updatedAt: daysFromNow(-2),
      },
    ],
    entries: {
      [tournamentId]: entries,
      "mock-tournament-2": [],
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
              result: "p1_win",
            },
            {
              id: "match-2",
              roundId: "round-1",
              tableNo: 2,
              player1EntryId: "entry-3",
              player2EntryId: null,
              result: "bye",
            },
          ],
        },
      ],
      "mock-tournament-2": [],
    },
  };
}

function normalizeTournament(tournament, entries = []) {
  if (!tournament?.id) return null;
  return {
    ...tournament,
    id: String(tournament.id),
    format: tournament.format || "swiss",
    swissRounds: tournament.swissRounds ?? null,
    topCutSize: tournament.topCutSize ?? null,
    status: tournament.status || "draft",
    capacity: tournament.capacity ?? null,
    decklistRequired: Boolean(tournament.decklistRequired),
    regulation: { ...DEFAULT_REGULATION, ...(tournament.regulation || {}) },
    entryCount: entries.length,
  };
}

function normalizeEntry(entry) {
  if (!entry?.id) return null;
  return {
    ...entry,
    id: String(entry.id),
    tournamentId: String(entry.tournamentId),
    user: {
      id: String(entry.user?.id || ""),
      name: entry.user?.name || "Player",
    },
    deckItems: Array.isArray(entry.deckItems) ? entry.deckItems : null,
    decklistSubmittedAt: entry.decklistSubmittedAt || null,
    status: entry.status || "registered",
    createdAt: entry.createdAt || nowIso(),
  };
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
    return {
      tournaments: Array.isArray(parsed.tournaments) ? parsed.tournaments : [],
      entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {},
      rounds: parsed.rounds && typeof parsed.rounds === "object" ? parsed.rounds : {},
    };
  } catch (error) {
    console.warn("Failed to read tournaments from localStorage.", error);
    return createInitialStore();
  }
}

function writeStore(store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getTournamentOrThrow(store, tournamentId) {
  const id = String(tournamentId);
  const tournament = store.tournaments.find((item) => String(item.id) === id);
  if (!tournament) throw new Error("大会が見つかりません。");
  return tournament;
}

function getEntries(store, tournamentId) {
  return (store.entries[String(tournamentId)] || []).map(normalizeEntry).filter(Boolean);
}

function getRounds(store, tournamentId) {
  return Array.isArray(store.rounds[String(tournamentId)]) ? store.rounds[String(tournamentId)] : [];
}

function isBefore(dateString) {
  if (!dateString) return true;
  return Date.now() < new Date(dateString).getTime();
}

function assertCanEnter(tournament, entries, currentUser, deckItems) {
  if (tournament.status !== "registration") {
    throw new Error("現在この大会にはエントリーできません。");
  }
  if (!isBefore(tournament.registrationClosesAt)) {
    throw new Error("エントリー締切を過ぎています。");
  }
  if (tournament.capacity != null && entries.length >= tournament.capacity) {
    throw new Error("定員に達しています。");
  }
  if (entries.some((entry) => entry.user.id === currentUser.id && entry.status !== "dropped")) {
    throw new Error("すでにエントリー済みです。");
  }
  if (tournament.decklistRequired && (!Array.isArray(deckItems) || deckItems.length === 0)) {
    throw new Error("この大会はデッキリスト提出が必要です。");
  }
}

function assertCanChangeEntry(tournament) {
  if (!["registration", "in_progress"].includes(tournament.status)) {
    throw new Error("この大会のエントリーは変更できません。");
  }
  if (!isBefore(tournament.registrationClosesAt)) {
    throw new Error("デッキリスト提出締切を過ぎています。");
  }
}

function assertCanDeleteEntry(tournament) {
  if (tournament.status !== "registration" || !isBefore(tournament.startsAt)) {
    throw new Error("エントリー取消は大会開始前のみ可能です。");
  }
}

function sanitizeEntryForViewer(entry, tournament, viewer) {
  const isOwner = viewer?.id && entry.user.id === String(viewer.id);
  if (tournament.status === "completed" || isOwner) return entry;
  return { ...entry, deckItems: null, decklistSubmittedAt: entry.decklistSubmittedAt };
}

function flattenMatches(rounds) {
  return rounds.flatMap((round) => (Array.isArray(round.matches) ? round.matches : []));
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
    if (payload?.violations) error.violations = payload.violations;
    throw error;
  }

  return payload;
}

export async function fetchTournaments({ status = "", page = 1, authMode } = {}) {
  if (shouldUseMock(authMode)) {
    const store = readStore();
    const visible = store.tournaments
      .map((tournament) => normalizeTournament(tournament, getEntries(store, tournament.id)))
      .filter(Boolean)
      .filter((tournament) => tournament.status !== "draft")
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
  if (shouldUseMock(authMode)) {
    const store = readStore();
    const tournament = normalizeTournament(getTournamentOrThrow(store, id), getEntries(store, id));
    const entries = getEntries(store, id).map((entry) => sanitizeEntryForViewer(entry, tournament, user));
    const currentUserId = user?.id || readMockUser()?.id;
    const myEntry = currentUserId
      ? entries.find((entry) => entry.user.id === String(currentUserId)) || null
      : null;
    return { ...tournament, entries, myEntry };
  }

  return requestJson(`/api/tournaments/${id}`, { method: "GET" });
}

export async function fetchStandings(id, { authMode } = {}) {
  if (shouldUseMock(authMode)) {
    const store = readStore();
    const entries = getEntries(store, id);
    const matches = flattenMatches(getRounds(store, id));
    const standings = computeStandings(entries, matches).map((standing) => {
      const entry = entries.find((item) => item.id === standing.entryId);
      return {
        ...standing,
        entry,
      };
    });
    return { items: standings };
  }

  return requestJson(`/api/tournaments/${id}/standings`, { method: "GET" });
}

export async function fetchRounds(id, { authMode } = {}) {
  if (shouldUseMock(authMode)) {
    const store = readStore();
    return { rounds: getRounds(store, id) };
  }

  return requestJson(`/api/tournaments/${id}/rounds`, { method: "GET" });
}

export async function createEntry({ tournamentId, deckItems = null, authMode, user }) {
  if (shouldUseMock(authMode)) {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    const entries = getEntries(store, tournamentId);
    assertCanEnter(tournament, entries, currentUser, deckItems);

    const now = nowIso();
    const entry = normalizeEntry({
      id: `entry-${Date.now()}`,
      tournamentId,
      user: currentUser,
      deckItems: Array.isArray(deckItems) && deckItems.length > 0 ? deckItems : null,
      decklistSubmittedAt: Array.isArray(deckItems) && deckItems.length > 0 ? now : null,
      status: "registered",
      createdAt: now,
    });
    store.entries[String(tournamentId)] = [entry, ...entries];
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: store.entries[String(tournamentId)].length, updatedAt: now }
        : item
    );
    writeStore(store);
    return entry;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries`, {
    method: "POST",
    body: JSON.stringify({ deckItems: Array.isArray(deckItems) ? deckItems : undefined }),
  });
}

export async function updateMyEntry({ tournamentId, deckItems = null, authMode, user }) {
  if (shouldUseMock(authMode)) {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanChangeEntry(tournament);
    const entries = getEntries(store, tournamentId);
    const existing = entries.find(
      (entry) => entry.user.id === currentUser.id && entry.status !== "dropped"
    );
    if (!existing) throw new Error("エントリーが見つかりません。");
    if (tournament.decklistRequired && (!Array.isArray(deckItems) || deckItems.length === 0)) {
      throw new Error("この大会はデッキリスト提出が必要です。");
    }

    const now = nowIso();
    const updated = normalizeEntry({
      ...existing,
      deckItems: Array.isArray(deckItems) && deckItems.length > 0 ? deckItems : null,
      decklistSubmittedAt: Array.isArray(deckItems) && deckItems.length > 0 ? now : null,
    });
    store.entries[String(tournamentId)] = entries.map((entry) =>
      entry.id === updated.id ? updated : entry
    );
    writeStore(store);
    return updated;
  }

  return requestJson(`/api/tournaments/${tournamentId}/entries/me`, {
    method: "PUT",
    body: JSON.stringify({ deckItems: Array.isArray(deckItems) ? deckItems : undefined }),
  });
}

export async function deleteMyEntry(tournamentId, { authMode, user } = {}) {
  if (shouldUseMock(authMode)) {
    const currentUser = getCurrentUser(user);
    const store = readStore();
    const tournament = getTournamentOrThrow(store, tournamentId);
    assertCanDeleteEntry(tournament);
    const entries = getEntries(store, tournamentId);
    const nextEntries = entries.filter((entry) => entry.user.id !== currentUser.id);
    if (nextEntries.length === entries.length) throw new Error("エントリーが見つかりません。");
    store.entries[String(tournamentId)] = nextEntries;
    store.tournaments = store.tournaments.map((item) =>
      String(item.id) === String(tournamentId)
        ? { ...item, entryCount: nextEntries.length, updatedAt: nowIso() }
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
