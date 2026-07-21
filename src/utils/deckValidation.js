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

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function normalizeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function getCard(item) {
  return item?.card || item || {};
}

function getCardId(item) {
  return normalizeString(item?.cardId || item?.card?.cardId || item?.id || item?.card?.id);
}

function getCardName(item) {
  const card = getCard(item);
  return normalizeString(card.name || item?.name || getCardId(item) || "カード");
}

function matchesCardRef(item, refs) {
  const cardId = getCardId(item);
  const cardName = getCardName(item);
  return refs.some((ref) => ref === cardId || ref === cardName);
}

export function defaultRegulation(regulation = {}) {
  const merged = { ...DEFAULT_REGULATION, ...(regulation || {}) };
  return {
    ...merged,
    bannedCards: normalizeList(merged.bannedCards),
    limitedCards: normalizeList(merged.limitedCards),
    allowedSets: Array.isArray(merged.allowedSets) ? normalizeList(merged.allowedSets) : null,
  };
}

export function getCardSets(card) {
  if (!card) return [];

  const candidates = [
    card.sets,
    card.set,
    card.setName,
    card.set_name,
    card.setIncluded,
    card.expansion,
    card.expansionName,
  ];

  return candidates
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(/[、,/]/);
      return [];
    })
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

export function validateDeck(items, regulation) {
  const deckItems = Array.isArray(items) ? items : [];
  const rule = defaultRegulation(regulation);
  const violations = [];
  const mainCount = deckItems
    .filter((item) => item?.zone !== "side")
    .reduce((sum, item) => sum + normalizeCount(item?.count), 0);
  const sideCount = deckItems
    .filter((item) => item?.zone === "side")
    .reduce((sum, item) => sum + normalizeCount(item?.count), 0);

  if (mainCount < rule.mainMin || mainCount > rule.mainMax) {
    violations.push({
      code: "main_count",
      message: `メインデッキは${rule.mainMin}枚以上${rule.mainMax}枚以下にしてください。現在は${mainCount}枚です。`,
    });
  }

  if (sideCount !== 0 && sideCount !== rule.sideSize) {
    violations.push({
      code: "side_count",
      message: `サイドボードは0枚または${rule.sideSize}枚ちょうどにしてください。現在は${sideCount}枚です。`,
    });
  }

  const countsByName = new Map();
  const countsByCardKey = new Map();
  deckItems.forEach((item) => {
    const count = normalizeCount(item?.count);
    if (count === 0) return;

    const name = getCardName(item);
    countsByName.set(name, (countsByName.get(name) || 0) + count);

    const cardId = getCardId(item);
    const key = cardId || name;
    const current = countsByCardKey.get(key) || { count: 0, item };
    countsByCardKey.set(key, { ...current, count: current.count + count });
  });

  countsByName.forEach((count, cardName) => {
    if (count > rule.maxCopies) {
      violations.push({
        code: "max_copies",
        message: `${cardName}は合計${rule.maxCopies}枚までです。現在は${count}枚です。`,
        cardName,
      });
    }
  });

  countsByCardKey.forEach(({ count, item }) => {
    const cardName = getCardName(item);
    if (matchesCardRef(item, rule.bannedCards)) {
      violations.push({
        code: "banned",
        message: `${cardName}は禁止カードです。デッキに入れることはできません。`,
        cardName,
      });
    }

    if (count > 1 && matchesCardRef(item, rule.limitedCards)) {
      violations.push({
        code: "limited",
        message: `${cardName}は制限カードです。合計1枚までにしてください。現在は${count}枚です。`,
        cardName,
      });
    }
  });

  if (rule.allowedSets) {
    const allowedSet = new Set(rule.allowedSets);
    countsByCardKey.forEach(({ item }) => {
      const card = getCard(item);
      const sets = getCardSets(card);
      // Older saved decks and manually entered cards may not include set metadata.
      // In that case the set cannot be verified, so leave it to the ID-based rules.
      if (sets.length === 0) return;
      const isAllowed = sets.some((setName) => allowedSet.has(setName));
      if (!isAllowed) {
        const cardName = getCardName(item);
        violations.push({
          code: "allowed_sets",
          message: `${cardName}はこのレギュレーションで使用できる収録弾ではありません。`,
          cardName,
        });
      }
    });
  }

  return violations;
}
