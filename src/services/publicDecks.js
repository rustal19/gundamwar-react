import { ensureMockTournamentStore } from "./tournaments";
import { FORMAT_PRESETS } from "../data/formats";
import { validateDeck } from "../utils/deckValidation";

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
const PUBLIC_STORAGE_KEY = "gundamwar.publicDecks.v1";
const TOURNAMENT_STORAGE_KEY = "gundamwar.tournaments.v1";
const SAVED_STORAGE_PREFIX = "gundamwar.savedDecks.v1";
const PAGE_SIZE = 20;
const SAVED_DECK_SOURCE = "saved";
const TOURNAMENT_DECK_SOURCE = "tournament";

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

function buildSavedStorageKeyByUserId(userId) {
  return `${SAVED_STORAGE_PREFIX}:${userId}`;
}

function normalizeOwner(owner, fallbackUser) {
  const ownerId = owner?.id || fallbackUser?.id || "";
  return {
    id: String(ownerId),
    name: owner?.name || fallbackUser?.name || "名無し",
  };
}

function firstNonEmptyText(...values) {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .find(Boolean) || "";
}

function parsePublicDeckId(value) {
  const id = String(value || "");
  if (id.startsWith("entry:")) {
    return { sourceType: TOURNAMENT_DECK_SOURCE, sourceId: id.slice("entry:".length) };
  }
  if (id.startsWith("saved:")) {
    return { sourceType: SAVED_DECK_SOURCE, sourceId: id.slice("saved:".length) };
  }
  // 接頭辞のない既存URLは、数値IDを含めて従来どおり保存デッキとして扱う。
  return { sourceType: SAVED_DECK_SOURCE, sourceId: id };
}

export function isTournamentDeck(deck) {
  const sourceType = firstNonEmptyText(deck?.sourceType, deck?.source_type).toLowerCase();
  if (sourceType) {
    return ["tournament", "tournament_deck", "entry"].includes(sourceType);
  }
  return parsePublicDeckId(deck?.id).sourceType === TOURNAMENT_DECK_SOURCE;
}

export function getTournamentRank(deck) {
  return deck?.finalRank ?? deck?.tournament?.finalRank ?? null;
}

export function getTournamentParticipantCount(deck) {
  return deck?.participantCount ?? deck?.tournament?.participantCount ?? null;
}

function buildPublicDeckId(sourceType, sourceId) {
  return `${sourceType === TOURNAMENT_DECK_SOURCE ? "entry" : "saved"}:${sourceId}`;
}

function normalizeSavedPublicDeck(rawDeck, fallbackUser, { prefixId = true } = {}) {
  if (!rawDeck?.id) return null;
  const parsedId = parsePublicDeckId(rawDeck.id);
  if (!parsedId.sourceId || parsedId.sourceType === TOURNAMENT_DECK_SOURCE) return null;

  return {
    id: prefixId
      ? buildPublicDeckId(SAVED_DECK_SOURCE, parsedId.sourceId)
      : parsedId.sourceId,
    sourceType: SAVED_DECK_SOURCE,
    sourceId: parsedId.sourceId,
    title: rawDeck.title || "無題デッキ",
    items: Array.isArray(rawDeck.items) ? rawDeck.items : [],
    isPublic: Boolean(rawDeck.isPublic),
    description: rawDeck.description || "",
    format: typeof rawDeck.format === "string" && rawDeck.format.trim() ? rawDeck.format.trim() : null,
    publishedAt: rawDeck.publishedAt || rawDeck.published_at || "",
    createdAt: rawDeck.createdAt || rawDeck.created_at || "",
    updatedAt: rawDeck.updatedAt || rawDeck.updated_at || "",
    owner: normalizeOwner(rawDeck.owner, fallbackUser),
  };
}

