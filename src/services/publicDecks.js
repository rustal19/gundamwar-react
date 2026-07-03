const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const PUBLIC_STORAGE_KEY = "gundamwar.publicDecks.v1";
const SAVED_STORAGE_PREFIX = "gundamwar.savedDecks.v1";
const PAGE_SIZE = 20;

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function ensureUser(user) {
  if (!user?.id) {
    throw new Error("ログインが必要です。");
  }
}

function readJsonStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage.`, error);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function buildSavedStorageKey(user) {
  return `${SAVED_STORAGE_PREFIX}:${user.id}`;
}

function normalizeOwner(owner, fallbackUser) {
  const ownerId = owner?.id || fallbackUser?.id || "";
  return {
    id: String(ownerId),
    name: owner?.name || fallbackUser?.name || "名無し",
  };
}

function normalizePublicDeck(rawDeck, fallbackUser) {
  if (!rawDeck?.id) return null;
  return {
    id: String(rawDeck.id),
    title: rawDeck.title || "無題デッキ",
    items: Array.isArray(rawDeck.items) ? rawDeck.items : [],
    isPublic: Boolean(rawDeck.isPublic),
    description: rawDeck.description || "",
    publishedAt: rawDeck.publishedAt || rawDeck.published_at || "",
    createdAt: rawDeck.createdAt || rawDeck.created_at || "",
    updatedAt: rawDeck.updatedAt || rawDeck.updated_at || "",
    owner: normalizeOwner(rawDeck.owner, fallbackUser),
  };
}

function readMockPublicDecks() {
  const parsed = readJsonStorage(PUBLIC_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((deck) => normalizePublicDeck(deck)).filter(Boolean);
}

function writeMockPublicDecks(decks) {
  writeJsonStorage(PUBLIC_STORAGE_KEY, decks);
}

function readMockSavedDecks(user) {
  ensureUser(user);
  const parsed = readJsonStorage(buildSavedStorageKey(user), []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function writeMockSavedDecks(user, decks) {
  writeJsonStorage(buildSavedStorageKey(user), decks);
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
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function getPage(value) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function paginateDecks(decks, page) {
  const normalizedPage = getPage(page);
  const start = (normalizedPage - 1) * PAGE_SIZE;
  return {
    items: decks.slice(start, start + PAGE_SIZE),
    total: decks.length,
    page: normalizedPage,
    pageSize: PAGE_SIZE,
  };
}

export async function fetchPublicDecks({ page = 1, query = "", authMode } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(getPage(page)));
  if (query) params.set("query", query);

  if (authMode === "mock") {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const decks = readMockPublicDecks()
      .filter((deck) => deck.isPublic)
      .filter((deck) => {
        if (!normalizedQuery) return true;
        return [deck.title, deck.description, deck.owner?.name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) =>
        String(right.publishedAt || right.updatedAt || "").localeCompare(
          String(left.publishedAt || left.updatedAt || "")
        )
      );
    return paginateDecks(decks, page);
  }

  const payload = await requestJson(`/api/public-decks?${params.toString()}`, { method: "GET" });
  return {
    items: (payload.items || []).map((deck) => normalizePublicDeck(deck)).filter(Boolean),
    total: Number(payload.total || 0),
    page: Number(payload.page || getPage(page)),
    pageSize: Number(payload.pageSize || PAGE_SIZE),
  };
}

export async function fetchPublicDeck(id, { authMode } = {}) {
  const deckId = String(id || "");

  if (authMode === "mock") {
    const deck = readMockPublicDecks().find((item) => item.id === deckId && item.isPublic);
    if (!deck) {
      throw new Error("公開デッキが見つかりません。");
    }
    return deck;
  }

  const payload = await requestJson(`/api/public-decks/${encodeURIComponent(deckId)}`, {
    method: "GET",
  });
  return normalizePublicDeck(payload.deck || payload);
}

export async function setDeckPublication({
  authMode,
  user,
  deckId,
  isPublic,
  description = "",
}) {
  ensureUser(user);
  const deckKey = String(deckId || "");
  const nextDescription = String(description || "").trim();
  const nextIsPublic = Boolean(isPublic);

  if (authMode === "mock") {
    const now = new Date().toISOString();
    const savedDecks = readMockSavedDecks(user);
    const savedDeck = savedDecks.find((deck) => String(deck.id) === deckKey);
    if (!savedDeck) {
      throw new Error("保存デッキが見つかりません。");
    }

    const publishedAt = nextIsPublic ? savedDeck.publishedAt || now : "";
    const nextSavedDeck = {
      ...savedDeck,
      isPublic: nextIsPublic,
      description: nextDescription,
      publishedAt,
      updatedAt: now,
    };
    writeMockSavedDecks(
      user,
      savedDecks.map((deck) => (String(deck.id) === deckKey ? nextSavedDeck : deck))
    );

    const publicDecks = readMockPublicDecks();
    const nextPublicDecks = publicDecks.filter((deck) => deck.id !== deckKey);
    if (nextIsPublic) {
      nextPublicDecks.unshift(
        normalizePublicDeck(
          {
            ...nextSavedDeck,
            owner: normalizeOwner(null, user),
          },
          user
        )
      );
    }
    writeMockPublicDecks(nextPublicDecks);
    return normalizePublicDeck(nextSavedDeck, user);
  }

  const payload = await requestJson(`/api/decks/${encodeURIComponent(deckKey)}`, {
    method: "PATCH",
    body: JSON.stringify({
      isPublic: nextIsPublic,
      description: nextDescription,
    }),
  });
  return normalizePublicDeck(payload.deck || payload, user);
}

export { PUBLIC_STORAGE_KEY };
