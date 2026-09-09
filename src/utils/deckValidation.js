import DECK_COPY_LIMITS from "../data/deckCopyLimits.json";
import GENERATION_CARDS from "../data/generationCards.json";

// 特殊Gはメイン・サイド合計でこの枚数まで。基本Gと「基本Gとして扱う」カードは数えない。
export const SPECIAL_G_MAX = 6;

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

// 基本G(擬似カード)と、「(自動B)：このカードは基本Gとして扱う。(注：デッキ構築時を含む)」を
// 持つカード。どちらも同名3枚制限にも特殊Gの枚数にも数えない。
function isBasicGEquivalent(item) {
  const cardId = getCardId(item);
  if (cardId.startsWith("basic-g-")) return true;
  if (Object.prototype.hasOwnProperty.call(GENERATION_CARDS.basicEquivalent, cardId)) return true;
  return getCardName(item) === "基本G";
}

// Gカードかどうか。収録済みカードはIDで判定し、IDが未知の場合だけカード種別を見る。
function isGenerationCard(item) {
  const cardId = getCardId(item);
  if (Object.prototype.hasOwnProperty.call(GENERATION_CARDS.special, cardId)) return true;
  const card = getCard(item);
  return (
    normalizeString(card.cardType) === "10" ||
    normalizeString(card.card_type_name) === "Generation"
  );
}

// 特殊G。基本G扱いのカードを除いたGカード。
function isSpecialG(item) {
  return !isBasicGEquivalent(item) && isGenerationCard(item);
}

// 「(自動B)：このカードはデッキにN枚以上入れられる」のように、そのカード自身の
// 枚数だけを上書きするテキスト。同名の別バージョンには及ばない。
// max が null なら上限なし。該当しなければ null を返す。
function getCardScopedLimit(item) {
  const limit = DECK_COPY_LIMITS.cards[getCardId(item)];
  return limit && limit.scope === "card" ? limit : null;
}

// 同名グループの上限枚数。
// 「この名称のカードは…」テキスト(月面民間企業など) > 特殊G(6枚) > レギュレーションの既定値。
function resolveNameLimit(item, rule) {
  const named = DECK_COPY_LIMITS.byName[getCardName(item)];
  if (named != null) return named;
  if (isSpecialG(item)) return SPECIAL_G_MAX;
  return rule.maxCopies;
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

  // 同名で数えるグループと、カード単位で数えるグループ(テキストで上限が変わるカード)。
  const countsByName = new Map();
  const countsByLimitedCard = new Map();
  const countsByCardKey = new Map();
  let specialGCount = 0;
  deckItems.forEach((item) => {
    const count = normalizeCount(item?.count);
    if (count === 0) return;

    const name = getCardName(item);
    const cardScopedLimit = getCardScopedLimit(item);
    if (isBasicGEquivalent(item)) {
      // 基本Gと「基本Gとして扱う」カードは枚数を数えない。
    } else if (!cardScopedLimit) {
      const current = countsByName.get(name);
      const limit = resolveNameLimit(item, rule);
      countsByName.set(name, {
        count: (current?.count || 0) + count,
        limit: current ? Math.min(current.limit, limit) : limit,
      });
    } else if (cardScopedLimit.max !== null) {
      // 「このカードはデッキに50枚まで入れられる」のように、そのカードだけ上限が変わる。
      const key = getCardId(item);
      const current = countsByLimitedCard.get(key);
      countsByLimitedCard.set(key, {
        count: (current?.count || 0) + count,
        limit: cardScopedLimit.max,
        cardName: name,
      });
    }
    // cardScopedLimit.max === null は上限なしなので数えない。
    if (isSpecialG(item)) specialGCount += count;

    const cardId = getCardId(item);
    const key = cardId || name;
    const current = countsByCardKey.get(key) || { count: 0, item };
    countsByCardKey.set(key, { ...current, count: current.count + count });
  });

  countsByName.forEach(({ count, limit }, cardName) => {
    if (count > limit) {
      violations.push({
        code: "max_copies",
        message: `${cardName}は合計${limit}枚までです。現在は${count}枚です。`,
        cardName,
      });
    }
  });

  countsByLimitedCard.forEach(({ count, limit, cardName }) => {
    if (count > limit) {
      violations.push({
        code: "max_copies",
        message: `${cardName}は合計${limit}枚までです。現在は${count}枚です。`,
        cardName,
      });
    }
  });

  if (specialGCount > SPECIAL_G_MAX) {
    violations.push({
      code: "special_g_count",
      message: `特殊Gはメイン・サイド合計${SPECIAL_G_MAX}枚までです。現在は${specialGCount}枚です。`,
    });
  }

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