function normalizePositiveInteger(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeParticipantCount(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizeTournamentMetadata(rawDeck) {
  const tournament = rawDeck?.tournament || {};
  const id = firstNonEmptyText(
    tournament.id,
    rawDeck?.tournamentId,
    rawDeck?.tournament_id
  );
  const title = firstNonEmptyText(
    tournament.title,
    tournament.name,
    rawDeck?.tournamentName,
    rawDeck?.tournament_name,
    rawDeck?.tournamentTitle,
    rawDeck?.tournament_title
  );
  if (!id || !title) return null;

  return {
    id,
    title,
    startsAt: firstNonEmptyText(
      tournament.startsAt,
      tournament.starts_at,
      rawDeck?.tournamentStartsAt,
      rawDeck?.tournament_starts_at
    ),
  };
}

function normalizeTournamentPublicDeck(rawDeck) {
  const parsedId = parsePublicDeckId(rawDeck?.id);
  const entryId = firstNonEmptyText(
    rawDeck?.entryId,
    rawDeck?.entry_id,
    parsedId.sourceType === TOURNAMENT_DECK_SOURCE ? parsedId.sourceId : "",
    rawDeck?.id
  );
  const tournament = normalizeTournamentMetadata(rawDeck);
  if (!entryId || !tournament) return null;

  const owner = normalizeOwner(rawDeck.owner || rawDeck.user);
  const finalRank = normalizePositiveInteger(
    rawDeck.finalRank ??
      rawDeck.final_rank ??
      rawDeck.tournament?.finalRank ??
      rawDeck.tournament?.final_rank
  );
  const participantCount = normalizeParticipantCount(
    rawDeck.participantCount ??
      rawDeck.participant_count ??
      rawDeck.tournament?.participantCount ??
      rawDeck.tournament?.participant_count ??
      rawDeck.tournament?.entryCount ??
      rawDeck.tournament?.entry_count
  );
  const startsAt = tournament.startsAt;

  return {
    id: buildPublicDeckId(TOURNAMENT_DECK_SOURCE, entryId),
    sourceType: TOURNAMENT_DECK_SOURCE,
    sourceId: entryId,
    entryId,
    title: rawDeck.title || `${owner.name}の大会デッキ`,
    items: Array.isArray(rawDeck.items)
      ? rawDeck.items
      : Array.isArray(rawDeck.deckItems)
        ? rawDeck.deckItems
        : [],
    isPublic: true,
    description: rawDeck.description || "",
    format: firstNonEmptyText(rawDeck.format, rawDeck.deckFormat, rawDeck.deck_format) || null,
    publishedAt: rawDeck.publishedAt || rawDeck.published_at || startsAt,
    createdAt:
      rawDeck.createdAt ||
      rawDeck.created_at ||
      rawDeck.decklistSubmittedAt ||
      rawDeck.decklist_submitted_at ||
      "",
    updatedAt: rawDeck.updatedAt || rawDeck.updated_at || "",
    owner,
    finalRank,
    participantCount,
    tournament: {
      ...tournament,
      finalRank,
      participantCount,
    },
  };
}

function getRawDeckSource(rawDeck) {
  const parsedId = parsePublicDeckId(rawDeck?.id);
  const source = firstNonEmptyText(
    rawDeck?.sourceType,
    rawDeck?.source_type,
    rawDeck?.source,
    rawDeck?.deckType,
    rawDeck?.deck_type,
    rawDeck?.kind
  ).toLowerCase();
  if (
    parsedId.sourceType === TOURNAMENT_DECK_SOURCE ||
    ["tournament", "tournament_deck", "entry"].includes(source) ||
    rawDeck?.entryId != null ||
    rawDeck?.entry_id != null
  ) {
    return TOURNAMENT_DECK_SOURCE;
  }
  return SAVED_DECK_SOURCE;
}

function normalizePublicDeck(rawDeck, fallbackUser, { sourceType } = {}) {
  const resolvedSource = sourceType || getRawDeckSource(rawDeck);
  return resolvedSource === TOURNAMENT_DECK_SOURCE
    ? normalizeTournamentPublicDeck(rawDeck)
    : normalizeSavedPublicDeck(rawDeck, fallbackUser);
}

function unwrapPublicDeckPayload(payload) {
  if (!payload?.deck || typeof payload.deck !== "object" || Array.isArray(payload.deck)) {
    return payload;
  }
  return {
    ...payload,
    ...payload.deck,
    tournament: payload.deck.tournament || payload.tournament,
  };
}

function readMockPublicDeckRecords() {
  const parsed = readJsonStorage(PUBLIC_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function readMockPublicDecks() {
  return readMockPublicDeckRecords()
    .map((deck) => normalizeSavedPublicDeck(deck))
    .filter(Boolean);
}

function writeMockPublicDecks(decks) {
  writeJsonStorage(PUBLIC_STORAGE_KEY, decks);
}

function readMockTournamentDecks() {
  ensureMockTournamentStore();
  const store = readJsonStorage(TOURNAMENT_STORAGE_KEY, {
    tournaments: [],
    entries: {},
  });
  const tournaments = Array.isArray(store?.tournaments) ? store.tournaments : [];
  const entriesByTournament =
    store?.entries && typeof store.entries === "object" ? store.entries : {};

  return tournaments.flatMap((tournament) => {
    // #29: この2条件を両方満たす大会以外は、エントリーを一切参照対象にしない。
    // 非掲載は参加導線だけを絞る設定なので、isListed は公開条件に含めない。
    if (tournament?.status !== "completed" || tournament.decklistsPublic !== true) {
      return [];
    }

    const entries = Array.isArray(entriesByTournament[String(tournament.id)])
      ? entriesByTournament[String(tournament.id)]
      : [];
    const participantCount = entries.length;

    return entries
      .filter(
        (entry) =>
          entry?.id &&
          entry.decklistSubmittedAt &&
          Array.isArray(entry.deckItems) &&
          entry.deckItems.length > 0
      )
      .map((entry) =>
        normalizeTournamentPublicDeck({
          id: `entry:${entry.id}`,
          entryId: entry.id,
          items: entry.deckItems,
          decklistSubmittedAt: entry.decklistSubmittedAt,
          deckFormat: entry.deckFormat,
          finalRank: entry.finalRank,
          participantCount,
          owner: entry.user,
          updatedAt: tournament.updatedAt,
          tournament: {
            id: tournament.id,
            title: tournament.title,
            startsAt: tournament.startsAt,
          },
        })
      )
      .filter(Boolean);
  });
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

function readMockSavedDecksByUserId(userId) {
  if (!userId) return [];
  const parsed = readJsonStorage(buildSavedStorageKeyByUserId(userId), []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function writeMockSavedDecksByUserId(userId, decks) {
  if (!userId) return;
  writeJsonStorage(buildSavedStorageKeyByUserId(userId), decks);
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
    if (response.status === 404) error.code = "not_found";
    throw error;
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

function getDeckSortDate(deck) {
  return deck.sourceType === TOURNAMENT_DECK_SOURCE
    ? deck.tournament?.startsAt || deck.publishedAt || deck.updatedAt || ""
    : deck.publishedAt || deck.updatedAt || "";
}

function getStoredSavedDeckId(deck) {
  return parsePublicDeckId(deck?.id).sourceId;
}

function createFormatValidationError(formatName, violations) {
  const summary = `「${formatName}」のレギュレーションに適合していないため公開できません。`;
  const messages = violations.map((violation) => violation?.message).filter(Boolean);
  const error = new Error([summary, ...messages].join("\n"));
  error.code = "deck_format_violations";
  error.summary = summary;
  error.format = formatName;
  error.violations = violations;
  return error;
}

function getDeckPublicationViolations(items, format) {
  const normalizedFormat = String(format || "").trim();
  const formatPreset = FORMAT_PRESETS.find(({ name }) => name === normalizedFormat);
  return formatPreset ? validateDeck(items, formatPreset.regulation) : [];
}

export function getDeckPublicationValidationError(items, format) {
  const normalizedFormat = String(format || "").trim();
  if (!normalizedFormat) {
    return new Error("フォーマットを選択してください。");
  }

  const violations = getDeckPublicationViolations(items, normalizedFormat);
  return violations.length > 0
    ? createFormatValidationError(normalizedFormat, violations)
    : null;
}

export async function fetchPublicDecks({
  page = 1,
  query = "",
  format = "",
  cardId = "",
  playerName = "",
  tournamentName = "",
  ownerId = "",
  authMode,
} = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const normalizedFormat = String(format || "").trim();
  const normalizedCardId = String(cardId || "").trim();
  const normalizedPlayerName = String(playerName || "").trim().toLowerCase();
  const normalizedTournamentName = String(tournamentName || "").trim().toLowerCase();
  // playerName は表示名の部分一致だが ownerId は利用者IDの完全一致。
  // 「その人の公開デッキが全部で何件か」を数える用途はこちらを使う。
  const normalizedOwnerId = String(ownerId ?? "").trim();
  const params = new URLSearchParams();
  params.set("page", String(getPage(page)));
  if (normalizedQuery) params.set("query", String(query).trim());
  if (normalizedFormat) params.set("format", normalizedFormat);
  if (normalizedCardId) params.set("cardId", normalizedCardId);
  if (normalizedPlayerName) params.set("playerName", String(playerName).trim());
  if (normalizedTournamentName) params.set("tournamentName", String(tournamentName).trim());
  if (normalizedOwnerId) params.set("ownerId", normalizedOwnerId);

  if (authMode === "mock") {
    const decks = [...readMockPublicDecks(), ...readMockTournamentDecks()]
      .filter((deck) => deck.isPublic)
      .filter((deck) => !normalizedFormat || deck.format === normalizedFormat)
      .filter(
        (deck) =>
          !normalizedCardId ||
          deck.items.some(
            (item) =>
              String(item?.cardId ?? item?.card?.cardId ?? "").trim() === normalizedCardId &&
              Number(item?.count) > 0
          )
      )
      .filter(
        (deck) =>
          !normalizedPlayerName ||
          String(deck.owner?.name || "").toLowerCase().includes(normalizedPlayerName)
      )
      .filter(
        (deck) =>
          !normalizedOwnerId || String(deck.owner?.id ?? "") === normalizedOwnerId
      )
      .filter(
        (deck) =>
          !normalizedTournamentName ||
          String(deck.tournament?.title || "").toLowerCase().includes(normalizedTournamentName)
      )
      .filter((deck) => {
        if (!normalizedQuery) return true;
        return [deck.title, deck.description, deck.owner?.name, deck.tournament?.title]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) =>
        String(getDeckSortDate(right)).localeCompare(String(getDeckSortDate(left)))
      );
    return paginateDecks(decks, page);
  }

  const payload = await requestJson(`/api/public-decks?${params.toString()}`, { method: "GET" });
  return {
    items: (payload.items || [])
      .map((deck) => normalizePublicDeck(unwrapPublicDeckPayload(deck)))
      .filter(Boolean),
    total: Number(payload.total || 0),
    page: Number(payload.page || getPage(page)),
    pageSize: Number(payload.pageSize || PAGE_SIZE),
  };
}

export async function fetchPublicDeck(id, { authMode } = {}) {
  const resolvedId = parsePublicDeckId(id);

  if (authMode === "mock") {
    const deck =
      resolvedId.sourceType === TOURNAMENT_DECK_SOURCE
        ? readMockTournamentDecks().find((item) => item.sourceId === resolvedId.sourceId)
        : readMockPublicDecks().find(
            (item) => item.sourceId === resolvedId.sourceId && item.isPublic
          );
    if (!deck) {
      const error = new Error("公開デッキが見つかりません。");
      error.code = "not_found";
      throw error;
    }
    return deck;
  }

  const path =
    resolvedId.sourceType === TOURNAMENT_DECK_SOURCE
      ? `/api/tournament-decks/${encodeURIComponent(resolvedId.sourceId)}`
      : `/api/public-decks/${encodeURIComponent(resolvedId.sourceId)}`;
  const payload = await requestJson(path, { method: "GET" });
  const rawDeck = unwrapPublicDeckPayload(payload);
  return normalizePublicDeck(
    {
      ...rawDeck,
      id: rawDeck.id || resolvedId.sourceId,
      ...(resolvedId.sourceType === TOURNAMENT_DECK_SOURCE && !rawDeck.entryId
        ? { entryId: resolvedId.sourceId }
        : {}),
    },
    undefined,
    { sourceType: resolvedId.sourceType }
  );
}

export async function setDeckPublication({
  authMode,
  user,
  deckId,
  isPublic,
  description = "",
  format = null,
}) {
  ensureUser(user);
  const resolvedId = parsePublicDeckId(deckId);
  if (resolvedId.sourceType === TOURNAMENT_DECK_SOURCE) {
    throw new Error("大会デッキの公開設定は変更できません。");
  }
  const deckKey = resolvedId.sourceId;
  const nextDescription = String(description || "").trim();
  const nextIsPublic = Boolean(isPublic);
  const nextFormat = typeof format === "string" && format.trim() ? format.trim() : null;

  if (nextIsPublic && !nextFormat) {
    throw getDeckPublicationValidationError([], nextFormat);
  }

  if (authMode === "mock") {
    const now = new Date().toISOString();
    const publicDecks = readMockPublicDeckRecords();
    const publicDeck = publicDecks.find((deck) => getStoredSavedDeckId(deck) === deckKey);
    const canAdminForceUnpublish = user.role === "admin" && !nextIsPublic;

    if (canAdminForceUnpublish) {
      const ownerId = publicDeck?.owner?.id;
      const ownerSavedDecks = readMockSavedDecksByUserId(ownerId);

      if (ownerSavedDecks.some((deck) => String(deck.id) === deckKey)) {
        writeMockSavedDecksByUserId(
          ownerId,
          ownerSavedDecks.map((deck) =>
            String(deck.id) === deckKey
              ? {
                  ...deck,
                  isPublic: false,
                  updatedAt: now,
                }
              : deck
          )
        );
      }

      writeMockPublicDecks(
        publicDecks.filter((deck) => getStoredSavedDeckId(deck) !== deckKey)
      );
      return normalizeSavedPublicDeck(
        {
          ...(publicDeck || {
            id: deckKey,
            title: deckKey,
            items: [],
            owner: normalizeOwner(null, user),
          }),
          isPublic: false,
          updatedAt: now,
        },
        user,
        { prefixId: false }
      );
    }

    const savedDecks = readMockSavedDecks(user);
    const savedDeck = savedDecks.find((deck) => String(deck.id) === deckKey);
    if (!savedDeck) {
      throw new Error("保存デッキが見つかりません。");
    }

    const isCurrentlyPublic = Boolean(savedDeck.isPublic || publicDeck?.isPublic);
    const storedFormat = publicDeck?.isPublic ? publicDeck.format : savedDeck.format;
    const currentFormat =
      typeof storedFormat === "string" && storedFormat.trim()
        ? storedFormat.trim()
        : null;
    const shouldValidatePublication =
      nextIsPublic && (!isCurrentlyPublic || currentFormat !== nextFormat);
    if (shouldValidatePublication) {
      const validationError = getDeckPublicationValidationError(savedDeck.items, nextFormat);
      if (validationError) {
        throw validationError;
      }
    }

    const publishedAt = nextIsPublic ? savedDeck.publishedAt || now : "";
    const nextSavedDeck = {
      ...savedDeck,
      isPublic: nextIsPublic,
      description: nextDescription,
      format: nextIsPublic ? nextFormat : savedDeck.format || publicDeck?.format || null,
      publishedAt,
      updatedAt: now,
    };
    writeMockSavedDecks(
      user,
      savedDecks.map((deck) => (String(deck.id) === deckKey ? nextSavedDeck : deck))
    );

    const nextPublicDecks = publicDecks.filter(
      (deck) => getStoredSavedDeckId(deck) !== deckKey
    );
    if (nextIsPublic) {
      nextPublicDecks.unshift(
        {
          ...nextSavedDeck,
          id: deckKey,
          owner: normalizeOwner(null, user),
        }
      );
    }
    writeMockPublicDecks(nextPublicDecks);
    return normalizeSavedPublicDeck(nextSavedDeck, user, { prefixId: false });
  }

  const payload = await requestJson(`/api/decks/${encodeURIComponent(deckKey)}`, {
    method: "PATCH",
    body: JSON.stringify({
      isPublic: nextIsPublic,
      description: nextDescription,
      format: nextFormat,
    }),
  });
  return normalizeSavedPublicDeck(payload.deck || payload, user, { prefixId: false });
}

export { PUBLIC_STORAGE_KEY, TOURNAMENT_STORAGE_KEY };
