import { API_SEARCH_URL } from "../utils/searchResults";

export const CARD_SEARCH_PAGE_SIZE = 200;

function normalizeCard(card) {
  const cardId = String(card?.cardId ?? "").trim();
  const name = String(card?.name ?? "").trim();
  if (!cardId || !name) return null;
  return { ...card, cardId, name };
}

function normalizeCards(cards) {
  const seen = new Set();
  return (Array.isArray(cards) ? cards : []).reduce((items, card) => {
    const normalized = normalizeCard(card);
    if (!normalized || seen.has(normalized.cardId)) return items;
    seen.add(normalized.cardId);
    items.push(normalized);
    return items;
  }, []);
}

function normalizeComparableName(value) {
  const name = String(value || "").trim();
  try {
    return name.normalize("NFKC").toLocaleLowerCase("ja-JP");
  } catch (_error) {
    return name.toLowerCase();
  }
}

function sortCardsByNameMatch(cards, query) {
  const normalizedQuery = normalizeComparableName(query);
  if (!normalizedQuery) return cards;

  return cards
    .map((card, index) => {
      const normalizedName = normalizeComparableName(card.name);
      const matchPriority =
        normalizedName === normalizedQuery
          ? 0
          : normalizedName.startsWith(normalizedQuery)
            ? 1
            : 2;
      return { card, index, matchPriority };
    })
    .sort(
      (left, right) =>
        left.matchPriority - right.matchPriority || left.index - right.index
    )
    .map(({ card }) => card);
}

async function fetchCardsByNamePage(name, { signal, nameForward }) {
  const response = await fetch(API_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      name_forward: Boolean(nameForward),
      page: 1,
      pageSize: CARD_SEARCH_PAGE_SIZE,
    }),
    mode: "cors",
    signal,
  });

  if (!response.ok) {
    throw new Error(`カード検索に失敗しました (${response.status})。`);
  }

  const payload = await response.json();
  const cards = normalizeCards(payload?.data);
  const parsedTotal = Number(payload?.total);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : cards.length;
  return { cards, total };
}

export async function searchCardsByName(query, { signal, nameForward = false } = {}) {
  const name = String(query || "").trim();
  if (!name) return { cards: [], total: 0, isTruncated: false };

  if (nameForward) {
    const result = await fetchCardsByNamePage(name, { signal, nameForward: true });
    const cards = sortCardsByNameMatch(result.cards, name);
    return {
      cards,
      total: result.total,
      isTruncated: result.total > cards.length,
    };
  }

  const [partialResult, prefixResult] = await Promise.all([
    fetchCardsByNamePage(name, { signal, nameForward: false }),
    fetchCardsByNamePage(name, { signal, nameForward: true }),
  ]);
  const cards = sortCardsByNameMatch(
    normalizeCards([...prefixResult.cards, ...partialResult.cards]),
    name
  );
  return {
    cards,
    total: partialResult.total,
    isTruncated: partialResult.total > cards.length,
  };
}

export async function resolveCardReference(value, { signal } = {}) {
  const input = String(value || "").trim();
  const result = await searchCardsByName(input, { signal, nameForward: true });
  const exactMatches = result.cards.filter((card) => card.name === input);

  if (exactMatches.length === 1 && !result.isTruncated) {
    return { status: "resolved", card: exactMatches[0], candidates: [] };
  }

  if (exactMatches.length > 0) {
    return {
      status: "ambiguous",
      candidates: exactMatches,
      candidateTotal: exactMatches.length,
      message: result.isTruncated
        ? "検索結果が多いため自動確定できません。カード画像と収録弾を確認して選択してください。"
        : "同名カードが複数あります。カード画像と収録弾を確認して選択してください。",
    };
  }

  if (result.cards.length > 0) {
    return {
      status: "ambiguous",
      candidates: result.cards,
      candidateTotal: result.total,
      message: result.isTruncated
        ? "完全一致するカードがなく、候補が多くあります。カード名をより具体的に入力してください。"
        : "完全一致するカードがありません。候補から選択するか、カード名を修正してください。",
    };
  }

  return {
    status: "unresolved",
    candidates: [],
    message: "一致するカードが見つかりません。",
  };
}
