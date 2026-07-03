// デッキの型集計・並び替え・エクスポート整形ロジック（DeckBuilder で使用）
import { getCardCode, isBasicGCard } from "./cardImages";

export const DECK_TYPE_ORDER = ["ACE", "UNIT", "CHARACTER", "COMMAND", "OPERATION", "G"];

export const DECK_TYPE_ORDER_INDEX = DECK_TYPE_ORDER.reduce((map, key, index) => {
  map[key] = index;
  return map;
}, {});

export const CARD_TYPE_KEY_MAP = {
  1: "UNIT",
  2: "CHARACTER",
  3: "COMMAND",
  4: "OPERATION",
  10: "G",
  11: "ACE",
};

export const DECK_EXPORT_SECTION_LABELS = {
  ACE: "ACE",
  UNIT: "UNIT",
  CHARACTER: "CHARACTER",
  COMMAND: "COMMAND",
  OPERATION: "OPERATION",
  G: "GENERATION",
};

function isDeckExportBasicG(card) {
  return Boolean(card?.basicGColorKey) || String(card?.cardId || "").startsWith("basic-g-");
}

function normalizeDeckExportColor(value) {
  return String(value || "")
    .trim()
    .replace(/[・･]+/g, "")
    .replace(/\s+/g, "");
}

function getDeckExportColorLabel(card, typeKey) {
  if (typeKey === "G") {
    if (isDeckExportBasicG(card)) {
      return normalizeDeckExportColor(card?.sp_power_color1_name || card?.color || "");
    }
    return "特G";
  }

  const directColor = normalizeDeckExportColor(card?.color || "");
  if (directColor) return directColor;

  const primary = normalizeDeckExportColor(card?.sp_power_color1_name || "");
  const secondary = normalizeDeckExportColor(card?.sp_power_color2_name || "");
  return `${primary}${secondary}`.trim();
}

function getDeckExportCode(card, typeKey) {
  if (typeKey === "G" && isDeckExportBasicG(card)) {
    return "G-*";
  }
  return getCardCode(card) || "-";
}

function getDeckExportName(card, typeKey) {
  if (typeKey === "G" && isDeckExportBasicG(card)) {
    return "基本G";
  }
  return card?.name || `Card ${card?.cardId || ""}`.trim();
}

export function buildDeckExportEntries(items) {
  const mergedEntries = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const typeKey = getDeckSummaryTypeKey(item?.card);
    if (!typeKey) return;

    const colorLabel = getDeckExportColorLabel(item.card, typeKey);
    const code = getDeckExportCode(item.card, typeKey);
    const name = getDeckExportName(item.card, typeKey);
    const mergeKey = [typeKey, colorLabel, code, name].join("|");
    const currentCount = Number(item?.count || 0);
    if (currentCount <= 0) return;

    if (mergedEntries.has(mergeKey)) {
      mergedEntries.get(mergeKey).count += currentCount;
      return;
    }

    mergedEntries.set(mergeKey, {
      typeKey,
      count: currentCount,
      colorLabel,
      code,
      name,
      sortCode: getCardCode(item.card) || code,
    });
  });

  return Array.from(mergedEntries.values()).sort((left, right) => {
    const leftIndex =
      left.typeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, left.typeKey)
        ? DECK_TYPE_ORDER_INDEX[left.typeKey]
        : Number.MAX_SAFE_INTEGER;
    const rightIndex =
      right.typeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, right.typeKey)
        ? DECK_TYPE_ORDER_INDEX[right.typeKey]
        : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    const codeComparison = String(left.sortCode || "").localeCompare(
      String(right.sortCode || ""),
      "ja",
      { numeric: true }
    );
    if (codeComparison !== 0) return codeComparison;

    return String(left.name || "").localeCompare(String(right.name || ""), "ja", {
      numeric: true,
    });
  });
}

export function formatDeckExportLine(entry) {
  return [entry.count, entry.colorLabel, entry.code, entry.name].filter(Boolean).join(" ");
}

function inferDeckTypeKeyFromCardNumber(card) {
  const cardNumber1 = card?.cardNumber1 ? String(card.cardNumber1).trim().toUpperCase() : "";
  if (!cardNumber1) return "";

  if (cardNumber1 === "ACE") return "ACE";
  if (cardNumber1 === "G" || cardNumber1.startsWith("SG") || cardNumber1.startsWith("SPG")) {
    return "G";
  }
  if (
    cardNumber1 === "U" ||
    cardNumber1.startsWith("VU") ||
    cardNumber1.startsWith("SU") ||
    cardNumber1.startsWith("UU")
  ) {
    return "UNIT";
  }
  if (cardNumber1 === "CH" || cardNumber1.startsWith("VCH")) {
    return "CHARACTER";
  }
  if (
    cardNumber1 === "C" ||
    cardNumber1.startsWith("VC") ||
    cardNumber1.startsWith("SPC") ||
    cardNumber1.startsWith("SC")
  ) {
    return "COMMAND";
  }
  if (cardNumber1 === "O" || cardNumber1.startsWith("VO") || cardNumber1.startsWith("SO")) {
    return "OPERATION";
  }

  return "";
}

