const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const STORAGE_PREFIX = "gundamwar.savedDecks.v1";

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function ensureUser(user) {
  if (!user?.id) {
    throw new Error("ログイン情報が見つかりません。");
  }
}

function buildStorageKey(user) {
  return `${STORAGE_PREFIX}:${user.id}`;
}

function buildPayload(deck) {
  const payload = {
    title: String(deck.title || "").trim(),
    items: Array.isArray(deck.items) ? deck.items : [],
  };

  // Keep format optional for callers that predate deck-format persistence.
  // An explicit null/empty string clears the saved format on overwrite.
  if (deck.format !== undefined) {
    payload.format =
      typeof deck.format === "string" && deck.format.trim() ? deck.format.trim() : null;
  }

  return payload;
}

function normalizeSavedDeck(rawDeck) {
  if (!rawDeck?.id) return null;
  return {
    id: String(rawDeck.id),
    title: rawDeck.title || "無題デッキ",
    items: Array.isArray(rawDeck.items) ? rawDeck.items : [],
    isPublic: Boolean(rawDeck.isPublic),
    description: rawDeck.description || "",
    format: typeof rawDeck.format === "string" && rawDeck.format.trim() ? rawDeck.format.trim() : null,
    publishedAt: rawDeck.publishedAt || rawDeck.published_at || "",
    createdAt: rawDeck.createdAt || rawDeck.created_at || "",
    updatedAt: rawDeck.updatedAt || rawDeck.updated_at || "",
  };
}

function readMockDecks(user) {
  if (typeof window === "undefined") return [];
  ensureUser(user);
  try {
    const raw = window.localStorage.getItem(buildStorageKey(user));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSavedDeck).filter(Boolean);
  } catch (error) {
    console.warn("Failed to read saved decks from localStorage.", error);
    return [];
  }
}

function writeMockDecks(user, decks) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildStorageKey(user), JSON.stringify(decks));
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

export async function fetchSavedDecks({ authMode, user }) {
  ensureUser(user);

  if (authMode === "mock") {
    return readMockDecks(user);
  }

  const payload = await requestJson("/api/decks", { method: "GET" });
  return (payload.decks || []).map(normalizeSavedDeck).filter(Boolean);
}

export async function saveSavedDeck({ authMode, user, deckId, title, items, format }) {
  ensureUser(user);
  const payload = buildPayload({ title, items, format });

  if (!payload.title) {
    throw new Error("デッキ名を入力してください。");
  }

  if (authMode === "mock") {
    const now = new Date().toISOString();
    const decks = readMockDecks(user);
    if (deckId) {
      const hasFormat = Object.prototype.hasOwnProperty.call(payload, "format");
      const nextDecks = decks.map((deck) =>
        deck.id === String(deckId)
          ? {
              ...deck,
              title: payload.title,
              items: payload.items,
              ...(hasFormat ? { format: payload.format } : {}),
              updatedAt: now,
            }
          : deck
      );
      writeMockDecks(user, nextDecks);
      return nextDecks.find((deck) => deck.id === String(deckId));
    }

    const nextDeck = normalizeSavedDeck({
      id: `${Date.now()}`,
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    const nextDecks = [nextDeck, ...decks];
    writeMockDecks(user, nextDecks);
    return nextDeck;
  }

  const path = deckId ? `/api/decks/${deckId}` : "/api/decks";
  const method = deckId ? "PUT" : "POST";
  const response = await requestJson(path, {
    method,
    body: JSON.stringify(payload),
  });
  return normalizeSavedDeck(response.deck);
}

export async function deleteSavedDeck({ authMode, user, deckId }) {
  ensureUser(user);

  if (authMode === "mock") {
    const nextDecks = readMockDecks(user).filter((deck) => deck.id !== String(deckId));
    writeMockDecks(user, nextDecks);
    return;
  }

  await requestJson(`/api/decks/${deckId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}