export function getDeckSummaryTypeKey(card) {
  const typeName = card?.card_type_name ? String(card.card_type_name).trim().toUpperCase() : "";
  const rawCardType = card?.cardType ?? card?.card_type ?? "";
  const numericCardType = Number(rawCardType);

  if (typeName === "GENERATION" || isBasicGCard(card)) {
    return "G";
  }

  if (DECK_TYPE_ORDER.includes(typeName)) {
    return typeName;
  }

  if (Number.isFinite(numericCardType) && CARD_TYPE_KEY_MAP[numericCardType]) {
    return CARD_TYPE_KEY_MAP[numericCardType];
  }

  return inferDeckTypeKeyFromCardNumber(card);
}

export function buildTypeSummary(items) {
  const summary = DECK_TYPE_ORDER.reduce((map, key) => {
    map[key] = 0;
    return map;
  }, {});

  items.forEach((item) => {
    const key = getDeckSummaryTypeKey(item.card);
    if (!key) return;
    summary[key] += item.count;
  });

  return summary;
}

export function compareDeckItems(leftItem, rightItem) {
  const leftCode = getCardCode(leftItem?.card);
  const rightCode = getCardCode(rightItem?.card);
  const codeComparison = leftCode.localeCompare(rightCode, "ja", { numeric: true });
  if (codeComparison !== 0) return codeComparison;

  const leftName = String(leftItem?.card?.name || "");
  const rightName = String(rightItem?.card?.name || "");
  const nameComparison = leftName.localeCompare(rightName, "ja", { numeric: true });
  if (nameComparison !== 0) return nameComparison;

  return String(leftItem?.cardId || "").localeCompare(String(rightItem?.cardId || ""), "ja", {
    numeric: true,
  });
}

export function compareDeckItemsForExport(leftItem, rightItem) {
  const leftTypeKey = getDeckSummaryTypeKey(leftItem?.card);
  const rightTypeKey = getDeckSummaryTypeKey(rightItem?.card);
  const leftIndex =
    leftTypeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, leftTypeKey)
      ? DECK_TYPE_ORDER_INDEX[leftTypeKey]
      : Number.MAX_SAFE_INTEGER;
  const rightIndex =
    rightTypeKey && Object.prototype.hasOwnProperty.call(DECK_TYPE_ORDER_INDEX, rightTypeKey)
      ? DECK_TYPE_ORDER_INDEX[rightTypeKey]
      : Number.MAX_SAFE_INTEGER;

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return compareDeckItems(leftItem, rightItem);
}

export function groupDeckItemsByType(items) {
  const groups = DECK_TYPE_ORDER.reduce((map, type) => {
    map[type] = [];
    return map;
  }, {});

  items.forEach((item) => {
    const typeKey = getDeckSummaryTypeKey(item.card);
    if (!typeKey || !groups[typeKey]) return;
    groups[typeKey].push(item);
  });

  DECK_TYPE_ORDER.forEach((type) => {
    groups[type].sort(compareDeckItems);
  });

  return groups;
}

export function buildDeckExport(mainGroups, sideItems) {
  const orderedMainItems = DECK_TYPE_ORDER.flatMap((type) => mainGroups[type] || []);
  const mainEntries = buildDeckExportEntries(orderedMainItems);
  const sideEntries = buildDeckExportEntries(sideItems);
  const lines = [];

  DECK_TYPE_ORDER.forEach((type) => {
    const sectionEntries = mainEntries.filter((entry) => entry.typeKey === type);
    if (sectionEntries.length === 0) return;

    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(DECK_EXPORT_SECTION_LABELS[type] || type);
    sectionEntries.forEach((entry) => {
      lines.push(formatDeckExportLine(entry));
    });
  });

  if (sideEntries.length > 0) {
    lines.push("");
    lines.push("サイドボード");
    sideEntries.forEach((entry) => {
      lines.push(formatDeckExportLine(entry));
    });
  }

  return lines.join("\n").trim();
}

export function buildDefaultDeckTitle() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} のデッキ`;
}

export function buildDeckCostLabel(card) {
  if (isBasicGCard(card)) {
    return "Generation";
  }

  const primary = [card?.sp_power_color1_name, card?.spPowerCost1].filter(Boolean).join(" ").trim();
  const secondary = card?.sp_power_color2_name
    ? [card.sp_power_color2_name, card?.spPowerCost2].filter(Boolean).join(" ").trim()
    : "";
  const total = card?.totalCost || "-";
  const resource = card?.resourceCost || "-";

  return `${primary || "-"}${secondary ? ` / ${secondary}` : ""} - ${total} - ${resource}`;
}

export function getDeckNameClassName(name) {
  const length = String(name || "").length;
  if (length >= 34) return "deck-card-compact-name deck-card-compact-name-tightest";
  if (length >= 26) return "deck-card-compact-name deck-card-compact-name-tight";
  return "deck-card-compact-name";
}
